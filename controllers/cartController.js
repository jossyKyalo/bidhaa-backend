const { supabase } = require('../config/supabase');

const addToCart = async (req, res, next) => {
    try {
        const { product_id, quantity } = req.body;

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, price, stock')
            .eq('id', product_id)
            .eq('is_active', true)
            .single();

        if (productError || !product) {
            return res.status(404).json({ status: 'error', message: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ status: 'error', message: 'Insufficient stock available' });
        }

        const { data: existingCartItem, error: cartError } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', req.user.id)
            .eq('product_id', product_id)
            .single();

        if (existingCartItem && !cartError) {
            const newQuantity = existingCartItem.quantity + quantity;

            if (newQuantity > product.stock) {
                return res.status(400).json({ status: 'error', message: 'Cannot add more items than available stock' });
            }

            const { data: updatedItem, error: updateError } = await supabase
                .from('cart_items')
                .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
                .eq('id', existingCartItem.id)
                .select()
                .single();

            if (updateError) throw updateError;

            return res.status(200).json({
                status: 'success',
                message: 'Cart updated successfully',
                data: { cartItem: updatedItem }
            });
        } else {
            const { data: newItem, error: insertError } = await supabase
                .from('cart_items')
                .insert([{ user_id: req.user.id, product_id, quantity }])
                .select()
                .single();

            if (insertError) throw insertError;

            res.status(201).json({
                status: 'success',
                message: 'Item added to cart successfully',
                data: { cartItem: newItem }
            });
        }
    } catch (error) {
        next(error);
    }
};

const getCart = async (req, res, next) => {
    try {
        const { data: cartItems, error } = await supabase
            .from('cart_items')
            .select(`
                id, quantity, created_at, updated_at,
                products!inner (
                    id, name, price, image_url, stock
                )
            `)
            .eq('user_id', req.user.id)
            .eq('products.is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const transformedItems = cartItems.map(item => ({
            id: item.id,
            quantity: item.quantity,
            created_at: item.created_at,
            updated_at: item.updated_at,
            product_id: item.products.id,
            name: item.products.name,
            price: item.products.price,
            image_url: item.products.image_url,
            stock: item.products.stock
        }));

        const subtotal = transformedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;

        res.status(200).json({
            status: 'success',
            data: {
                cartItems: transformedItems,
                summary: {
                    subtotal,
                    tax,
                    total,
                    itemCount: transformedItems.reduce((sum, item) => sum + item.quantity, 0)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateCartItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        if (quantity <= 0) {
            return res.status(400).json({ status: 'error', message: 'Quantity must be greater than 0' });
        }

        const { data: cartItem, error: fetchError } = await supabase
            .from('cart_items')
            .select('id, product_id')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (fetchError || !cartItem) {
            return res.status(404).json({ status: 'error', message: 'Cart item not found' });
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock')
            .eq('id', cartItem.product_id)
            .single();

        if (productError || quantity > product.stock) {
            return res.status(400).json({ status: 'error', message: 'Cannot add more items than available stock' });
        }

        const { data: updatedItem, error: updateError } = await supabase
            .from('cart_items')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.status(200).json({
            status: 'success',
            message: 'Cart item updated successfully',
            data: { cartItem: updatedItem }
        });
    } catch (error) {
        next(error);
    }
};

const removeFromCart = async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data: deletedItem, error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !deletedItem) {
            return res.status(404).json({ status: 'error', message: 'Cart item not found' });
        }

        res.status(200).json({ status: 'success', message: 'Item removed from cart successfully' });
    } catch (error) {
        next(error);
    }
};

const clearCart = async (req, res, next) => {
    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', req.user.id);

        if (error) throw error;

        res.status(200).json({ status: 'success', message: 'Cart cleared successfully' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart
};
