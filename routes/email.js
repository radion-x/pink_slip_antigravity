const express = require('express');
const router = express.Router();
const mailgun = require('mailgun-js');

// Initialize Mailgun
const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    host: process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net'
});

/**
 * POST /api/send-email
 * Send contact form emails via Mailgun
 */
router.post('/send-email', async (req, res) => {
    try {
        const { name, email, phone, service, message, suburb, vehicleType, timing, notes } = req.body;

        // Determine if this is a pink slip quote or general contact
        const isBlueSlipQuote = suburb && vehicleType;

        // Validate required fields based on form type
        if (isBlueSlipQuote) {
            // Pink slip quote form validation
            if (!name || !phone || !suburb || !vehicleType) {
                return res.status(400).json({
                    error: 'Name, phone, suburb, and vehicle type are required'
                });
            }
        } else {
            // General contact form validation
            if (!name || !email || !message) {
                return res.status(400).json({
                    error: 'Name, email, and message are required'
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Invalid email format'
                });
            }
        }

        // Build email HTML content
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #E91E63; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                    .field { margin-bottom: 20px; }
                    .label { font-weight: bold; color: #1f2937; margin-bottom: 5px; }
                    .value { background: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .urgent { background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 4px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin: 0;">${isBlueSlipQuote ? '🚗 New Pink Slip Quote Request' : 'New Contact Form Submission'}</h2>
                    </div>
                    <div class="content">
                        <div class="field">
                            <div class="label">Name:</div>
                            <div class="value">${name}</div>
                        </div>
                        ${isBlueSlipQuote ? `
                        <div class="field">
                            <div class="label">Phone:</div>
                            <div class="value"><a href="tel:${phone}">${phone}</a></div>
                        </div>
                        <div class="field">
                            <div class="label">Suburb:</div>
                            <div class="value">${suburb}</div>
                        </div>
                        <div class="field">
                            <div class="label">Vehicle Type:</div>
                            <div class="value">${vehicleType}</div>
                        </div>
                        ${timing ? `
                        <div class="field">
                            <div class="label">Timeframe:</div>
                            <div class="value">${timing}</div>
                        </div>
                        ` : ''}
                        ${notes ? `
                        <div class="field">
                            <div class="label">Additional Notes:</div>
                            <div class="value">${notes.replace(/\n/g, '<br>')}</div>
                        </div>
                        ` : ''}
                        ${timing === 'today' || timing === 'tomorrow' ? `
                        <div class="urgent">
                            <strong>⚡ URGENT:</strong> Customer needs service ${timing}!
                        </div>
                        ` : ''}
                        ` : `
                        <div class="field">
                            <div class="label">Email:</div>
                            <div class="value"><a href="mailto:${email}">${email}</a></div>
                        </div>
                        ${phone ? `
                        <div class="field">
                            <div class="label">Phone:</div>
                            <div class="value"><a href="tel:${phone}">${phone}</a></div>
                        </div>
                        ` : ''}
                        ${service ? `
                        <div class="field">
                            <div class="label">Service Interested In:</div>
                            <div class="value">${service}</div>
                        </div>
                        ` : ''}
                        <div class="field">
                            <div class="label">Message:</div>
                            <div class="value">${message.replace(/\n/g, '<br>')}</div>
                        </div>
                        `}
                    </div>
                    <div class="footer">
                        <p>This email was sent from your website ${isBlueSlipQuote ? 'quote' : 'contact'} form.</p>
                        <p>Received on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Plain text version
        const textContent = isBlueSlipQuote ? `
New Pink Slip Quote Request

Name: ${name}
Phone: ${phone}
Suburb: ${suburb}
Vehicle Type: ${vehicleType}
${timing ? `Timeframe: ${timing}` : ''}
${notes ? `Notes: ${notes}` : ''}

${timing === 'today' || timing === 'tomorrow' ? `⚡ URGENT: Customer needs service ${timing}!\n` : ''}
Received on ${new Date().toLocaleString()}
        ` : `
New Contact Form Submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${service ? `Service: ${service}` : ''}

Message:
${message}

Received on ${new Date().toLocaleString()}
        `;

        // Email data
        const emailData = {
            from: `Pink Slip Sydney <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: process.env.RECIPIENT_EMAIL,
            subject: isBlueSlipQuote
                ? `🚗 Pink Slip Quote: ${name} - ${suburb} (${vehicleType})${timing === 'today' || timing === 'tomorrow' ? ' - URGENT' : ''}`
                : `New Contact: ${name}`,
            html: emailContent,
            text: textContent,
            'h:Reply-To': isBlueSlipQuote ? undefined : email
        };

        // Send email
        await mg.messages().send(emailData);

        // Send auto-reply to customer (only if they provided an email)
        if (email) {
            const autoReplyData = {
                from: `Pink Slip Sydney <noreply@${process.env.MAILGUN_DOMAIN}>`,
                to: email,
                subject: 'Thank you for contacting Pink Slip Sydney',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #E91E63; color: white; padding: 20px; text-align: center; }
                            .content { padding: 30px; background: #f9fafb; }
                            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h2 style="margin: 0;">Thank You for Contacting Pink Slip Sydney!</h2>
                            </div>
                            <div class="content">
                                <p>Hi ${name},</p>
                                <p>Thank you for reaching out to us. We've received your message and will get back to you as soon as possible.</p>
                                <p>For urgent inquiries, feel free to call us directly at <strong>(02) 9516 3366</strong> or SMS <strong>0412 785 767</strong>.</p>
                                <p>Best regards,<br>Pink Slip Sydney Team</p>
                            </div>
                            <div class="footer">
                                <p>This is an automated response. Please do not reply to this email.</p>
                                <p>63-65 Campbell Street, St Peters NSW 2044</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `Hi ${name},\n\nThank you for reaching out to us. We've received your message and will get back to you as soon as possible.\n\nFor urgent inquiries, call (02) 9516 3366 or SMS 0412 785 767.\n\nBest regards,\nPink Slip Sydney Team`
            };

            // Send auto-reply (don't wait for it, send in background)
            mg.messages().send(autoReplyData).catch(err => {
                console.error('Auto-reply error:', err);
            });
        }

        res.status(200).json({
            message: isBlueSlipQuote
                ? 'Thank you! We\'ll contact you shortly with your quote.'
                : 'Thank you! Your message has been sent successfully.',
            success: true
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({
            error: 'Failed to send email. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
