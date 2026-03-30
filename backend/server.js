const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { nodeEnv, isProduction, isRailwayRuntime } = require('./config/env');
const { testConnection, ensureAutoIncrementOnPrimaryIds, dbConfigSummary } = require('./config/database');
const { initializeSupabase } = require('./config/supabase');
const { startKeepAlive } = require('./utils/keepAlive');
const { pushLog } = require('./utils/logDrain');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const expenseRoutes = require('./routes/expenses');
const roommateRoutes = require('./routes/roommates');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const notificationRoutes = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscriptions');
const seoRoutes = require('./routes/seo');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { 
    setSecurityHeaders, 
    sanitizeRequestBody, 
    preventParameterPollution,
    detectAttackPatterns 
} = require('./middleware/security');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

const isTruthy = (value) => String(value || '').toLowerCase() === 'true';

const withTimeout = async (promise, timeoutMs, fallbackValue = false) => {
    let timeoutId;
    try {
        const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
        });
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

const buildIntegrationSelfCheck = async () => {
    const dbConnected = await testConnection();

    const imageProvider = String(process.env.IMAGE_STORAGE_PROVIDER || 'imgbb').toLowerCase();
    const dbHost = String(dbConfigSummary.host || process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || '');
    const smtpHost = String(process.env.SMTP_HOST || '').toLowerCase();
    const siteUrl = String(process.env.SITE_URL || '');

    const checks = {
        database_connected: {
            active: dbConnected,
            details: dbConnected ? 'Database connection OK' : 'Database connection failed'
        },
        planetscale_configured: {
            active: Boolean(dbConfigSummary.host && dbConfigSummary.user && dbConfigSummary.database),
            details: dbHost.includes('psdb.cloud') ? 'Planetscale host detected' : 'Generic MySQL host configured'
        },
        planetscale_auto_backups: {
            active: dbHost.includes('psdb.cloud'),
            details: dbHost.includes('psdb.cloud')
                ? 'Planetscale managed backups are provider-side'
                : 'Unknown provider; verify backup policy in DB dashboard'
        },
        supabase_realtime: {
            active: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
            details: process.env.SUPABASE_URL ? 'Supabase URL and anon key configured' : 'Supabase credentials missing'
        },
        supabase_admin_key: {
            active: Boolean(process.env.SUPABASE_SERVICE_KEY),
            details: process.env.SUPABASE_SERVICE_KEY ? 'Service role key configured' : 'Service role key missing'
        },
        keep_alive_scheduler: {
            active: nodeEnv === 'production',
            details: nodeEnv === 'production'
                ? `Keep-alive enabled with cron: ${process.env.KEEP_ALIVE_CRON || '15 3 * * *'}`
                : 'Enabled only in production'
        },
        image_storage: {
            active: (
                (imageProvider === 'r2' && Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME)) ||
                (imageProvider === 'imgbb' && Boolean(process.env.IMAGE_STORAGE_API_KEY))
            ),
            details: imageProvider === 'r2'
                ? 'Cloudflare R2 provider selected'
                : 'ImgBB provider selected'
        },
        log_drain_better_stack: {
            active: isTruthy(process.env.ENABLE_LOG_DRAIN) && Boolean(process.env.LOGTAIL_SOURCE_TOKEN || process.env.BETTER_STACK_SOURCE_TOKEN),
            details: isTruthy(process.env.ENABLE_LOG_DRAIN)
                ? 'Better Stack log drain enabled'
                : 'Log drain disabled'
        },
        email_brevo_smtp: {
            active: smtpHost.includes('brevo') && Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
            details: smtpHost.includes('brevo')
                ? 'Brevo SMTP host configured'
                : 'SMTP host is not Brevo (smtp-relay.brevo.com expected)'
        },
        email_spf_configured: {
            active: isTruthy(process.env.SMTP_SPF_CONFIGURED),
            details: isTruthy(process.env.SMTP_SPF_CONFIGURED) ? 'SPF marked configured' : 'SPF not marked configured'
        },
        email_dkim_configured: {
            active: isTruthy(process.env.SMTP_DKIM_CONFIGURED),
            details: isTruthy(process.env.SMTP_DKIM_CONFIGURED) ? 'DKIM marked configured' : 'DKIM not marked configured'
        },
        cloudflare_cdn_expected: {
            active: siteUrl.includes('.vercel.app') || siteUrl.includes('http'),
            details: 'CDN is configured via DNS/provider; validate domain proxy in Cloudflare dashboard'
        }
    };

    const requiredInProduction = [
        'database_connected',
        'supabase_realtime',
        'image_storage',
        'email_brevo_smtp',
        'email_spf_configured',
        'email_dkim_configured'
    ];

    const failedRequired = requiredInProduction.filter((key) => !checks[key].active);
    const productionReady = nodeEnv !== 'production' ? null : failedRequired.length === 0;

    return {
        environment: nodeEnv,
        production_ready: productionReady,
        failed_required_checks: failedRequired,
        checks,
        timestamp: new Date().toISOString()
    };
};

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'https://i.ibb.co', 'https://ibb.co'],
            connectSrc: ["'self'", 'https://nominatim.openstreetmap.org', 'https://www.google-analytics.com'],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Custom security headers
app.use(setSecurityHeaders);

// Prevent parameter pollution
app.use(preventParameterPollution);

// Detect and block attack patterns
app.use(detectAttackPatterns);

// CORS configuration
const normalizeOrigin = (origin) => {
    if (!origin || typeof origin !== 'string') {
        return '';
    }

    const trimmedOrigin = origin.trim();
    if (!trimmedOrigin) {
        return '';
    }

    const withProtocol = /^https?:\/\//i.test(trimmedOrigin)
        ? trimmedOrigin
        : `https://${trimmedOrigin}`;

    try {
        return new URL(withProtocol).origin;
    } catch (error) {
        return '';
    }
};

const rawFrontendUrls = process.env.FRONTEND_URL || (isProduction ? '' : 'http://localhost:5173');
const allowedOrigins = rawFrontendUrls
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

const allowAnyVercel = allowedOrigins.length === 0 || allowedOrigins.some((origin) => origin.endsWith('.vercel.app'));

if (isProduction && !process.env.FRONTEND_URL) {
    console.warn('⚠️ FRONTEND_URL is not configured in production. Allowing Vercel origins by wildcard until FRONTEND_URL is set.');
}

const isAllowedOrigin = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }

    if (allowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    if (allowAnyVercel && normalizedOrigin.endsWith('.vercel.app')) {
        return true;
    }

    return false;
};

console.log('🎯 CORS allowed origins:', allowedOrigins);
console.log('🎯 CORS allow any Vercel origin:', allowAnyVercel);

const corsOptions = {
    origin(origin, callback) {
        if (!origin || isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Integration-Check-Token'],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
    const requestPath = req.originalUrl || '';

    if (requestPath.length > 2048) {
        return res.status(414).json({
            success: false,
            message: 'Request URL too long'
        });
    }

    if (/\.\.|%2e%2e|\\/i.test(requestPath)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid request path'
        });
    }

    next();
});

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});

if (nodeEnv !== 'development') {
    app.use(limiter);
}

const authLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

const publicLimiter = rateLimit({
    windowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: {
        success: false,
        message: 'Too many requests. Please slow down and try again.'
    }
});

// Reduce risk from hanging sockets and resource exhaustion.
app.use((req, res, next) => {
    const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 60000;
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs);
    next();
});

// Body parsing middleware
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: process.env.REQUEST_BODY_LIMIT || '2mb', parameterLimit: 1000 }));

// Sanitize request body to prevent XSS
app.use(sanitizeRequestBody);

// Compression middleware
app.use(compression());

// Logging middleware
if (!isProduction) {
    app.use(morgan('dev'));
}
app.use(requestLogger);

// Static files for uploads
app.use('/uploads', express.static('uploads', {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    maxAge: '7d',
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
}));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const dbConnected = await withTimeout(
        testConnection(),
        Number(process.env.DB_HEALTHCHECK_TIMEOUT_MS || 3000),
        false
    );
    const mem = process.memoryUsage();
    res.json({
        success: true,
        message: 'Server is running',
        database: dbConnected ? 'connected' : 'disconnected',
        environment: nodeEnv,
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb: {
            rss: Math.round(mem.rss / 1024 / 1024),
            heap_used: Math.round(mem.heapUsed / 1024 / 1024),
            heap_total: Math.round(mem.heapTotal / 1024 / 1024)
        },
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Startup integration self-check endpoint (optional token-gated)
app.get('/api/startup/self-check', async (req, res, next) => {
    try {
        const configuredToken = process.env.INTEGRATION_CHECK_TOKEN;
        const providedToken = req.headers['x-integration-check-token'] || req.query.token;

        if (configuredToken && providedToken !== configuredToken) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: invalid integration check token'
            });
        }

        const data = await buildIntegrationSelfCheck();
        return res.json({
            success: true,
            message: 'Startup integration self-check completed',
            data
        });
    } catch (error) {
        return next(error);
    }
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/roommates', roommateRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicLimiter, publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use(seoRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Room Rental & Expense Management System API',
        version: '1.0.0',
        documentation: '/api/docs'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
    try {
        console.log('🚀 Starting backend server...');
        console.log(`📌 NODE_ENV=${nodeEnv}`);
        console.log(`📌 PORT=${PORT}`);
        console.log(`📌 FRONTEND_URL=${process.env.FRONTEND_URL || 'not configured'}`);
        console.log(`📌 Database config source: ${dbConfigSummary.configSource}`);
        console.log(`📌 DB_HOST=${dbConfigSummary.host || 'not configured'}, DB_NAME=${dbConfigSummary.database || 'not configured'}`);

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${nodeEnv}`);
            console.log(`🔗 API URL: http://localhost:${PORT}/api`);
            console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
            console.log('\n📋 Available Endpoints:');
            console.log('   • Auth:       /api/auth');
            console.log('   • Users:      /api/users');
            console.log('   • Rooms:      /api/rooms');
            console.log('   • Expenses:   /api/expenses');
            console.log('   • Roommates:  /api/roommates');
            console.log('   • Chat:       /api/chat');
            console.log('   • Admin:      /api/admin');
            console.log('   • Public:     /api/public');
            console.log('   • Health:     /api/health\n');
        });

        // Run integrations after server is already listening to avoid startup timeouts.
        setImmediate(async () => {
            try {
                const dbConnected = await withTimeout(
                    testConnection(),
                    Number(process.env.DB_STARTUP_TIMEOUT_MS || 7000),
                    false
                );

                if (!dbConnected) {
                    console.warn('⚠️  Database not connected on startup check. App is running, but DB-backed features may fail until connection works.');
                } else {
                    try {
                        const result = await ensureAutoIncrementOnPrimaryIds();
                        if (result.updated.length > 0) {
                            console.log(`🛠️  AUTO_INCREMENT repaired for id columns: ${result.updated.join(', ')}`);
                        }
                    } catch (repairError) {
                        console.warn(`⚠️  AUTO_INCREMENT repair skipped: ${repairError.message}`);
                    }
                }

                initializeSupabase();

                if (isProduction) {
                    const hasSmtpUser = Boolean(process.env.SMTP_USER);
                    const hasSmtpPass = Boolean(process.env.SMTP_PASS);
                    const spfConfigured = process.env.SMTP_SPF_CONFIGURED === 'true';
                    const dkimConfigured = process.env.SMTP_DKIM_CONFIGURED === 'true';

                    if (hasSmtpUser && hasSmtpPass && (!spfConfigured || !dkimConfigured)) {
                        console.warn('⚠️  Email DNS records not fully marked as configured. Set SMTP_SPF_CONFIGURED=true and SMTP_DKIM_CONFIGURED=true after adding DNS records.');
                    }

                    startKeepAlive();
                }
            } catch (startupError) {
                console.error('⚠️  Post-start initialization failed:', startupError.message);
            }
        });

        // Graceful shutdown — Railway sends SIGTERM on deploy/restart
        const gracefulShutdown = (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('✅ HTTP server closed');
                process.exit(0);
            });
            // Force exit if server.close() hangs beyond 10 seconds
            setTimeout(() => {
                console.error('⏰ Forced shutdown after 10s timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    pushLog({
        event: 'unhandled_rejection',
        level: 'error',
        message: err && err.message ? err.message : 'Unhandled Promise Rejection',
        stack: err && err.stack ? String(err.stack).split('\n').slice(0, 10).join('\n') : undefined,
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    pushLog({
        event: 'uncaught_exception',
        level: 'error',
        message: err && err.message ? err.message : 'Uncaught Exception',
        stack: err && err.stack ? String(err.stack).split('\n').slice(0, 10).join('\n') : undefined,
    });
    process.exit(1);
});

startServer();
