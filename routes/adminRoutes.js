const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const {
    createProduct,
    updateProduct,
    deleteProduct,
    getAllOrders,
    updateOrderStatus,
    getDashboardStats,
    getAllCustomers
} = require('../controllers/adminController');
const { getAllProducts } = require('../controllers/productController');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Product management
router.get('/products', getAllProducts);
router.post('/products', validateProduct, createProduct);
router.put('/products/:id', validateProduct, updateProduct);
router.delete('/products/:id', deleteProduct);

// Order management
router.get('/orders', getAllOrders);

const validateOrderStatus = [
    body('status')
        .isIn(['Processing', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'])
        .withMessage('Valid order status is required'),
    handleValidationErrors
];

router.patch('/orders/:id/status', validateOrderStatus, updateOrderStatus);

// Customer management
router.get('/customers', getAllCustomers);


module.exports = router;