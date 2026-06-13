const LensMaterial = require('../models/LensMaterial');
const AuditLog = require('../models/AuditLog');

class LensMaterialController {
    async getLensMaterials(req, res) {
        try {
            const lensMaterials = await LensMaterial.findAll();
            if (!lensMaterials || lensMaterials.length === 0) {
                return res.status(404).json({ error: 'Lens materials not found' });
            }
            res.status(200).json(lensMaterials);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getLensMaterialById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens material ID is required' });
            }
            const lensMaterial = await LensMaterial.findOne({ where: { lens_material_id: id } });
            if (!lensMaterial) {
                return res.status(404).json({ error: 'Lens material not found' });
            }
            res.status(200).json(lensMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createLensMaterial(req, res) {
        try {
            const user = req.user;
            const { lens_material } = req.body;
            if (!lens_material) {
                return res.status(400).json({ error: 'Lens material is required' });
            }
            const lensMaterial = await LensMaterial.create({
                lens_material: lens_material,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Lens material created',
                table_name: 'lens_material',
                record_id: lensMaterial.lens_material_id,
                old_values: null,
                new_values: lensMaterial,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(lensMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateLensMaterial(req, res) {
        try {
            const user = req.user;
            const { lens_material } = req.body;
            const { id } = req.params;
            if (!id || !lens_material) {
                return res.status(400).json({ error: 'Lens material ID and lens material are required' });
            }
            const lensMaterial = await LensMaterial.update({
                lens_material: lens_material,
                updated_at: new Date(),
            }, { where: { lens_material_id: id } });
            if (!lensMaterial) {
                return res.status(404).json({ error: 'Lens material not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Lens material updated',
                table_name: 'lens_material',
                record_id: id,
                old_values: lensMaterial,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Lens material updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteLensMaterial(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens material ID is required' });
            }
            const lensMaterial = await LensMaterial.destroy({ where: { lens_material_id: id } });
            if (!lensMaterial) {
                return res.status(404).json({ error: 'Lens material not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Lens material deleted',
                table_name: 'lens_material',
                record_id: id,
                old_values: lensMaterial,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Lens material deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LensMaterialController();  