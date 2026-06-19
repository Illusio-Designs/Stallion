const FrameColor = require('../models/FrameColor');
const { logAudit } = require('../utils/auditLogger');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');

class FrameColorController {
    async getFrameColors(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['frame_color'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const frameColors = await FrameColor.findAll({ where });
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
            const { frame_color } = req.body;
            if (!frame_color) {
                return res.status(400).json({ error: 'Frame color is required' });
            }
            const frameColor = await FrameColor.create({
                frame_color: frame_color,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Frame color created',
                tableName: 'frame_color',
                recordId: frameColor.frame_color_id,
                oldValues: null,
                newValues: frameColor,
            });
            res.status(200).json(frameColor);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateFrameColor(req, res) {
        try {
            const { frame_color } = req.body;
            const { id } = req.params;
            if (!id || !frame_color) {
                return res.status(400).json({ error: 'Frame color ID and frame color are required' });
            }
            const frameColor = await FrameColor.findOne({ where: { frame_color_id: id } });
            if (!frameColor) {
                return res.status(404).json({ error: 'Frame color not found' });
            }
            const oldSnapshot = frameColor.toJSON();
            const payload = {
                frame_color: frame_color,
                updated_at: new Date(),
            };
            await FrameColor.update(payload, { where: { frame_color_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Frame color updated',
                tableName: 'frame_color',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Frame color updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteFrameColor(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame color ID is required' });
            }
            const frameColor = await FrameColor.findOne({ where: { frame_color_id: id } });
            if (!frameColor) {
                return res.status(404).json({ error: 'Frame color not found' });
            }
            const snapshot = frameColor.toJSON();
            await frameColor.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Frame color deleted',
                tableName: 'frame_color',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Frame color deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameColorController();
