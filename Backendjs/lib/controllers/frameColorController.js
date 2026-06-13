const FrameColor = require('../models/FrameColor');
const AuditLog = require('../models/AuditLog');

class FrameColorController {
    async getFrameColors(req, res) {
        try {
            const frameColors = await FrameColor.findAll();
            if (!frameColors || frameColors.length === 0) {
                return res.status(404).json({ error: 'Frame colors not found' });
            }
            res.status(200).json(frameColors);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getFrameColorById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame color ID is required' });
            }
            const frameColor = await FrameColor.findOne({ where: { frame_color_id: id } });
            if (!frameColor) {
                return res.status(404).json({ error: 'Frame color not found' });
            }
            res.status(200).json(frameColor);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createFrameColor(req, res) {
        try {
            const user = req.user;
            const { frame_color } = req.body;
            if (!frame_color) {
                return res.status(400).json({ error: 'Frame color is required' });
            }
            const frameColor = await FrameColor.create({
                frame_color: frame_color,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Frame color created',
                table_name: 'frame_color',
                record_id: frameColor.frame_color_id,
                old_values: null,
                new_values: frameColor,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(frameColor);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateFrameColor(req, res) {
        try {
            const user = req.user;
            const { frame_color } = req.body;
            const { id } = req.params;
            if (!id || !frame_color) {
                return res.status(400).json({ error: 'Frame color ID and frame color are required' });
            }
            const frameColor = await FrameColor.update({
                frame_color: frame_color,
                updated_at: new Date(),
            }, { where: { frame_color_id: id } });
            if (!frameColor) {
                return res.status(404).json({ error: 'Frame color not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Frame color updated',
                table_name: 'frame_color',
                record_id: id,
                old_values: frameColor,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame color updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteFrameColor(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame color ID is required' });
            }
            const frameColor = await FrameColor.destroy({ where: { frame_color_id: id } });
            if (!frameColor) {
                return res.status(404).json({ error: 'Frame color not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Frame color deleted',
                table_name: 'frame_color',
                record_id: id,
                old_values: frameColor,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame color deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameColorController();  