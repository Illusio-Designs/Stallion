const Offer = require('../models/Offer');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');
const {
    isOfferActive,
    offerScopeMatches,
    computeOfferDiscount,
    validateOfferConfig,
} = require('../utils/offerPricing');

const OFFER_TYPES = ['flat', 'product', 'bogo'];

class OfferController {

    // Admin: full list for management.
    async getOffers(req, res) {
        try {
            const offers = await Offer.findAll({
                order: [['priority', 'DESC'], ['created_at', 'DESC']],
            });
            res.status(200).json(offers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createOffer(req, res) {
        try {
            const { offer_type, title, is_active, priority, start_date, end_date, config } = req.body;
            if (!offer_type || !OFFER_TYPES.includes(offer_type)) {
                return res.status(400).json({ error: 'offer_type must be one of: ' + OFFER_TYPES.join(', ') });
            }
            if (!title || !String(title).trim()) {
                return res.status(400).json({ error: 'title is required' });
            }
            const configError = validateOfferConfig(offer_type, config);
            if (configError) {
                return res.status(400).json({ error: configError });
            }
            const offer = await Offer.create({
                offer_type,
                title: String(title).trim(),
                is_active: is_active !== undefined ? !!is_active : true,
                priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
                start_date: start_date || null,
                end_date: end_date || null,
                config,
            });
            await logAudit({
                req, action: 'create', description: 'Offer created',
                tableName: 'offer', recordId: offer.offer_id, oldValues: null, newValues: offer,
            });
            res.status(200).json(offer);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateOffer(req, res) {
        try {
            const { id } = req.params;
            const offer = await Offer.findOne({ where: { offer_id: id } });
            if (!offer) {
                return res.status(404).json({ error: 'Offer not found' });
            }
            const oldSnapshot = offer.toJSON();
            const { offer_type, title, is_active, priority, start_date, end_date, config } = req.body;

            const nextType = offer_type || offer.offer_type;
            if (!OFFER_TYPES.includes(nextType)) {
                return res.status(400).json({ error: 'offer_type must be one of: ' + OFFER_TYPES.join(', ') });
            }
            // Validate config when type or config changes.
            if (config !== undefined || offer_type !== undefined) {
                const nextConfig = config !== undefined ? config : offer.config;
                const configError = validateOfferConfig(nextType, nextConfig);
                if (configError) {
                    return res.status(400).json({ error: configError });
                }
            }
            const payload = {};
            if (offer_type !== undefined) payload.offer_type = offer_type;
            if (title !== undefined) payload.title = String(title).trim();
            if (is_active !== undefined) payload.is_active = !!is_active;
            if (priority !== undefined) payload.priority = Number(priority) || 0;
            if (start_date !== undefined) payload.start_date = start_date || null;
            if (end_date !== undefined) payload.end_date = end_date || null;
            if (config !== undefined) payload.config = config;

            await Offer.update(payload, { where: { offer_id: id } });
            const updated = await Offer.findOne({ where: { offer_id: id } });
            await logAudit({
                req, action: 'update', description: 'Offer updated',
                tableName: 'offer', recordId: id, oldValues: oldSnapshot, newValues: updated,
            });
            res.status(200).json(updated);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteOffer(req, res) {
        try {
            const { id } = req.params;
            const offer = await Offer.findOne({ where: { offer_id: id } });
            if (!offer) {
                return res.status(404).json({ error: 'Offer not found' });
            }
            const snapshot = offer.toJSON();
            await offer.destroy();
            await logAudit({
                req, action: 'delete', description: 'Offer deleted',
                tableName: 'offer', recordId: id, oldValues: snapshot, newValues: null,
            });
            res.status(200).json({ message: 'Offer deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Offers a cart can use right now. Body: { order_items:[{product_id, quantity}] }.
     * Returns active, in-window offers whose scope touches the cart, each with the
     * discount computed for THIS cart (off WHP).
     */
    async getAvailableOffers(req, res) {
        try {
            const { order_items } = req.body;
            if (!Array.isArray(order_items) || order_items.length === 0) {
                return res.status(200).json([]);
            }
            const ids = [...new Set(order_items.map((i) => String(i.product_id)).filter(Boolean))];
            const products = ids.length
                ? await Product.findAll({ where: { product_id: ids } })
                : [];
            const priceById = new Map(products.map((p) => [String(p.product_id), parseFloat(p.whp) || 0]));

            // Build pricing lines (qty * whp). Skip items whose product is missing.
            const lines = order_items
                .filter((i) => priceById.has(String(i.product_id)))
                .map((i) => ({
                    product_id: String(i.product_id),
                    qty: Number(i.quantity) || 0,
                    unit_price: priceById.get(String(i.product_id)),
                }));

            const offers = await Offer.findAll({
                order: [['priority', 'DESC'], ['created_at', 'DESC']],
            });
            const now = new Date();
            const available = [];
            for (const offer of offers) {
                if (!isOfferActive(offer, now)) continue;
                if (!offerScopeMatches(offer, lines)) continue;
                const { discountTotal } = computeOfferDiscount(offer, lines);
                available.push({
                    offer_id: offer.offer_id,
                    title: offer.title,
                    offer_type: offer.offer_type,
                    discount_amount: discountTotal,
                });
            }
            res.status(200).json(available);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new OfferController();
