const LensColor = require('../models/LensColor');
const { logAudit } = require('../utils/auditLogger');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class LensColorsController {
    async getLensColors(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['lens_color'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const lensColors = await LensColor.findAll({ where });
            if (!lensColors || lensColors.length === 0) {
                return res.status(404).json({ error: 'Lens colors not found' });
            }
            res.status(200).json(lensColors);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getLensColorById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens color ID is required' });
            }
            const lensColor = await LensColor.findOne({ where: { lens_color_id: id } });
            if (!lensColor) {
                return res.status(404).json({ error: 'Lens color not found' });
            }
            res.status(200).json(lensColor);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createLensColor(req, res) {
        try {
            const { lens_color } = req.body;
            if (!lens_color) {
                return res.status(400).json({ error: 'Lens color is required' });
            }
            const lensColor = await LensColor.create({
                lens_color: lens_color,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Lens color created',
                tableName: 'lens_color',
                recordId: lensColor.lens_color_id,
                oldValues: null,
                newValues: lensColor,
            });
            res.status(200).json(lensColor);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateLensColor(req, res) {
        try {
            const { lens_color } = req.body;
            const { id } = req.params;
            if (!id || !lens_color) {
                return res.status(400).json({ error: 'Lens color ID and lens color are required' });
            }
            const lensColor = await LensColor.findOne({ where: { lens_color_id: id } });
            if (!lensColor) {
                return res.status(404).json({ error: 'Lens color not found' });
            }
            const oldSnapshot = lensColor.toJSON();
            const payload = {
                lens_color: lens_color,
                updated_at: new Date(),
            };
            await LensColor.update(payload, { where: { lens_color_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Lens color updated',
                tableName: 'lens_color',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Lens color updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteLensColor(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens color ID is required' });
            }
            const lensColor = await LensColor.findOne({ where: { lens_color_id: id } });
            if (!lensColor) {
                return res.status(404).json({ error: 'Lens color not found' });
            }
            const snapshot = lensColor.toJSON();
            await lensColor.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Lens color deleted',
                tableName: 'lens_color',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Lens color deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LensColorsController();
