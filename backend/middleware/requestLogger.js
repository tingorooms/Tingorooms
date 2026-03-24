const isProduction = process.env.NODE_ENV === 'production';
const { pushLog } = require('../utils/logDrain');

/**
 * Request logger middleware.
 *
 * Development: human-readable coloured lines.
 * Production : structured JSON per request, compatible with
 *              Better Stack (Logtail), Datadog, and Render log drains.
 *
 * Sensitive fields (password, token, otp) are never logged.
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        if (isProduction) {
            // Structured JSON log — parsed automatically by log aggregators
            const entry = {
                timestamp: new Date().toISOString(),
                level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
                method: req.method,
                url: req.originalUrl,
                status,
                duration_ms: duration,
                ip: req.ip || (req.connection && req.connection.remoteAddress) || '-',
                user_agent: req.headers['user-agent'] || '-'
            };
            console.log(JSON.stringify(entry));
            pushLog({
                event: 'http_request',
                ...entry
            });
        } else {
            // Dev: readable one-liner
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.originalUrl} -> ${status} (${duration}ms)`);
        }
    });

    next();
};

module.exports = { requestLogger };
