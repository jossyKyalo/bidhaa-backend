const { supabase } = require('../config/supabase');

const getAllProducts = async (req, res, next) => {
    try {
        const { category, search, page = 1, limit = 12 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('products')
            .select('*')
            .eq('is_active', true);

        if (category) {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: products, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) {
            throw error;
        }

        // Get total count for pagination
        let countQuery = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
            
        if (category) {
            countQuery = countQuery.eq('category', category);
        }

        if (search) {
            countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { count: totalProducts, error: countError } = await countQuery;
        
        if (countError) {
            throw countError;
        }

        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            status: 'success',
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalProducts,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();

        if (error || !product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                product
            }
        });
    } catch (error) {
        next(error);
    }
};

const getFeaturedProducts = async (req, res, next) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) {
            throw error;
        }

        res.status(200).json({
            status: 'success',
            data: {
                products
            }
        });
    } catch (error) {
        next(error);
    }
};

const getCategories = async (req, res, next) => {
    try {
        const { data: result, error } = await supabase
            .from('products')
            .select('category')
            .eq('is_active', true)
            .order('category');

        if (error) {
            throw error;
        }

        // Get unique categories
        const categories = [...new Set(result.map(row => row.category))];

        res.status(200).json({
            status: 'success',
            data: {
                categories
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    getFeaturedProducts,
    getCategories
};