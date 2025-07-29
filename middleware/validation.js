const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

const validateRegistration = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Name must be between 2 and 255 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Valid phone number is required'),
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

const validateProduct = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('Product name is required'),
    body('price')
        .isFloat({ min: 0.01 })
        .withMessage('Price must be a positive number'),
    body('category')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Category is required'),
    body('stock')
        .isInt({ min: 0 })
        .withMessage('Stock must be a non-negative integer'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),
    body('image_url')
        .optional()
        .isURL()
        .withMessage('Valid image URL is required'),
    handleValidationErrors
];

const validateOrder = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Order must contain at least one item'),
    body('items.*.product_id')
        .notEmpty()
        .withMessage('Product ID is required for each item'),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be a positive integer'),
    body('payment_method')
        .isIn(['mpesa', 'card', 'cash'])
        .withMessage('Valid payment method is required'),
    body('customer_phone')
        .isMobilePhone()
        .withMessage('Valid customer phone number is required'),
    handleValidationErrors
];

const validateInquiry = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Name must be between 2 and 255 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('phone')
        .isMobilePhone()
        .withMessage('Valid phone number is required'),
    body('subject')
        .isIn(['product', 'order', 'technical', 'partnership', 'general'])
        .withMessage('Valid subject is required'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Message must be between 10 and 2000 characters'),
    body('order_id')
        .optional()
        .trim()
        .isLength({ min: 1 })
        .withMessage('Order ID must be valid if provided'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateRegistration,
    validateLogin,
    validateProduct,
    validateOrder,
    validateInquiry
};