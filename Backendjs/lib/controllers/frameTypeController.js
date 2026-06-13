const FrameType = require('../models/FrameType');
const AuditLog = require('../models/AuditLog');
class FrameTypeController {
    async getFrameTypes(req, res) {
        try {
            const frameTypes = await FrameType.findAll();
            if (!frameTypes || frameTypes.length === 0) {
                return res.status(404).json({ error: 'Frame types not found' });
            }
            res.status(200).json(frameTypes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getFrameTypeById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame type ID is required' });
            }
            const frameType = await FrameType.findOne({ where: { frame_type_id: id } });
            if (!frameType) {
                return res.status(404).json({ error: 'Frame type not found' });
            }
            res.status(200).json(frameType);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createFrameType(req, res) {
        try {
            const user = req.user;
            const { frame_type } = req.body;
            if (!frame_type) {
                return res.status(400).json({ error: 'Frame type is required' });
            }
            const frameType = await FrameType.create({
                frame_type: frame_type,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Frame type created',
                table_name: 'frame_type',
                record_id: frameType.frame_type_id,
                old_values: null,
                new_values: frameType,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(frameType);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateFrameType(req, res) {
        try {
            const user = req.user;
            const { frame_type } = req.body;
            const { id } = req.params;
            if (!id || !frame_type) {
                return res.status(400).json({ error: 'Frame type ID and frame type are required' });
            }
            const frameType = await FrameType.update({
                frame_type: frame_type,
                updated_at: new Date(),
            }, { where: { frame_type_id: id } });
            if (!frameType) {
                return res.status(404).json({ error: 'Frame type not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Frame type updated',
                table_name: 'frame_type',
                record_id: id,
                old_values: frameType,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame type updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteFrameType(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame type ID is required' });
            }
            const frameType = await FrameType.destroy({ where: { frame_type_id: id } });
            if (!frameType) {
                return res.status(404).json({ error: 'Frame type not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Frame type deleted',
                table_name: 'frame_type',
                record_id: id,
                old_values: frameType,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame type deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameTypeController();  