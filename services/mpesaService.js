const axios = require('axios');
const { supabase } = require('../config/supabase');

class MpesaService {
    constructor() {
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.businessShortCode = process.env.MPESA_BUSINESS_SHORTCODE;
        this.passkey = process.env.MPESA_PASSKEY;
        this.callbackUrl = process.env.MPESA_CALLBACK_URL;
        this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

        this.baseUrl = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    async getAccessToken() {
        try {
            const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

            const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });

            return response.data.access_token;
        } catch (error) {
            console.error('Error getting M-Pesa access token:', error.response?.data || error.message);
            throw new Error('Failed to get M-Pesa access token');
        }
    }

    generatePassword() {
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const password = Buffer.from(`${this.businessShortCode}${this.passkey}${timestamp}`).toString('base64');
        return { password, timestamp };
    }

    async initiateSTKPush(phoneNumber, amount, orderId, accountReference = 'Bidhaaline') {
        try {
            const accessToken = await this.getAccessToken();
            const { password, timestamp } = this.generatePassword();
            const formattedPhone = this.formatPhoneNumber(phoneNumber);

            const stkPushData = {
                BusinessShortCode: this.businessShortCode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount),
                PartyA: formattedPhone,
                PartyB: this.businessShortCode,
                PhoneNumber: formattedPhone,
                CallBackURL: this.callbackUrl,
                AccountReference: accountReference,
                TransactionDesc: `Payment for order ${orderId}`
            };

            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                stkPushData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await this.storeTransaction({
                orderId,
                checkoutRequestId: response.data.CheckoutRequestID,
                merchantRequestId: response.data.MerchantRequestID,
                phoneNumber: formattedPhone,
                amount,
                status: 'pending'
            });

            return {
                success: true,
                checkoutRequestId: response.data.CheckoutRequestID,
                merchantRequestId: response.data.MerchantRequestID,
                customerMessage: response.data.CustomerMessage,
                responseCode: response.data.ResponseCode,
                responseDescription: response.data.ResponseDescription
            };

        } catch (error) {
            console.error('STK Push Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.errorMessage || 'Failed to initiate M-Pesa payment');
        }
    }

    async querySTKPushStatus(checkoutRequestId) {
        try {
            const accessToken = await this.getAccessToken();
            const { password, timestamp } = this.generatePassword();

            const response = await axios.post(
                `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: this.businessShortCode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestId
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('STK Push Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query M-Pesa payment status');
        }
    }

    async handleCallback(callbackData) {
        try {
            const { Body } = callbackData;
            const { stkCallback } = Body;

            const checkoutRequestId = stkCallback.CheckoutRequestID;
            const merchantRequestId = stkCallback.MerchantRequestID;
            const resultCode = stkCallback.ResultCode;
            const resultDesc = stkCallback.ResultDesc;

            let mpesaReceiptNumber = null;
            let transactionDate = null;
            let phoneNumber = null;
            let amount = null;

            if (resultCode === 0 && stkCallback.CallbackMetadata) {
                const metadata = stkCallback.CallbackMetadata.Item;

                metadata.forEach(item => {
                    switch (item.Name) {
                        case 'MpesaReceiptNumber':
                            mpesaReceiptNumber = item.Value;
                            break;
                        case 'TransactionDate':
                            const dateStr = item.Value.toString();
                            transactionDate = new Date(
                                dateStr.substring(0, 4) + '-' +
                                dateStr.substring(4, 6) + '-' +
                                dateStr.substring(6, 8) + ' ' +
                                dateStr.substring(8, 10) + ':' +
                                dateStr.substring(10, 12) + ':' +
                                dateStr.substring(12, 14)
                            );
                            break;
                        case 'PhoneNumber':
                            phoneNumber = item.Value;
                            break;
                        case 'Amount':
                            amount = item.Value;
                            break;
                    }
                });
            }

            const status = resultCode === 0 ? 'success' : 'failed';

            await this.updateTransaction(checkoutRequestId, {
                mpesaReceiptNumber,
                transactionDate,
                resultCode,
                resultDesc,
                status
            });

            if (status === 'success') {
                await this.updateOrderPaymentStatus(checkoutRequestId);
            }

            return {
                success: status === 'success',
                checkoutRequestId,
                merchantRequestId,
                resultCode,
                resultDesc,
                mpesaReceiptNumber
            };

        } catch (error) {
            console.error('M-Pesa Callback Error:', error);
            throw new Error('Failed to process M-Pesa callback');
        }
    }

    async storeTransaction(data) {
        const { error } = await supabase.from('mpesa_transactions').insert([
            {
                order_id: data.orderId,
                checkout_request_id: data.checkoutRequestId,
                merchant_request_id: data.merchantRequestId,
                phone_number: data.phoneNumber,
                amount: data.amount,
                status: data.status
            }
        ]);

        if (error) {
            console.error('Supabase error storing transaction:', error);
            throw new Error('Failed to store transaction record');
        }
    }

    async updateTransaction(checkoutRequestId, updateData) {
        const { error } = await supabase
            .from('mpesa_transactions')
            .update({
                mpesa_receipt_number: updateData.mpesaReceiptNumber,
                transaction_date: updateData.transactionDate,
                result_code: updateData.resultCode,
                result_desc: updateData.resultDesc,
                status: updateData.status,
                updated_at: new Date().toISOString()
            })
            .eq('checkout_request_id', checkoutRequestId);

        if (error) {
            console.error('Supabase error updating transaction:', error);
            throw new Error('Failed to update transaction');
        }
    }

    async updateOrderPaymentStatus(checkoutRequestId) {
        const { data: transaction, error } = await supabase
            .from('mpesa_transactions')
            .select('order_id')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

        if (error || !transaction) {
            throw new Error('Transaction not found for payment update');
        }

        const orderId = transaction.order_id;

        // Update order status
        const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'Confirmed', updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (orderError) throw orderError;

        // Insert tracking log
        const { error: trackingError } = await supabase
            .from('order_tracking')
            .insert([
                {
                    order_id: orderId,
                    status: 'Payment Confirmed',
                    description: 'Payment received via M-Pesa. Order confirmed and being prepared.'
                }
            ]);

        if (trackingError) throw trackingError;
    }

    formatPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');

        if (cleaned.startsWith('254')) return cleaned;
        if (cleaned.startsWith('0')) return '254' + cleaned.substring(1);
        if (cleaned.length === 9) return '254' + cleaned;

        throw new Error('Invalid phone number format');
    }

    async getTransactionByOrderId(orderId) {
        const { data, error } = await supabase
            .from('mpesa_transactions')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.error('Error getting transaction by order:', error);
            throw new Error('Failed to get transaction');
        }

        return data;
    }

    async getTransactionByCheckoutRequestId(checkoutRequestId) {
        const { data, error } = await supabase
            .from('mpesa_transactions')
            .select('*')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

        if (error) {
            console.error('Error getting transaction by checkoutRequestId:', error);
            throw new Error('Failed to get transaction');
        }

        return data;
    }
}

module.exports = new MpesaService();
