const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const {
    initiateMpesaPayment,
    checkPaymentStatus,
    mpesaCallback,
    getTransactionHistory,
    getTransactionByOrderId,
    getAllTransactions
} = require('../controllers/paymentController');

const router = express.Router();

// Validation middleware for M-Pesa payment
const validateMpesaPayment = [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('phoneNumber').isMobilePhone().withMessage('Valid phone number is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
    handleValidationErrors
];

// Public routes
router.post('/mpesa/callback', mpesaCallback); // M-Pesa callback endpoint (no auth required)

// Protected routes
router.post('/mpesa/initiate', authenticateToken, validateMpesaPayment, initiateMpesaPayment);
router.get('/mpesa/status/:checkoutRequestId', authenticateToken, checkPaymentStatus);
router.get('/transactions', authenticateToken, getTransactionHistory);
router.get('/transactions/order/:orderId', authenticateToken, getTransactionByOrderId);

// Admin routes
router.get('/admin/transactions', authenticateToken, requireRole(['admin']), getAllTransactions);

module.exports = router;