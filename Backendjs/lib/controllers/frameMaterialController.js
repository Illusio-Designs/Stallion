const FrameMaterial = require('../models/FrameMaterial');
const AuditLog = require('../models/AuditLog');
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
            const user = req.user;
            const { frame_material } = req.body;
            if (!frame_material) {
                return res.status(400).json({ error: 'Frame material is required' });
            }
            const frameMaterial = await FrameMaterial.create({
                frame_material: frame_material,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Frame material created',
                table_name: 'frame_material',
                record_id: frameMaterial.frame_material_id,
                old_values: null,
                new_values: frameMaterial,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(frameMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateFrameMaterial(req, res) {
        try {
            const user = req.user;
            const { frame_material } = req.body;
            const { id } = req.params;
            if (!id || !frame_material) {
                return res.status(400).json({ error: 'Frame material ID and frame material are required' });
            }
            const frameMaterial = await FrameMaterial.update({
                frame_material: frame_material,
                updated_at: new Date(),
            }, { where: { frame_material_id: id } });
            if (!frameMaterial) {
                return res.status(404).json({ error: 'Frame material not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Frame material updated',
                table_name: 'frame_material',
                record_id: id,
                old_values: frameMaterial,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame material updated successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteFrameMaterial(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Frame material ID is required' });
            }
            const frameMaterial = await FrameMaterial.destroy({ where: { frame_material_id: id } });
            if (!frameMaterial) {
                return res.status(404).json({ error: 'Frame material not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Frame material deleted',
                table_name: 'frame_material',
                record_id: id,
                old_values: frameMaterial,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Frame material deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new FrameMaterialController();  