const Brand = require('../models/Brand');
const { logAudit } = require('../utils/auditLogger');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');

class BrandController {
    async getBrands(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['brand_name'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const brands = await Brand.findAll({ where });
            res.status(200).json(brands);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createBrand(req, res) {
        try {
            const { brand_name } = req.body;
            if (!brand_name) {
                return res.status(400).json({ error: 'Brand name is required' });
            }
            const brand = await Brand.create({
                brand_name: brand_name,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Brand created',
                tableName: 'brand',
                recordId: brand.brand_id,
                oldValues: null,
                newValues: brand,
            });
            res.status(201).json(brand);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateBrand(req, res) {
        try {
            const { brand_name } = req.body;
            const { id } = req.params;
            if (!id || !brand_name) {
                return res.status(400).json({ error: 'Brand ID and brand name are required' });
            }
            const brand = await Brand.findOne({ where: { brand_id: id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const oldSnapshot = brand.toJSON();
            const payload = { brand_name, updated_at: new Date() };
            await Brand.update(payload, { where: { brand_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Brand updated',
                tableName: 'brand',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Brand updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteBrand(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Brand ID is required' });
            }
            const brand = await Brand.findOne({ where: { brand_id: id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const snapshot = brand.toJSON();
            await brand.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Brand deleted',
                tableName: 'brand',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Brand deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new BrandController();
