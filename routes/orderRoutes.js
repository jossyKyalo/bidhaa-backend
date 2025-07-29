const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validation');
const {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder
} = require('../controllers/orderController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', validateOrder, createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);
router.patch('/:id/cancel', cancelOrder);

module.exports = router;