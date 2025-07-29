const { supabase } = require('../config/supabase');


const getOrderTracking = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        // Get order details from Supabase
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Get tracking history from Supabase
        const { data: trackingHistory, error: trackingError } = await supabase
            .from('order_tracking')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });

        if (trackingError) {
            console.error('Error fetching tracking history:', trackingError);
        }

        res.status(200).json({
            status: 'success',
            data: {
                order: {
                    id: order.id,
                    status: order.status,
                    total_amount: order.total_amount,
                    created_at: order.created_at,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone
                },
                trackingHistory: trackingHistory || []
            }
        });
    } catch (error) {
        console.error('Get order tracking error:', error);
        next(error);
    }
};

const getUserOrderTracking = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        // Get order details (only for the authenticated user) from Supabase
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .eq('user_id', req.user.id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Get tracking history from Supabase
        const { data: trackingHistory, error: trackingError } = await supabase
            .from('order_tracking')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });

        if (trackingError) {
            console.error('Error fetching tracking history:', trackingError);
        }

        res.status(200).json({
            status: 'success',
            data: {
                order: {
                    id: order.id,
                    status: order.status,
                    total_amount: order.total_amount,
                    created_at: order.created_at,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone
                },
                trackingHistory: trackingHistory || []
            }
        });
    } catch (error) {
        console.error('Get user order tracking error:', error);
        next(error);
    }
};

const addTrackingUpdate = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status, description } = req.body;

        // Verify order exists in Supabase
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        // Add tracking update to Supabase
        const { data: tracking, error: trackingError } = await supabase
            .from('order_tracking')
            .insert([{
                order_id: orderId,
                status,
                description
            }])
            .select()
            .single();

        if (trackingError) {
            throw trackingError;
        }

        res.status(201).json({
            status: 'success',
            message: 'Tracking update added successfully',
            data: {
                tracking
            }
        });
    } catch (error) {
        console.error('Add tracking update error:', error);
        next(error);
    }
};

module.exports = {
    getOrderTracking,
    getUserOrderTracking,
    addTrackingUpdate
};