const mpesaService = require('../services/mpesaService');
const { supabase } = require('../config/supabase');

const initiateMpesaPayment = async (req, res, next) => {
    try {
        const { orderId, phoneNumber, amount } = req.body;

        if (!orderId || !phoneNumber || !amount) {
            return res.status(400).json({
                status: 'error',
                message: 'Order ID, phone number, and amount are required'
            });
        }

        // Check if order exists and belongs to user
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

        if (order.status !== 'Processing') {
            return res.status(400).json({
                status: 'error',
                message: 'Order is not in a payable state'
            });
        }

        // Initiate STK push
        const result = await mpesaService.initiateSTKPush(
            phoneNumber,
            amount,
            orderId,
            `Bidhaaline-${orderId}`
        );

        // Update order with checkout request ID
        const { error: updateError } = await supabase
            .from('orders')
            .update({ mpesa_checkout_request_id: result.checkoutRequestId })
            .eq('id', orderId);

        if (updateError) throw updateError;

        res.status(200).json({
            status: 'success',
            message: 'Payment request sent to your phone. Please enter your M-Pesa PIN to complete the payment.',
            data: {
                checkoutRequestId: result.checkoutRequestId,
                merchantRequestId: result.merchantRequestId,
                customerMessage: result.customerMessage
            }
        });

    } catch (error) {
        next(error);
    }
};

const checkPaymentStatus = async (req, res, next) => {
    try {
        const { checkoutRequestId } = req.params;

        const status = await mpesaService.querySTKPushStatus(checkoutRequestId);
        const transaction = await mpesaService.getTransactionByCheckoutRequestId(checkoutRequestId);

        res.status(200).json({
            status: 'success',
            data: {
                mpesaStatus: status,
                localTransaction: transaction
            }
        });

    } catch (error) {
        next(error);
    }
};

const mpesaCallback = async (req, res, next) => {
    try {
        console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));
        await mpesaService.handleCallback(req.body);

        res.status(200).json({
            ResultCode: 0,
            ResultDesc: 'Success'
        });

    } catch (error) {
        console.error('M-Pesa Callback Error:', error);
        res.status(200).json({
            ResultCode: 0,
            ResultDesc: 'Success'
        });
    }
};

const getTransactionHistory = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const { data: transactions, error } = await supabase
            .from('mpesa_transactions')
            .select(`
                *,
                orders (
                    customer_name,
                    total_amount,
                    user_id
                )
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        const filteredTransactions = transactions.filter(t => t.orders?.user_id === req.user.id);

        res.status(200).json({
            status: 'success',
            data: {
                transactions: filteredTransactions.map(t => ({
                    ...t,
                    customer_name: t.orders.customer_name,
                    order_total: t.orders.total_amount
                }))
            }
        });

    } catch (error) {
        next(error);
    }
};

const getTransactionByOrderId = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        // Check order belongs to user
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('id', orderId)
            .eq('user_id', req.user.id)
            .single();

        if (orderError || !order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        const transaction = await mpesaService.getTransactionByOrderId(orderId);

        res.status(200).json({
            status: 'success',
            data: {
                transaction
            }
        });

    } catch (error) {
        next(error);
    }
};

const getAllTransactions = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('mpesa_transactions')
            .select(`
                *,
                orders (
                    customer_name,
                    customer_email,
                    total_amount
                )
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data: transactions, error } = await query;

        if (error) throw error;

        res.status(200).json({
            status: 'success',
            data: {
                transactions: transactions.map(t => ({
                    ...t,
                    customer_name: t.orders.customer_name,
                    customer_email: t.orders.customer_email,
                    order_total: t.orders.total_amount
                }))
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    initiateMpesaPayment,
    checkPaymentStatus,
    mpesaCallback,
    getTransactionHistory,
    getTransactionByOrderId,
    getAllTransactions
};
