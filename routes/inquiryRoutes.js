const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateInquiry } = require('../middleware/validation');
const {
    createInquiry,
    getInquiries,
    updateInquiryStatus,
    getInquiryById
} = require('../controllers/inquiryController');

const router = express.Router();

// Public routes
router.post('/', validateInquiry, createInquiry);

// Admin only routes
router.get('/', authenticateToken, requireRole(['admin']), getInquiries);
router.get('/:id', authenticateToken, requireRole(['admin']), getInquiryById);
router.patch('/:id', authenticateToken, requireRole(['admin']), updateInquiryStatus);

module.exports = router;