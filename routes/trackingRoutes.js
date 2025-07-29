const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const {
    getOrderTracking,
    getUserOrderTracking,
    addTrackingUpdate
} = require('../controllers/trackingController');

const router = express.Router();

// Public tracking route (no authentication required)
router.get('/:orderId', getOrderTracking);

// Protected routes
router.get('/user/:orderId', authenticateToken, getUserOrderTracking);

// Admin only routes
const validateTrackingUpdate = [
    body('status').notEmpty().withMessage('Status is required'),
    body('description').optional().trim(),
    handleValidationErrors
];

router.post('/:orderId', 
    authenticateToken, 
    requireRole(['admin']), 
    validateTrackingUpdate, 
    addTrackingUpdate
);

module.exports = router;