const { supabase } = require('../config/supabase');

const generateOrderId = () => {
    return 'ORD' + Date.now().toString().slice(-6);
};

const createOrder = async (req, res, next) => {
    try {
        const {
            items,
            payment_method,
            payment_account,
            transaction_code,
            customer_phone,
            shipping_address,
            notes
        } = req.body;

        const orderId = generateOrderId();
        let subtotal = 0;

        const productIds = items.map(item => item.product_id);
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, price, stock')
            .in('id', productIds)
            .eq('is_active', true);

        if (productsError) {
            throw productsError;
        }

        for (const item of items) {
            const product = products.find(p => p.id === item.product_id);
            if (!product) throw new Error(`Product ${item.product_id} not found`);
            if (product.stock < item.quantity) throw new Error(`Insufficient stock for product ${product.name}`);
            subtotal += product.price * item.quantity;
        }

        const taxAmount = subtotal * 0.16;
        const totalAmount = subtotal + taxAmount;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                id: orderId,
                user_id: req.user.id,
                total_amount: totalAmount,
                subtotal,
                tax_amount: taxAmount,
                payment_method,
                payment_account,
                transaction_code,
                customer_name: req.user.name,
                customer_email: req.user.email,
                customer_phone,
                shipping_address,
                notes
            }])
            .select()
            .single();

        if (orderError) throw orderError;

        for (const item of items) {
            const product = products.find(p => p.id === item.product_id);
            const itemTotal = product.price * item.quantity;

            const { error: itemError } = await supabase
                .from('order_items')
                .insert([{
                    order_id: orderId,
                    product_id: product.id,
                    product_name: product.name,
                    product_price: product.price,
                    quantity: item.quantity,
                    total_price: itemTotal
                }]);

            if (itemError) throw itemError;

            const { error: stockError } = await supabase
                .from('products')
                .update({ stock: product.stock - item.quantity })
                .eq('id', product.id);

            if (stockError) throw stockError;
        }

        const { error: trackingError } = await supabase
            .from('order_tracking')
            .insert([{
                order_id: orderId,
                status: 'Order Placed',
                description: 'Your order has been placed successfully'
            }]);

        if (trackingError) throw trackingError;

        const { error: clearCartError } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', req.user.id);

        if (clearCartError) throw clearCartError;

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: { order }
        });
    } catch (error) {
        next(error);
    }
};

const getUserOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw error;

        const enrichedOrders = await Promise.all(orders.map(async order => {
            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id);

            return { ...order, items };
        }));

        res.status(200).json({
            status: 'success',
            data: { orders: enrichedOrders }
        });
    } catch (error) {
        next(error);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (error || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', id);

        res.status(200).json({
            status: 'success',
            data: { order: { ...order, items } }
        });
    } catch (error) {
        next(error);
    }
};

const cancelOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        if (order.status !== 'Processing') {
            return res.status(400).json({
                status: 'error',
                message: 'Order cannot be cancelled at this stage'
            });
        }

        await supabase
            .from('orders')
            .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);

        const { data: items } = await supabase
            .from('order_items')
            .select('product_id, quantity')
            .eq('order_id', id);

        for (const item of items) {
            await supabase
                .from('products')
                .update({ stock: supabase.raw('stock + ?', [item.quantity]) })
                .eq('id', item.product_id);
        }

        await supabase
            .from('order_tracking')
            .insert([{ order_id: id, status: 'Order Cancelled', description: 'Order cancelled by customer' }]);

        res.status(200).json({
            status: 'success',
            message: 'Order cancelled successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById,
    cancelOrder
};
