const FrameMaterial = require('../models/FrameMaterial');
const { logAudit } = require('../utils/auditLogger');
class FrameMaterialController {
    async getFrameMaterials(req, res) {
        try {
            const frameMaterials = await FrameMaterial.findAll();
            if (!frameMaterials || frameMaterials.length === 0) {
                return res.status(404).json({ error: 'Frame materials not found' });
            }
            res.status(200).json(frameMaterials);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getFrameMaterialById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame material ID is required' });
            }
            const frameMaterial = await FrameMaterial.findOne({ where: { frame_material_id: id } });
            if (!frameMaterial) {
                return res.status(404).json({ error: 'Frame material not found' });
            }
            res.status(200).json(frameMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createFrameMaterial(req, res) {
        try {
            const { frame_material } = req.body;
            if (!frame_material) {
                return res.status(400).json({ error: 'Frame material is required' });
            }
            const frameMaterial = await FrameMaterial.create({
                frame_material: frame_material,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Frame material created',
                tableName: 'frame_material',
                recordId: frameMaterial.frame_material_id,
                oldValues: null,
                newValues: frameMaterial,
            });
            res.status(200).json(frameMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateFrameMaterial(req, res) {
        try {
            const { frame_material } = req.body;
            const { id } = req.params;
            if (!id || !frame_material) {
                return res.status(400).json({ error: 'Frame material ID and frame material are required' });
            }
            const frameMaterial = await FrameMaterial.findOne({ where: { frame_material_id: id } });
            if (!frameMaterial) {
                return res.status(404).json({ error: 'Frame material not found' });
            }
            const oldSnapshot = frameMaterial.toJSON();
            const payload = {
                frame_material: frame_material,
                updated_at: new Date(),
            };
            await FrameMaterial.update(payload, { where: { frame_material_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Frame material updated',
                tableName: 'frame_material',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Frame material updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteFrameMaterial(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame material ID is required' });
            }
            const frameMaterial = await FrameMaterial.findOne({ where: { frame_material_id: id } });
            if (!frameMaterial) {
                return res.status(404).json({ error: 'Frame material not found' });
            }
            const snapshot = frameMaterial.toJSON();
            await frameMaterial.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Frame material deleted',
                tableName: 'frame_material',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Frame material deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameMaterialController();
