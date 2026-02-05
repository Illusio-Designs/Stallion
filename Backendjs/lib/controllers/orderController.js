const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const Party = require('../models/Party');
const Distributor = require('../models/distributor');
const Salesman = require('../models/Salesman');
const Product = require('../models/Product');
const TrayProducts = require('../models/TrayProducts');
const { TrayProductStatus, OrderStatus, OrderType } = require('../constants/enums');
const { generateUniqueOrderNumber } = require('../services/order_number_generator');
const Event = require('../models/event');
const OrderOperation = require('../models/OrderOperation');
const Zone = require('../models/Zone');
const User = require('../models/User');
const { Op } = require('sequelize');

// Helper function to reverse an order operation (does not depend on controller instance)
async function reverseOrderOperation(orderId) {
    const orderOperations = await OrderOperation.findAll({ where: { order_id: orderId } });
    for (let i = 0; i < orderOperations.length; i++) {
        const orderOperation = orderOperations[i];
        const warehouseReducedQty = orderOperation.warehouse_reduced_qty;
        const trayReducedQty = orderOperation.tray_reduced_qty;
        const totalReducedQty = orderOperation.total_reduced_qty;
        const product = await Product.findOne({ where: { product_id: orderOperation.product_id } });
        if (!product) {
            continue;
        }
        product.warehouse_qty = product.warehouse_qty + warehouseReducedQty;
        product.tray_qty = product.tray_qty + trayReducedQty;
        product.total_qty = product.total_qty + totalReducedQty;
        await product.save();
        const trayIds = orderOperation.tray_ids;
        for (let j = 0; j < trayIds.length; j++) {
            const trayId = trayIds[j].tray_id;
            const qty = trayIds[j].qty;
            const status = trayIds[j].status;
            const trayProduct = await TrayProducts.findOne({ where: { tray_id: trayId } });
            if (!trayProduct) {
                continue;
            }
            trayProduct.qty = trayProduct.qty + qty;
            trayProduct.status = status;
            await trayProduct.save();
        }
        await orderOperation.destroy();
    }
}


class OrderController {
    async getOrders(req, res) {
        try {
            const orders = await Order.findAll();
            if (!orders || orders.length === 0) {
                return res.status(404).json({ error: 'Orders not found' });
            }
            res.status(200).json(orders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    }
    async createOrder(req, res) {
        try {
            // latitude, logitude for visit order
            const { order_date, order_type, order_items, order_notes, event_id, party_id, latitude, longitude, zone_id } = req.body;
            let distributor_id = req.body.distributor_id;
            let salesman_id = req.body.salesman_id;
            if (!order_date || !order_type || !order_items) {
                return res.status(400).json({ error: 'order_date, order_type, order_items  are required' });
            }
            if (!Array.isArray(order_items)) {
                return res.status(400).json({ error: 'Order items must be an array' });
            }
            // if order type is not among the allowed types, return error
            if (!Object.values(OrderType).includes(order_type)) {
                return res.status(400).json({ error: 'Invalid order type. Allowed types are: ' + Object.values(OrderType).join(', ') });
            }
            let isSalesmanRequired = false;
            let isDistributorRequired = false; // not required for event order
            let isPartyRequired = false;

            // if order type is event order, check if event id is provided
            if (order_type === OrderType.EVENT_ORDER) {
                isSalesmanRequired = true;
                isDistributorRequired = false;
                isPartyRequired = true;
                if (!event_id) {
                    return res.status(400).json({ error: 'Event ID is required for event orders' });
                }
                const event = await Event.findOne({ where: { event_id: event_id } });
                if (!event) {
                    return res.status(404).json({ error: 'Event not found' });
                }
            }
            // if order type is party order, check if party id is provided
            else if (order_type === OrderType.PARTY_ORDER) {
                isPartyRequired = true;
                isDistributorRequired = false;
                isSalesmanRequired = false;
                if (!party_id) {
                    return res.status(400).json({ error: 'Party ID is required for party orders' });
                }
                const party = await Party.findOne({ where: { party_id: party_id } });
                if (!party) {
                    return res.status(404).json({ error: 'Party not found' });
                }
            }
            // if order type is distributor order, fetch distributor by user ID
            else if (order_type === OrderType.DISTRIBUTOR_ORDER) {
                isDistributorRequired = true;
                isPartyRequired = false;
                isSalesmanRequired = false;

                const user = req.user;

                // First, try to find distributor by user_id
                let distributor = await Distributor.findOne({
                    where: { user_id: user.user_id }
                });

                // If not found, fetch user's email/phone and search for distributor
                if (!distributor) {
                    const userDetails = await User.findOne({
                        where: { user_id: user.user_id }
                    });

                    if (!userDetails) {
                        return res.status(404).json({ error: 'User not found' });
                    }

                    // Search for distributor by email or phone
                    const whereConditions = [];
                    if (userDetails.email) whereConditions.push({ email: userDetails.email });
                    if (userDetails.phone) whereConditions.push({ phone: userDetails.phone });

                    if (whereConditions.length > 0) {
                        distributor = await Distributor.findOne({
                            where: {
                                [Op.or]: whereConditions
                            }
                        });
                    }

                    // If distributor found, link it to the user
                    if (distributor) {
                        distributor.user_id = user.user_id;
                        await distributor.save();
                    } else {
                        return res.status(404).json({ error: 'No distributor found for this user' });
                    }
                }

                distributor_id = distributor.distributor_id;
            }
            else if (order_type === OrderType.VISIT_ORDER) {
                if (!latitude || !longitude) {
                    return res.status(400).json({ error: 'Latitude and longitude are required for visit orders' });
                }
                isDistributorRequired = false;
                isPartyRequired = true;
                isSalesmanRequired = true;
            }
            else {
                isDistributorRequired = false;
                isPartyRequired = true;
                isSalesmanRequired = true;
            }

            if (isDistributorRequired) {
                if (!distributor_id) {
                    return res.status(400).json({ error: 'Distributor ID is required' });
                }
                const distributor = await Distributor.findOne({ where: { distributor_id: distributor_id } });
                if (!distributor) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
            }
            else {
                if (!zone_id) {
                    return res.status(400).json({ error: 'Zone ID is required for event orders' });
                }
                const zone = await Zone.findOne({ where: { id: zone_id } });
                if (!zone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                const distributor = await Distributor.findOne({ where: { zone_id: zone_id } });
                if (!distributor) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
                distributor_id = distributor.distributor_id;
            }
            if (isPartyRequired) {
                if (!party_id) {
                    return res.status(400).json({ error: 'Party ID is required' });
                }
                const party = await Party.findOne({ where: { party_id: party_id } });
                if (!party) {
                    return res.status(404).json({ error: 'Party not found' });
                }
            }
            if (isSalesmanRequired) {
                // If salesman_id is not provided, find it from the user_id
                if (!salesman_id) {
                    const user = req.user;
                    const salesman = await Salesman.findOne({ where: { user_id: user.user_id } });
                    if (!salesman) {
                        return res.status(404).json({ error: 'Salesman record not found for this user' });
                    }
                    salesman_id = salesman.salesman_id;
                } else {
                    // If salesman_id is provided, verify it exists
                    const salesman = await Salesman.findOne({ where: { salesman_id: salesman_id } });
                    if (!salesman) {
                        return res.status(404).json({ error: 'Salesman not found' });
                    }
                }
            }

            const user = req.user;
            for (let i = 0; i < order_items.length; i++) {
                const item = order_items[i];
                // if item is not an object, return error
                if (typeof item !== 'object') {
                    return res.status(400).json({ error: 'Order items must be an array of objects' });
                }
                // if item does not have product_id, quantity, price, return error
                if (!item.product_id || !item.quantity || !item.price) {
                    return res.status(400).json({ error: 'All fields are required' });
                }
                // if product_id is not a string, return error
                if (typeof item.product_id !== 'string') {
                    return res.status(400).json({ error: 'Product ID must be a string' });
                }
                // if quantity is not a number, return error
                if (typeof item.quantity !== 'number') {
                    return res.status(400).json({ error: 'Quantity must be a number' });
                }
                // if price is not a number, return error
                if (typeof item.price !== 'number') {
                    return res.status(400).json({ error: 'Price must be a number' });
                }
                const product = await Product.findOne({ where: { product_id: item.product_id } });
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
            }

            let orderOperationData = {};
            const resolvedOrderItems = [];

            for (let i = 0; i < order_items.length; i++) {
                const item = order_items[i];
                const product = await Product.findOne({ where: { product_id: item.product_id } });
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                if (product.total_qty < item.quantity) {
                    return res.status(400).json({ error: `${product.model_no} Product quantity is not available in warehouse` });
                }
                const warehouse_qty = product.warehouse_qty;
                if (item.quantity > warehouse_qty) {
                    const left = item.quantity - warehouse_qty;
                    product.warehouse_qty = 0;
                    product.tray_qty = product.tray_qty - left;
                    product.total_qty = product.total_qty - item.quantity;
                    const trayProducts = await TrayProducts.findAll({
                        where: { product_id: product.product_id, status: TrayProductStatus.ALLOTED }
                    });
                    let remainingQty = left;
                    let trayIds = [];
                    for (let i = 0; i < trayProducts.length; i++) {
                        const trayProduct = trayProducts[i];
                        if (trayProduct.qty >= remainingQty) {
                            trayProduct.qty = trayProduct.qty - remainingQty;
                            trayIds.push({
                                tray_id: trayProduct.tray_id,
                                qty: remainingQty,
                                status: trayProduct.status,
                            });
                            trayProduct.status = TrayProductStatus.PARTIALLY_BOOKED;
                            remainingQty = 0;
                        }
                        else {
                            remainingQty = remainingQty - trayProduct.qty;
                            trayIds.push({
                                tray_id: trayProduct.tray_id,
                                qty: trayProduct.qty,
                                status: trayProduct.status
                            });
                            trayProduct.qty = 0;
                            trayProduct.status = TrayProductStatus.PRIORITY_BOOKED;
                        }
                        await trayProduct.save();
                        if (remainingQty === 0) {
                            break;
                        }
                    }
                    orderOperationData = {
                        warehouse_reduced_qty: warehouse_qty,
                        tray_reduced_qty: left,
                        total_reduced_qty: item.quantity,
                        tray_ids: trayIds,
                        product_id: product.product_id,
                    };
                }
                else {
                    product.warehouse_qty = warehouse_qty - item.quantity;
                    product.total_qty = product.total_qty - item.quantity;
                    orderOperationData = {
                        warehouse_reduced_qty: item.quantity,
                        tray_reduced_qty: 0,
                        total_reduced_qty: item.quantity,
                        tray_ids: [],
                        product_id: product.product_id,
                    };
                }
                const updatedProduct = await product.save();
                await AuditLog.create({
                    user_id: user.user_id,
                    action: 'update',
                    description: 'Product quantity updated',
                    table_name: 'products',
                    record_id: product.product_id,
                    old_values: product,
                    new_values: updatedProduct,
                    ip_address: req.ip,
                    created_at: new Date(),
                });
                resolvedOrderItems.push(item);
            }
            const orderTotal = resolvedOrderItems.reduce(
                (acc, item) => acc + item.quantity * item.price, 0);
            const orderNumber = generateUniqueOrderNumber();

            // Build order data object
            const orderData = {
                order_number: orderNumber,
                order_date,
                order_type,
                order_total: orderTotal,
                order_items: resolvedOrderItems,
                order_notes,
                created_at: new Date(),
                updated_at: new Date(),
                order_status: OrderStatus.PENDING,
                event_id,
                latitude,
                longitude,
            };

            // Only add party_id if party is required
            if (isPartyRequired && party_id) {
                orderData.party_id = party_id;
            }

            // Only add distributor_id if distributor is required
            if (isDistributorRequired && distributor_id) {
                orderData.distributor_id = distributor_id;
            }

            // Only add salesman_id if salesman is required
            if (isSalesmanRequired && salesman_id) {
                orderData.salesman_id = salesman_id;
            }

            const order = await Order.create(orderData);
            await OrderOperation.create({
                order_id: order.order_id,
                ...orderOperationData
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Order created',
                table_name: 'orders',
                record_id: order.order_id,
                old_values: null,
                new_values: order,
                ip_address: req.ip,
                created_at: new Date(),
            });
            res.status(201).json(order);
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ error: 'Failed to create order' });
        }
    }

    async updateOrderStatus(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Order ID is required' });
            }
            const { order_status, partial_dispatch_qty, courier_name, courier_tracking_number } = req.body;
            if (!order_status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const order = await Order.findOne({ where: { order_id: id } });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            if (order_status === OrderStatus.DISPATCHED || order_status === OrderStatus.PARTIALLY_DISPATCHED) {
                if (!courier_name || !courier_tracking_number) {
                    return res.status(400).json({ error: 'Courier name and tracking number are required' });
                }
                order.courier_name = courier_name;
                order.courier_tracking_number = courier_tracking_number;
            }
            if (order_status === OrderStatus.PARTIALLY_DISPATCHED) {
                if (!partial_dispatch_qty) {
                    return res.status(400).json({ error: 'Partial dispatch quantity is required' });
                }
                order.partial_dispatch_qty = partial_dispatch_qty;
            }
            if (order_status === OrderStatus.CANCELLED) {
                await reverseOrderOperation(order.order_id);
            }
            order.order_status = order_status;
            order.updated_at = new Date();
            await order.save();
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Order status updated',
                table_name: 'orders',
                record_id: order.order_id,
                old_values: order,
                new_values: order,
                ip_address: req.ip,
                created_at: new Date(),
            });
            res.status(200).json(order);
        }
        catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ error: 'Failed to update order status' });
        }
    }

    async deleteOrder(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Order ID is required' });
            }
            const order = await Order.findOne({ where: { order_id: id } });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            if (order.order_status !== OrderStatus.CANCELLED && order.order_status !== OrderStatus.COMPLETED) {
                await reverseOrderOperation(order.order_id);
            }
            await order.destroy();
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'delete',
                description: 'Order deleted',
                table_name: 'orders',
                record_id: order.order_id,
                old_values: order,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date(),
            });
            return res.status(200).json({ message: 'Order deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting order:', error);
            res.status(500).json({ error: 'Failed to delete order' });
        }
    }

}

module.exports = new OrderController();