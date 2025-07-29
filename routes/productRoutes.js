const express = require('express');
const {
    getAllProducts,
    getProductById,
    getFeaturedProducts,
    getCategories
} = require('../controllers/productController');

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/categories', getCategories);
router.get('/:id', getProductById);

module.exports = router;