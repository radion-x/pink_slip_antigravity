# Technical Documentation & App Structure

This document provides a comprehensive overview of the application's architecture, configuration, and key systems. It is designed to assist developers in understanding, maintaining, and extending the application.

## 1. Architecture Overview

The application is a simple, robust web application built with:
- **Backend**: Node.js with Express framework.
- **Frontend**: Vanilla HTML/CSS/JavaScript (served statically by Express).
- **Communication**: RESTful API endpoints for contact forms and AI chat.
- **Services**:
  - **Mailgun**: For transactional email delivery (contact forms, quotes).
  - **OpenRouter (AI)**: For the intelligent chat assistant.

## 2. Directory Structure

```breadcrumbs
/
├── .env                 # Environment variables (secrets, keys, config)
├── .env.example         # Template for environment variables
├── server.js            # Main application entry point & server config
├── routes/              # API Route definitions
│   ├── email.js         # Email handling logic (Mailgun)
│   └── ai.js            # AI Chat logic (OpenRouter)
└── public/              # Static frontend assets
    ├── index.html       # Main landing page
    ├── css/             # Stylesheets
    └── js/              # Frontend logic
        ├── main.js      # Bootstrapping & UI interactions
        ├── formHandler.js # Contact/Quote form submission logic
        └── aiChat.js    # Chat widget logic & API interaction
```

## 3. Environment Configuration (`.env`)

The application relies on a `.env` file for configuration. Below is an exhaustive list of all variables, their purpose, and usage.

### 🔑 API Keys & Services

| Variable | Description | Required? | Location |
| :--- | :--- | :--- | :--- |
| `MAILGUN_API_KEY` | Private API key for Mailgun. | Yes | [Mailgun Security](https://app.mailgun.com/app/account/security/api_keys) |
| `MAILGUN_DOMAIN` | Your verified domain in Mailgun (e.g., `mg.yourdomain.com`). | Yes | Mailgun Dashboard |
| `MAILGUN_REGION` | API region (`api` for US, `eu` for Europe). | Yes | Default: `api` |
| `OPENROUTER_API_KEY` | API key for OpenRouter AI access. | Yes | [OpenRouter Keys](https://openrouter.ai/keys) |

### 🤖 AI Agent Configuration (Prompts & Behavior)

These variables control the "personality" and capabilities of the AI Assistant.

| Variable | Description | Default / Notes |
| :--- | :--- | :--- |
| `OPENROUTER_MODEL` | The specific AI model to query. | `openai/gpt-3.5-turbo` or `google/gemini-flash-1.5:free` |
| `OPENROUTER_SYSTEM_PROMPT` | **The Core Brain**. This prompt defines who the AI is, what it knows, and how it behaves. | *See "System Prompt" section below.* |
| `OPENROUTER_MAX_TOKENS` | Max length of AI response. | `1000` (avoids cutting off long answers) |
| `OPENROUTER_TEMPERATURE` | Creativity level (0.0 - 1.0). | `0.7` (Balanced) |
| `OPENROUTER_USE_STREAMING` | Enable typewriter effect? | `true` (Recommended for UX) |
| `CHAT_SUGGESTED_QUESTIONS` | **Quick Questions**. Comma-separated list of buttons shown to users. | e.g., "Cost?, Location?" |

### 📧 Email Settings

| Variable | Description | Notes |
| :--- | :--- | :--- |
| `RECIPIENT_EMAIL` | Where contact form submissions are sent. | Admin email address. |
| `SITE_URL` | Application URL (used for AI attribution). | e.g., `http://localhost:3000` |
| `SITE_NAME` | Name of the website/business. | e.g., "Sydney Blue Slips" |

### ⚙️ Server Settings

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Local host port. | `3000` |
| `NODE_ENV` | Environment mode (`development` / `production`). | `development` |

---

## 4. Deep Dive: AI System Implementation

### The System Prompt (`OPENROUTER_SYSTEM_PROMPT`)
This is the most critical configuration for the AI. It instructions the AI on its role.
**Example Structure:**
```text
"You are a helpful AI assistant for [Business Name].
Answer questions about [Services].
Strict rules:
1. Be professional and friendly.
2. For urgent inquiries, tell them to call [Phone Number].
3. Never invent specific pricing if unknown; suggest a quote.
4. Keep answers concise."
```
*Modify this variable in `.env` to change the AI's behavior without touching code.*

### "Quick Questions" (`CHAT_SUGGESTED_QUESTIONS`)
These are the clickable bubbles that appear above the chat input.
**Format in `.env`:**
```bash
CHAT_SUGGESTED_QUESTIONS="How much is a blue slip?,Where are you located?,Do I need a booking?"
```
*The frontend (`public/js/aiChat.js`) requests these from `/api/chat/config` on load to render the buttons dynamically.*

### Streaming Architecture
The app supports **Server-Sent Events (SSE)** for real-time text streaming.
1. **Frontend**: `aiChat.js` opens a connection and listens for `data` chunks.
2. **Backend**: `routes/ai.js` pipes the OpenRouter stream directly to the client, ensuring low latency.
3. **Usage**: set `OPENROUTER_USE_STREAMING=true` in `.env`.

---

## 5. Deep Dive: Email System Implementation

### Logic Flow (`routes/email.js`)
The `POST /api/send-email` endpoint handles two types of submissions:
1. **General Contact**: Triggered by simple contact forms.
2. **Blue Slip Quote**: Triggered when `vehicleType` and `suburb` are present.

### Key Features
- **Validation**: Server-side checks ensure required fields (Name, Email/Phone) are present.
- **Urgency Detection**: If a user selects "Today" or "Tomorrow" in a quote, the email subject gets tagged with `[URGENT]`.
- **Auto-Reply**:
  - If the user provides an email, the system *immediately* sends a "Thank You" HTML email back to them.
  - This is fire-and-forget (asynchronous) so the user doesn't wait.
- **Templates**: HTML templates are currently **embedded directly in `routes/email.js`** using template literals for simplicity.

### How to Modify Email Content
Since templates are inline in `routes/email.js`:
- **Admin Notification**: Search for `const emailContent = ...`
- **Customer Auto-Reply**: Search for `const autoReplyData = ...` inside the `if (email)` block.

---

## 6. Frontend Integration

### Chat Widget (`aiChat.js`)
- Initializes on page load.
- Fetches config (including quick questions) from `/api/chat/config`.
- Handles UI states (open/close, typing indicators, expanding messages).
- Connects to `/api/chat` for messaging.

### Forms (`formHandler.js`)
- Listens for `submit` events on forms with specific IDs (e.g., `#contactForm`, `#quoteForm`).
- Prevents default submission (page reload).
- Gathers form data into a JSON object.
- POSTs to `/api/send-email`.
- Displays success/error messages based on the JSON response.

---

## 7. Developer Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your real API keys
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   # OR
   node server.js
   ```

4. **Verify**:
   - Visit `http://localhost:3000`.
   - Test the Chat: Ensure it responds and suggested questions appear.
   - Test Email: Send a form submission and check your `RECIPIENT_EMAIL` inbox.
