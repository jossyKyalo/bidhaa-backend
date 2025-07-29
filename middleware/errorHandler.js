const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let error = {
        status: 'error',
        message: err.message || 'Internal server error'
    };

    // PostgreSQL specific errors
    if (err.code) {
        switch (err.code) {
            case '23505': // Unique violation
                error.message = 'Resource already exists';
                error.statusCode = 409;
                break;
            case '23503': // Foreign key violation
                error.message = 'Referenced resource not found';
                error.statusCode = 400;
                break;
            case '23514': // Check violation
                error.message = 'Invalid data provided';
                error.statusCode = 400;
                break;
            default:
                error.message = 'Database error occurred';
                error.statusCode = 500;
        }
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error.message = 'Invalid token';
        error.statusCode = 401;
    } else if (err.name === 'TokenExpiredError') {
        error.message = 'Token expired';
        error.statusCode = 401;
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        error.message = 'Validation failed';
        error.statusCode = 400;
    }

    const statusCode = error.statusCode || err.statusCode || 500;

    res.status(statusCode).json({
        status: 'error',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;