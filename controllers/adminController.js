const { supabase } = require('../config/supabase');

const generateProductId = () => {
    return 'PRD' + Date.now().toString().slice(-6);
};

// Product Management
const createProduct = async (req, res, next) => {
    try {
        const { name, description, price, category, stock, image_url } = req.body;
        const productId = generateProductId();

        const { data: product, error } = await supabase
            .from('products')
            .insert([{
                id: productId,
                name,
                description,
                price,
                category,
                stock,
                image_url
            }])
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            status: 'success',
            message: 'Product created successfully',
            data: {
                product: product
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, stock, image_url } = req.body;

        const { data: product, error } = await supabase
            .from('products')
            .update({
                name,
                description,
                price,
                category,
                stock,
                image_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Product updated successfully',
            data: {
                product: product
            }
        });
    } catch (error) {
        next(error);
    }
};

const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: product, error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', id)
            .select('id')
            .single();

        if (error || !product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Product deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Order Management
const getAllOrders = async (req, res, next) => {
    try {
        const { status, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`id.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
        }

        // Apply pagination
        query = query.range(offset, offset + parseInt(limit) - 1);

        const { data: orders, error: ordersError } = await query;
        if (ordersError) {
            throw ordersError;
        }

        // Get order items for each order
        const ordersWithItems = await Promise.all(
            orders.map(async (order) => {
                const { data: items, error: itemsError } = await supabase
                    .from('order_items')
                    .select('*')
                    .eq('order_id', order.id);

                if (itemsError) {
                    console.error('Error fetching order items:', itemsError);
                    return { ...order, items: [] };
                }

                return { ...order, items: items || [] };
            })
        );

        res.status(200).json({
            status: 'success',
            data: {
                orders: ordersWithItems
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Update order status
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .update({ 
                status, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .select()
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Add tracking entry
        let description = '';
        switch (status) {
            case 'Confirmed':
                description = 'Your order has been confirmed and is being prepared';
                break;
            case 'Shipped':
                description = 'Your order has been shipped and is on its way';
                break;
            case 'Delivered':
                description = 'Your order has been delivered successfully';
                break;
            case 'Cancelled':
                description = 'Your order has been cancelled';
                break;
            default:
                description = `Order status updated to ${status}`;
        }

        const { error: trackingError } = await supabase
            .from('order_tracking')
            .insert([{
                order_id: id,
                status,
                description
            }]);

        if (trackingError) {
            console.error('Error adding tracking entry:', trackingError);
        }

        res.status(200).json({
            status: 'success',
            message: 'Order status updated successfully',
            data: {
                order: order
            }
        });
    } catch (error) {
        next(error);
    }
};

// Dashboard Statistics
const getDashboardStats = async (req, res, next) => {
    try {
        // Get total products with proper error handling
        const { count: totalProducts, error: productsError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (productsError) {
            console.error('Error fetching products count:', productsError);
        }

        // Get total orders
        const { count: totalOrders, error: ordersError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            console.error('Error fetching orders count:', ordersError);
        }

        // Get total revenue (orders that are not cancelled)
        const { data: revenueOrders, error: revenueError } = await supabase
            .from('orders')
            .select('total_amount')
            .neq('status', 'Cancelled');

        if (revenueError) {
            console.error('Error fetching revenue:', revenueError);
        }

        const totalRevenue = revenueOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

        // Get pending orders
        const { count: pendingOrders, error: pendingError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Processing');

        if (pendingError) {
            console.error('Error fetching pending orders:', pendingError);
        }

        // Get recent orders
        const { data: recentOrders, error: recentError } = await supabase
            .from('orders')
            .select('id, customer_name, total_amount, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) {
            console.error('Error fetching recent orders:', recentError);
        }

        res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalProducts: totalProducts || 0,
                    totalOrders: totalOrders || 0,
                    totalRevenue: totalRevenue,
                    pendingOrders: pendingOrders || 0
                },
                recentOrders: recentOrders || []
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        next(error);
    }
};

// Customer Management
const getAllCustomers = async (req, res, next) => {
    try {
        // Get all customers
        const { data: customers, error: customersError } = await supabase
            .from('users')
            .select('id, name, email, phone, address, created_at')
            .eq('role', 'customer')
            .order('created_at', { ascending: false });

        if (customersError) {
            throw customersError;
        }

        // Get order statistics for each customer
        const customersWithStats = await Promise.all(
            (customers || []).map(async (customer) => {
                const { data: orders, error: ordersError } = await supabase
                    .from('orders')
            }
            )
        )
        const ordersWithItems = await Promise.all(
            (orders || []).map(async (order) => {

                if (ordersError) {
                    console.error('Error fetching customer orders:', ordersError);
                    return {
                        ...customer,
                        total_orders: 0,
                        total_spent: 0
                    };
                }

                const totalOrders = orders?.length || 0;
                const totalSpent = orders?.reduce((sum, order) => {
                    return order.status !== 'Cancelled' ? sum + (order.total_amount || 0) : sum;
                }, 0) || 0;

                return {
                    ...customer,
                    total_orders: totalOrders,
                    total_spent: totalSpent
                };
            })
        );

        res.status(200).json({
            status: 'success',
            data: {
                customers: customersWithStats
            }
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        next(error);
    }
};

module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getAllOrders,
    updateOrderStatus,
    getDashboardStats,
    getAllCustomers
};