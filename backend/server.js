const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection, ensureAutoIncrementOnPrimaryIds } = require('./config/database');
const { initializeSupabase } = require('./config/supabase');

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

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

const hasConfiguredVercelOrigin = allowedOrigins.some((origin) => origin.endsWith('.vercel.app'));

const isAllowedOrigin = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }

    if (allowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    if (hasConfiguredVercelOrigin && normalizedOrigin.endsWith('.vercel.app')) {
        return true;
    }

    return false;
};

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

if (process.env.NODE_ENV !== 'development') {
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
app.use(morgan('dev'));
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
    const dbConnected = await testConnection();
    res.json({
        success: true,
        message: 'Server is running',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
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
        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.warn('⚠️  Database not connected. Some features may not work.');
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

        // Initialize Supabase
        initializeSupabase();

        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
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
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

startServer();
