const Collection = require('../models/Collection');
const { logAudit } = require('../utils/auditLogger');
const Brand = require('../models/Brand');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class CollectionController {
    async getCollections(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['collection_name'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const collections = await Collection.findAll({ where });
            if (!collections || collections.length === 0) {
                return res.status(404).json({ error: 'Collections not found' });
            }
            res.status(200).json(collections);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createCollection(req, res) {
        try {
            const { collection_name, brand_id } = req.body;
            if (!collection_name || !brand_id) {
                return res.status(400).json({ error: 'Collection name and brand ID are required' });
            }
            const brand = await Brand.findOne({ where: { brand_id: brand_id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const collection = await Collection.create({
                collection_name: collection_name,
                brand_id: brand_id,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Collection created',
                tableName: 'collection',
                recordId: collection.collection_id,
                oldValues: null,
                newValues: collection,
            });
            res.status(201).json(collection);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateCollection(req, res) {
        try {
            const { collection_name, brand_id } = req.body;
            const { id } = req.params;
            if (!id || !collection_name || !brand_id) {
                return res.status(400).json({ error: 'Collection ID, collection name and brand ID are required' });
            }
            const brand = await Brand.findOne({ where: { brand_id: brand_id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const collection = await Collection.findOne({ where: { collection_id: id } });
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const oldSnapshot = collection.toJSON();
            const payload = {
                collection_name: collection_name,
                brand_id: brand_id,
                updated_at: new Date(),
            };
            await Collection.update(payload, { where: { collection_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Collection updated',
                tableName: 'collection',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Collection updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteCollection(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Collection ID is required' });
            }
            const collection = await Collection.findOne({ where: { collection_id: id } });
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const snapshot = collection.toJSON();
            await collection.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Collection deleted',
                tableName: 'collection',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Collection deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CollectionController();
