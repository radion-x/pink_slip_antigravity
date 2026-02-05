/**
 * AI Chat Widget Class
 * Handles the floating AI chat widget functionality
 */
class AIChat {
    constructor() {
        this.chatToggle = document.getElementById('chatToggle');
        this.chatWindow = document.getElementById('chatWindow');
        this.chatClose = document.getElementById('chatClose');
        this.chatForm = document.getElementById('chatForm');
        this.chatInput = document.getElementById('chatInput');
        this.chatMessages = document.getElementById('chatMessages');
        this.apiEndpoint = '/api/chat';
        this.configEndpoint = '/api/chat/config';
        this.isOpen = false;
        this.conversationHistory = [];
        this.suggestedQuestions = [];
        this.hasShownSuggestions = false;

        this.init();
    }

    async init() {
        if (!this.chatToggle || !this.chatWindow) {
            console.warn('Chat widget elements not found');
            return;
        }

        this.chatToggle.addEventListener('click', () => this.toggleChat());
        this.chatClose.addEventListener('click', () => this.toggleChat());
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));

        // Fetch configuration and suggested questions
        await this.loadConfig();

        // Add welcome message
        this.addMessage('ai', 'Hello! 👋 How can I help you today?');

        // Add suggested questions if available
        if (this.suggestedQuestions.length > 0 && !this.hasShownSuggestions) {
            this.showSuggestedQuestions();
        }

        // Close chat when clicking outside
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    async loadConfig() {
        try {
            const response = await fetch(this.configEndpoint);
            const config = await response.json();

            if (config.suggestedQuestions && Array.isArray(config.suggestedQuestions)) {
                this.suggestedQuestions = config.suggestedQuestions;
            }
        } catch (error) {
            console.warn('Could not load chat config:', error);
            // Continue without suggested questions
        }
    }

    showSuggestedQuestions() {
        if (this.hasShownSuggestions) return;

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'chat-suggestions';
        suggestionsDiv.id = 'chatSuggestions';

        this.suggestedQuestions.forEach(question => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = question;
            btn.addEventListener('click', (e) => this.handleSuggestionClick(question, e));
            suggestionsDiv.appendChild(btn);
        });

        this.chatMessages.appendChild(suggestionsDiv);
        this.scrollToBottom();
        this.hasShownSuggestions = true;
    }

    handleSuggestionClick(question, event) {
        // Prevent click from bubbling up to the outside click handler
        if (event) {
            event.stopPropagation();
        }

        // Remove suggestions
        const suggestionsDiv = document.getElementById('chatSuggestions');
        if (suggestionsDiv) {
            suggestionsDiv.remove();
        }

        // Set input value and submit
        this.chatInput.value = question;
        this.chatForm.dispatchEvent(new Event('submit'));
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.chatWindow.classList.toggle('hidden');
        document.body.classList.toggle('chat-open', this.isOpen);

        if (this.isOpen) {
            // Only auto-focus on desktop to prevent keyboard popping up on mobile
            if (window.innerWidth > 768) {
                this.chatInput.focus();
            }
            // Track chat open event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'chat_opened', {
                    'event_category': 'engagement'
                });
            }
        }
    }

    handleOutsideClick(e) {
        if (this.isOpen &&
            !this.chatWindow.contains(e.target) &&
            !this.chatToggle.contains(e.target)) {
            this.toggleChat();
        }
    }

    addMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;

        // Format AI messages with markdown-like rendering
        if (type === 'ai') {
            messageDiv.innerHTML = this.formatMessage(text);
        } else {
            messageDiv.textContent = text;
        }

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Store in conversation history
        this.conversationHistory.push({
            role: type === 'user' ? 'user' : 'assistant',
            content: text
        });
    }

    formatMessage(text) {
        // Convert markdown-style formatting to HTML
        let formatted = text
            // Bold text **text** -> <strong>text</strong>
            .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
            // Italic text *text* -> <em>text</em>
            .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Checkmarks and emojis (keep as-is)
            .replace(/✅/g, '<span class="emoji">✅</span>')
            .replace(/✔️/g, '<span class="emoji">✔️</span>')
            // Bullet points
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^• (.+)$/gm, '<li>$1</li>');

        // Wrap lists in ul tags
        if (formatted.includes('<li>')) {
            formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        }

        return formatted;
    }

    addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message typing';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const message = this.chatInput.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage('user', message);
        this.chatInput.value = '';

        // Disable input while processing
        this.chatInput.disabled = true;
        const submitBtn = this.chatForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        // Show typing indicator
        this.addTypingIndicator();

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    history: this.conversationHistory.slice(-10)
                }),
            });

            // Check if streaming
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('text/event-stream')) {
                // Handle streaming response
                await this.handleStreamingResponse(response);
            } else {
                // Handle non-streaming response
                const data = await response.json();

                // Remove typing indicator
                this.removeTypingIndicator();

                if (response.ok) {
                    this.addMessage('ai', data.response || data.message);

                    // Track successful chat interaction
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'chat_message_sent', {
                            'event_category': 'engagement'
                        });
                    }
                } else {
                    this.addMessage('ai', 'Sorry, I encountered an error. Please try again or contact us directly.');
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.removeTypingIndicator();
            this.addMessage('ai', 'Sorry, I\'m having trouble connecting. Please try again later or contact us directly.');
        } finally {
            // Re-enable input
            this.chatInput.disabled = false;
            submitBtn.disabled = false;
            this.chatInput.focus();
        }
    }

    async handleStreamingResponse(response) {
        // Keep typing indicator until we get first content
        let messageDiv = null;
        let fullResponse = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            // Stream complete - store in history
                            if (fullResponse) {
                                this.conversationHistory.push({
                                    role: 'assistant',
                                    content: fullResponse
                                });
                            }

                            // Track successful chat interaction
                            if (typeof gtag !== 'undefined') {
                                gtag('event', 'chat_message_sent', {
                                    'event_category': 'engagement'
                                });
                            }
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;

                            if (content) {
                                // Remove typing indicator on FIRST content
                                if (!messageDiv) {
                                    this.removeTypingIndicator();
                                    messageDiv = document.createElement('div');
                                    messageDiv.className = 'chat-message ai';
                                    this.chatMessages.appendChild(messageDiv);
                                }

                                fullResponse += content;
                                // Format and display with HTML rendering
                                messageDiv.innerHTML = this.formatMessage(fullResponse);
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);
            this.removeTypingIndicator();
            if (!messageDiv) {
                messageDiv = document.createElement('div');
                messageDiv.className = 'chat-message ai';
                this.chatMessages.appendChild(messageDiv);
            }
            messageDiv.innerHTML = 'Sorry, there was an error receiving the response.';
        }
    }

    // Public method to programmatically send a message (useful for triggering chat from other parts of the site)
    sendMessage(message) {
        if (!this.isOpen) {
            this.toggleChat();
        }
        this.chatInput.value = message;
        this.chatForm.dispatchEvent(new Event('submit'));
    }
}

// Initialize when DOM is ready
let aiChatInstance;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        aiChatInstance = new AIChat();
    });
} else {
    aiChatInstance = new AIChat();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChat;
}
