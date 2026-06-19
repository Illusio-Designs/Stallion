const FrameType = require('../models/FrameType');
const { logAudit } = require('../utils/auditLogger');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class FrameTypeController {
    async getFrameTypes(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['frame_type'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const frameTypes = await FrameType.findAll({ where });
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
            const { frame_type } = req.body;
            if (!frame_type) {
                return res.status(400).json({ error: 'Frame type is required' });
            }
            const frameType = await FrameType.create({
                frame_type: frame_type,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Frame type created',
                tableName: 'frame_type',
                recordId: frameType.frame_type_id,
                oldValues: null,
                newValues: frameType,
            });
            res.status(200).json(frameType);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateFrameType(req, res) {
        try {
            const { frame_type } = req.body;
            const { id } = req.params;
            if (!id || !frame_type) {
                return res.status(400).json({ error: 'Frame type ID and frame type are required' });
            }
            const frameType = await FrameType.findOne({ where: { frame_type_id: id } });
            if (!frameType) {
                return res.status(404).json({ error: 'Frame type not found' });
            }
            const oldSnapshot = frameType.toJSON();
            const payload = {
                frame_type: frame_type,
                updated_at: new Date(),
            };
            await FrameType.update(payload, { where: { frame_type_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Frame type updated',
                tableName: 'frame_type',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Frame type updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteFrameType(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame type ID is required' });
            }
            const frameType = await FrameType.findOne({ where: { frame_type_id: id } });
            if (!frameType) {
                return res.status(404).json({ error: 'Frame type not found' });
            }
            const snapshot = frameType.toJSON();
            await frameType.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Frame type deleted',
                tableName: 'frame_type',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Frame type deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameTypeController();
