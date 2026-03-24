const { pushLog } = require('../utils/logDrain');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        errors = err.errors;
    }

    // MySQL errors
    if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'Duplicate entry. This record already exists.';
    }

    if (err.code === 'ER_NO_REFERENCED_ROW') {
        statusCode = 400;
        message = 'Referenced record not found.';
    }

    if (err.code === 'ER_BAD_NULL_ERROR') {
        statusCode = 400;
        message = 'Required field is missing.';
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token.';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired.';
    }

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        message = `File size too large. Maximum size is ${process.env.MAX_IMAGE_SIZE_KB || 500}KB.`;
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        statusCode = 400;
        message = `Too many files. Maximum is ${process.env.MAX_IMAGES_PER_ROOM || 5} images.`;
    }

    // Send error response
    const response = {
        success: false,
        message,
        ...(errors && { errors }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };

    if (process.env.NODE_ENV === 'production') {
        pushLog({
            event: 'api_error',
            level: statusCode >= 500 ? 'error' : 'warn',
            status: statusCode,
            message,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || (req.connection && req.connection.remoteAddress) || '-',
            stack: err && err.stack ? String(err.stack).split('\n').slice(0, 8).join('\n') : undefined,
            error_code: err && err.code ? err.code : undefined,
        });
    }

    res.status(statusCode).json(response);
};

// Custom error class
class AppError extends Error {
    constructor(message, statusCode, errors = null) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    errorHandler,
    AppError
};
