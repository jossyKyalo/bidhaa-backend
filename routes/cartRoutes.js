const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart
} = require('../controllers/cartController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation middleware
const validateCartItem = [
    body('product_id').notEmpty().withMessage('Product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    handleValidationErrors
];

const validateCartUpdate = [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    handleValidationErrors
];

router.post('/', validateCartItem, addToCart);
router.get('/', getCart);
router.put('/:id', validateCartUpdate, updateCartItem);
router.delete('/:id', removeFromCart);
router.delete('/', clearCart);

module.exports = router;