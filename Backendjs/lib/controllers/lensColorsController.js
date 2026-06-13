const LensColor = require('../models/LensColor');
const AuditLog = require('../models/AuditLog');
class LensColorsController {
    async getLensColors(req, res) {
        try {
            const lensColors = await LensColor.findAll();
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
            const user = req.user;
            const { lens_color } = req.body;
            if (!lens_color) {
                return res.status(400).json({ error: 'Lens color is required' });
            }
            const lensColor = await LensColor.create({
                lens_color: lens_color,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Lens color created',
                table_name: 'lens_color',
                record_id: lensColor.lens_color_id,
                old_values: null,
                new_values: lensColor,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(lensColor);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateLensColor(req, res) {
        try {
            const user = req.user;
            const { lens_color } = req.body;
            const { id } = req.params;
            if (!id || !lens_color) {
                return res.status(400).json({ error: 'Lens color ID and lens color are required' });
            }
            const lensColor = await LensColor.update({
                lens_color: lens_color,
                updated_at: new Date(),
            }, { where: { lens_color_id: id } });
            if (!lensColor) {
                return res.status(404).json({ error: 'Lens color not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Lens color updated',
                table_name: 'lens_color',
                record_id: id,
                old_values: lensColor,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Lens color updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteLensColor(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens color ID is required' });
            }
            const lensColor = await LensColor.destroy({ where: { lens_color_id: id } });
            if (!lensColor) {
                return res.status(404).json({ error: 'Lens color not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Lens color deleted',
                table_name: 'lens_color',
                record_id: id,
                old_values: lensColor,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Lens color deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LensColorsController();  