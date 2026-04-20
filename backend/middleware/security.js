const validator = require('validator');
const rateLimit = require('express-rate-limit');

/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeInput = (input, skipSanitization = false) => {
    // Skip sanitization for URL arrays and certain fields
    if (skipSanitization) {
        return input;
    }
    
    if (typeof input === 'string') {
        // Don't escape URLs (check if string looks like a URL)
        if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('/uploads/')) {
            return input.trim();
        }
        // Escape HTML entities for other strings
        return validator.escape(input.trim());
    }
    if (Array.isArray(input)) {
        // Check if array contains URLs - if so, don't sanitize
        const isUrlArray = input.length > 0 && input.every(item => 
            typeof item === 'string' && 
            (item.startsWith('http://') || item.startsWith('https://') || item.startsWith('/uploads/'))
        );
        
        if (isUrlArray) {
            return input; // Return URL arrays as-is
        }
        
        // Sanitize array elements
        return input.map(item => sanitizeInput(item));
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            // Skip sanitization for specific fields that contain URLs or JSON data
            const skipFields = ['images', 'profileImage', 'profile_image', 'meta_data', 'metadata'];
            sanitized[key] = sanitizeInput(value, skipFields.includes(key));
        }
        return sanitized;
    }
    return input;
};

/**
 * Middleware to sanitize request body
 */
const sanitizeRequestBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeInput(req.body);
    }
    next();
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    return validator.isEmail(email) && email.length <= 255;
};

/**
 * Validate password strength
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const isStrongPassword = (password) => {
    return validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 0
    });
};

/**
 * Validate phone number
 */
const isValidPhone = (phone) => {
    return validator.isMobilePhone(phone, 'any');
};

/**
 * Strict rate limiter for authentication endpoints
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    skipSuccessfulRequests: true,
    skip: (req) => req.method === 'OPTIONS',
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 15 minutes.'
    }
});

/**
 * Rate limiter for API endpoints
 */
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try again later.'
    }
});

/**
 * Strict rate limiter for sensitive operations
 */
const sensitiveOperationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: {
        success: false,
        message: 'Too many sensitive operations. Please try again later.'
    }
});

/**
 * Prevent SQL injection by validating IDs
 */
const isValidId = (id) => {
    return validator.isInt(String(id), { min: 1 });
};

/**
 * Prevent NoSQL injection
 */
const sanitizeMongoQuery = (query) => {
    if (typeof query === 'string') {
        return query.replace(/[$.]/g, '');
    }
    return query;
};

/**
 * Content Security Policy headers
 */
const setSecurityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict transport security (HSTS)
    // max-age: 1 year in seconds (31536000)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Referrer policy - send referrer only to same origin
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy - disable dangerous APIs
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    
    // Prevent DNS prefetching (privacy)
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Reduce cross-origin attack surface for modern browsers.
    // cross-origin is required: frontend (Vercel) and backend (Render) are on different origins.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Disable caching for sensitive pages
    if (req.path.includes('/admin') || req.path.includes('/dashboard') || req.path.includes('/auth')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
};

/**
 * Validate file upload
 */
const isValidFileUpload = (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!file) return false;
    if (!allowedTypes.includes(file.mimetype)) return false;
    if (file.size > maxSize) return false;
    
    return true;
};

/**
 * Sanitize filename to prevent path traversal
 */
const sanitizeFilename = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '_')
        .substring(0, 255);
};

/**
 * Prevent parameter pollution
 */
const preventParameterPollution = (req, res, next) => {
    // Ensure query parameters are not arrays (unless expected)
    for (const [key, value] of Object.entries(req.query)) {
        if (Array.isArray(value) && value.length > 0) {
            req.query[key] = value[0];
        }
    }
    next();
};

/**
 * Validate UUID format
 */
const isValidUUID = (uuid) => {
    return validator.isUUID(uuid);
};

/**
 * Detect and block common attack patterns
 */
const detectAttackPatterns = (req, res, next) => {
    const suspiciousPatterns = [
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
        /union[\s\S]+select/gi,
        /drop[\s\S]+table/gi,
        /insert[\s\S]+into/gi,
        /delete[\s\S]+from/gi,
        /\.\.\/\.\.\//gi // Path traversal
    ];
    
    const requestString = JSON.stringify({
        body: req.body,
        query: req.query,
        params: req.params
    });
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
            return res.status(403).json({
                success: false,
                message: 'Suspicious activity detected. Request blocked.'
            });
        }
    }
    
    next();
};

module.exports = {
    sanitizeInput,
    sanitizeRequestBody,
    isValidEmail,
    isStrongPassword,
    isValidPhone,
    authRateLimiter,
    apiRateLimiter,
    sensitiveOperationLimiter,
    isValidId,
    sanitizeMongoQuery,
    setSecurityHeaders,
    isValidFileUpload,
    sanitizeFilename,
    preventParameterPollution,
    isValidUUID,
    detectAttackPatterns
};
