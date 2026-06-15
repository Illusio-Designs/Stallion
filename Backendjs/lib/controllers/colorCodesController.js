const ColorCode = require('../models/ColorCode');
const { logAudit } = require('../utils/auditLogger');

class ColorCodesController {
    async getColorCodes(req, res) {
        try {
            const colorCodes = await ColorCode.findAll();
            if (!colorCodes || colorCodes.length === 0) {
                return res.status(404).json({ error: 'Color codes not found' });
            }
            res.status(200).json(colorCodes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createColorCode(req, res) {
        try {
            const { color_code } = req.body;
            if (!color_code) {
                return res.status(400).json({ error: 'Color code is required' });
            }
            const colorCode = await ColorCode.create({
                color_code: color_code,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Color code created',
                tableName: 'color_code',
                recordId: colorCode.color_code_id,
                oldValues: null,
                newValues: colorCode,
            });
            res.status(200).json(colorCode);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateColorCode(req, res) {
        try {
            const { color_code } = req.body;
            const { id } = req.params;
            if (!id || !color_code) {
                return res.status(400).json({ error: 'Color code ID and color code are required' });
            }
            const colorCode = await ColorCode.findOne({ where: { color_code_id: id } });
            if (!colorCode) {
                return res.status(404).json({ error: 'Color code not found' });
            }
            const oldSnapshot = colorCode.toJSON();
            const payload = {
                color_code: color_code,
                updated_at: new Date(),
            };
            await ColorCode.update(payload, { where: { color_code_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Color code updated',
                tableName: 'color_code',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Color code updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteColorCode(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Color code ID is required' });
            }
            const colorCode = await ColorCode.findOne({ where: { color_code_id: id } });
            if (!colorCode) {
                return res.status(404).json({ error: 'Color code not found' });
            }
            const snapshot = colorCode.toJSON();
            await colorCode.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Color code deleted',
                tableName: 'color_code',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Color code deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ColorCodesController();
