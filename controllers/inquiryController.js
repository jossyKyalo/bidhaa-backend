const { supabase } = require('../config/supabase');

const createInquiry = async (req, res, next) => {
    try {
        const { name, email, phone, subject, order_id, message } = req.body;

        const { data: inquiry, error } = await supabase
            .from('inquiries')
            .insert([{
                name,
                email,
                phone,
                subject,
                order_id: order_id || null,
                message
            }])
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            status: 'success',
            message: 'Inquiry submitted successfully. We will get back to you soon!',
            data: {
                inquiry: inquiry
            }
        });
    } catch (error) {
        next(error);
    }
};

const getInquiries = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('inquiries')
            .select('*');

        if (status) {
            query = query.eq('status', status);
        }

        const { data: inquiries, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) {
            throw error;
        }

        res.status(200).json({
            status: 'success',
            data: {
                inquiries: inquiries
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateInquiryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, admin_response } = req.body;

        const { data: inquiry, error } = await supabase
            .from('inquiries')
            .update({
                status,
                admin_response,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !inquiry) {
            return res.status(404).json({
                status: 'error',
                message: 'Inquiry not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Inquiry updated successfully',
            data: {
                inquiry: inquiry
            }
        });
    } catch (error) {
        next(error);
    }
};

const getInquiryById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: inquiry, error } = await supabase
            .from('inquiries')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !inquiry) {
            return res.status(404).json({
                status: 'error',
                message: 'Inquiry not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                inquiry: inquiry
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createInquiry,
    getInquiries,
    updateInquiryStatus,
    getInquiryById
};