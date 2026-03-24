const nodemailer = require('nodemailer');
const { getSiteSettings, DEFAULT_SITE_SETTINGS } = require('./siteSettings');

const getEmailBranding = async () => {
    try {
        const siteSettings = await getSiteSettings();
        return {
            businessName: siteSettings?.businessName || DEFAULT_SITE_SETTINGS.businessName,
            supportEmail: siteSettings?.supportEmail || process.env.SUPPORT_EMAIL || DEFAULT_SITE_SETTINGS.supportEmail,
        };
    } catch (error) {
        return {
            businessName: process.env.APP_NAME || DEFAULT_SITE_SETTINGS.businessName,
            supportEmail: process.env.SUPPORT_EMAIL || DEFAULT_SITE_SETTINGS.supportEmail,
        };
    }
};

// Create transporter
const createTransporter = () => {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';

    // rejectUnauthorized defaults to TRUE (secure) for production.
    // Set SMTP_TLS_REJECT_UNAUTHORIZED=false only if your SMTP provider
    // uses a self-signed certificate (uncommon with Brevo/SendGrid/Resend).
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 1025,
        secure: process.env.SMTP_SECURE === 'true',
        ...(smtpUser && smtpPass ? {
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        } : {}),
        tls: {
            rejectUnauthorized
        }
    });
};

// Send email helper
const sendEmail = async (options) => {
    try {
        const transporter = createTransporter();
        
        const appName = process.env.APP_NAME || 'RoomRental';
        const supportEmail = process.env.SUPPORT_EMAIL || 'support@example.com';
        // Display name improves deliverability and avoids spam filters
        const defaultFrom = `"${appName}" <${supportEmail}>`;

        const mailOptions = {
            from: options.from || defaultFrom,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || '',
            // Standard headers that improve inbox delivery rates
            headers: {
                'X-Mailer': `${appName} Mailer`,
                'X-Priority': '3'
            },
            ...(options.attachments && { attachments: options.attachments })
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        return { success: false, error: error.message };
    }
};

// Send OTP email
const sendOTPEmail = async (email, otp, name = '') => {
    const { businessName, supportEmail } = await getEmailBranding();

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .otp-box { background-color: #f0f9ff; border: 2px solid #4F46E5; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
                .otp-code { font-size: 42px; font-weight: bold; color: #4F46E5; letter-spacing: 8px; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
                .warning { color: #dc2626; font-size: 13px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name || 'there'},</h2>
                <p>Your One-Time Password (OTP) for verification is:</p>
                
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                </div>
                
                <p>This OTP will expire in <strong>10 minutes</strong>.</p>
                
                <p class="warning">⚠️ Never share this OTP with anyone. Our team will never ask for your OTP.</p>
                
                <div class="footer">
                    <p>If you didn't request this OTP, please ignore this email.</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: supportEmail,
        to: email,
        subject: `Your OTP for ${businessName} Verification`,
        html
    });
};

// Send welcome email
const sendWelcomeEmail = async (email, name, uniqueId, options = {}) => {
    const { businessName, supportEmail } = await getEmailBranding();
    const tempPassword = typeof options.temporaryPassword === 'string' ? options.temporaryPassword.trim() : '';
    const showTempPassword = Boolean(tempPassword);

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .content { line-height: 1.6; }
                .user-id { background-color: #f0f9ff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
                .user-id strong { color: #4F46E5; font-size: 18px; }
                .cta-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <div class="content">
                    <h2>Welcome to ${businessName}, ${name}! 🎉</h2>
                    <p>Thank you for joining our community. We're excited to help you find the perfect room or roommate.</p>
                    
                    <div class="user-id">
                        <p>Your Unique ID</p>
                        <strong>${uniqueId}</strong>
                        <p style="font-size: 12px; color: #6b7280;">Keep this ID safe. You'll need it for support queries.</p>
                        ${showTempPassword ? `
                        <div style="margin-top: 12px; border: 1px solid #f59e0b; background-color: #fffbeb; border-radius: 8px; padding: 10px; text-align: left;">
                            <p style="margin: 0; font-weight: 700; color: #92400e;">Temporary Login Password</p>
                            <p style="margin: 6px 0 0 0; color: #78350f;"><strong>Temp Password:</strong> ${tempPassword}</p>
                            <p style="margin: 6px 0 0 0; color: #b45309; font-size: 12px;">
                                ⚠️ Change this password after first login for better account security.
                            </p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <p>With ${businessName}, you can:</p>
                    <ul>
                        <li>🏠 Post rooms for rent</li>
                        <li>👥 Find roommates</li>
                        <li>💰 Manage expenses with your roommates</li>
                        <li>💬 Chat with potential roommates</li>
                    </ul>

                    <center>
                        <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
                    </center>
                </div>
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: supportEmail,
        to: email,
        subject: `Welcome to ${businessName}! 🏠`,
        html
    });
};

// Send room approval email
const sendRoomApprovalEmail = async (email, name, roomTitle, roomId, status) => {
    const { businessName, supportEmail } = await getEmailBranding();

    const statusColors = {
        'Approved': '#22c55e',
        'Hold': '#f59e0b',
        'Rejected': '#ef4444'
    };

    const statusMessages = {
        'Approved': 'Your room listing has been approved and is now live! 🎉',
        'Hold': 'Your room listing is on hold. Please check the admin remarks.',
        'Rejected': 'Your room listing was rejected. Please check the admin remarks.'
    };

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .status-box { background-color: ${statusColors[status] || '#6b7280'}15; border: 2px solid ${statusColors[status] || '#6b7280'}; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .status-text { color: ${statusColors[status] || '#6b7280'}; font-size: 20px; font-weight: bold; }
                .room-details { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .cta-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name},</h2>
                
                <div class="status-box">
                    <div class="status-text">${status}</div>
                </div>
                
                <p>${statusMessages[status]}</p>
                
                <div class="room-details">
                    <p><strong>Room Title:</strong> ${roomTitle}</p>
                    <p><strong>Room ID:</strong> ${roomId}</p>
                </div>
                
                ${status === 'Approved' ? `
                <center>
                    <a href="${process.env.FRONTEND_URL}/room/${roomId}" class="cta-button">View Your Listing</a>
                </center>
                ` : ''}
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: process.env.NOTIFICATION_EMAIL || 'contact@weeb.comm',
        to: email,
        subject: `Room Listing ${status} - ${businessName}`,
        html
    });
};

// Send broker approval email
const sendBrokerApprovalEmail = async (email, name, status, remark = '') => {
    const { businessName, supportEmail } = await getEmailBranding();

    const statusColors = {
        'Approved': '#22c55e',
        'Hold': '#f59e0b',
        'Rejected': '#ef4444'
    };

    const statusMessages = {
        'Approved': 'Congratulations! Your broker account has been approved. 🎉',
        'Hold': 'Your broker account application is on hold.',
        'Rejected': 'Your broker account application was rejected.'
    };

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .status-box { background-color: ${statusColors[status] || '#6b7280'}15; border: 2px solid ${statusColors[status] || '#6b7280'}; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .status-text { color: ${statusColors[status] || '#6b7280'}; font-size: 20px; font-weight: bold; }
                .remark-box { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .cta-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name},</h2>
                
                <div class="status-box">
                    <div class="status-text">${status}</div>
                </div>
                
                <p>${statusMessages[status]}</p>
                
                ${remark ? `
                <div class="remark-box">
                    <p><strong>Admin Remark:</strong></p>
                    <p>${remark}</p>
                </div>
                ` : ''}
                
                ${status === 'Approved' ? `
                <center>
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
                </center>
                ` : ''}
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: process.env.NOTIFICATION_EMAIL || 'contact@weeb.comm',
        to: email,
        subject: `Broker Account ${status} - ${businessName}`,
        html
    });
};

const sendSubscriptionDecisionEmail = async (email, name, status, remark = '', planName = '', startsAt = '', expiresAt = '') => {
    const { businessName, supportEmail } = await getEmailBranding();

    const isApproved = status === 'Approved';
    const statusColor = isApproved ? '#22c55e' : '#ef4444';
    const statusMessage = isApproved
        ? 'Your subscription upgradation request has been approved.'
        : 'Your subscription upgradation request has been rejected.';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .status-box { background-color: ${statusColor}15; border: 2px solid ${statusColor}; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .status-text { color: ${statusColor}; font-size: 20px; font-weight: bold; }
                .details-box { background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; }
                .remark-box { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                <h2>Hello ${name || 'there'},</h2>
                <div class="status-box">
                    <div class="status-text">${status}</div>
                </div>
                <p>${statusMessage}</p>
                ${(planName || startsAt || expiresAt) ? `
                <div class="details-box">
                    ${planName ? `<p><strong>Plan:</strong> ${planName}</p>` : ''}
                    ${startsAt ? `<p><strong>Start Date:</strong> ${startsAt}</p>` : ''}
                    ${expiresAt ? `<p><strong>Expiry Date:</strong> ${expiresAt}</p>` : ''}
                </div>` : ''}
                ${remark ? `
                <div class="remark-box">
                    <p><strong>Admin Remark:</strong></p>
                    <p>${remark}</p>
                </div>` : ''}
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: process.env.NOTIFICATION_EMAIL || 'contact@weeb.comm',
        to: email,
        subject: `Subscription Request ${status} - ${businessName}`,
        html
    });
};

// Send roommate invitation email
const sendRoommateInviteEmail = async (email, name, invitedBy, groupId, inviteToken, roomName = '') => {
    const { businessName, supportEmail } = await getEmailBranding();

    const inviteLink = `${process.env.FRONTEND_URL}/accept-invite?token=${inviteToken}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .invite-box { background-color: #f0f9ff; border: 2px solid #4F46E5; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
                .cta-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name || 'there'},</h2>
                
                <p>${invitedBy} has invited you to join their roommate group on ${businessName}.</p>
                
                <div class="invite-box">
                    <p>Room Name: <strong>${roomName || `Room ${groupId}`}</strong></p>
                    <p>Room ID: <strong>${groupId}</strong></p>
                    <p>Join to manage expenses and stay connected!</p>
                </div>
                
                <center>
                    <a href="${inviteLink}" class="cta-button">Accept Invitation</a>
                </center>
                
                <p style="font-size: 12px; color: #6b7280; text-align: center;">
                    If the button doesn't work, copy this link: ${inviteLink}
                </p>
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: supportEmail,
        to: email,
        subject: `Roommate Invitation - ${businessName}`,
        html
    });
};

// Send expense notification email
const sendExpenseNotificationEmail = async (email, name, expenseTitle, amount, dueDate, paidBy) => {
    const { businessName, supportEmail } = await getEmailBranding();

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .expense-box { background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0; }
                .amount { font-size: 32px; font-weight: bold; color: #dc2626; }
                .cta-button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name},</h2>
                
                <p>You have a pending expense to settle:</p>
                
                <div class="expense-box">
                    <p><strong>${expenseTitle}</strong></p>
                    <p class="amount">₹${amount}</p>
                    <p>Paid by: ${paidBy}</p>
                    ${dueDate ? `<p>Due Date: ${dueDate}</p>` : ''}
                </div>
                
                <center>
                    <a href="${process.env.FRONTEND_URL}/dashboard/expenses" class="cta-button">View Expenses</a>
                </center>
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: process.env.NOTIFICATION_EMAIL || 'contact@weeb.comm',
        to: email,
        subject: `Pending Expense Notification - ${businessName}`,
        html
    });
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, resetToken) => {
    const { businessName, supportEmail } = await getEmailBranding();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { font-size: 28px; font-weight: bold; color: #4F46E5; }
                .cta-button { display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .warning { color: #dc2626; font-size: 13px; margin-top: 20px; }
                .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🏠 ${businessName}</div>
                </div>
                
                <h2>Hello ${name || 'there'},</h2>
                
                <p>We received a request to reset your password. Click the button below to reset it:</p>
                
                <center>
                    <a href="${resetLink}" class="cta-button">Reset Password</a>
                </center>
                
                <p class="warning">⚠️ This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
                
                <div class="footer">
                    <p>Need help? Contact us at ${supportEmail}</p>
                    <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendEmail({
        from: supportEmail,
        to: email,
        subject: `Password Reset Request - ${businessName}`,
        html
    });
};

module.exports = {
    getEmailBranding,
    sendEmail,
    sendOTPEmail,
    sendWelcomeEmail,
    sendRoomApprovalEmail,
    sendBrokerApprovalEmail,
    sendSubscriptionDecisionEmail,
    sendRoommateInviteEmail,
    sendExpenseNotificationEmail,
    sendPasswordResetEmail
};
