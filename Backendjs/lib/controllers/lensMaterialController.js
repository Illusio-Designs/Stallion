const LensMaterial = require('../models/LensMaterial');
const { logAudit } = require('../utils/auditLogger');

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
            const { lens_material } = req.body;
            if (!lens_material) {
                return res.status(400).json({ error: 'Lens material is required' });
            }
            const lensMaterial = await LensMaterial.create({
                lens_material: lens_material,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Lens material created',
                tableName: 'lens_material',
                recordId: lensMaterial.lens_material_id,
                oldValues: null,
                newValues: lensMaterial,
            });
            res.status(200).json(lensMaterial);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateLensMaterial(req, res) {
        try {
            const { lens_material } = req.body;
            const { id } = req.params;
            if (!id || !lens_material) {
                return res.status(400).json({ error: 'Lens material ID and lens material are required' });
            }
            const lensMaterial = await LensMaterial.findOne({ where: { lens_material_id: id } });
            if (!lensMaterial) {
                return res.status(404).json({ error: 'Lens material not found' });
            }
            const oldSnapshot = lensMaterial.toJSON();
            const payload = {
                lens_material: lens_material,
                updated_at: new Date(),
            };
            await LensMaterial.update(payload, { where: { lens_material_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Lens material updated',
                tableName: 'lens_material',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Lens material updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteLensMaterial(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Lens material ID is required' });
            }
            const lensMaterial = await LensMaterial.findOne({ where: { lens_material_id: id } });
            if (!lensMaterial) {
                return res.status(404).json({ error: 'Lens material not found' });
            }
            const snapshot = lensMaterial.toJSON();
            await lensMaterial.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Lens material deleted',
                tableName: 'lens_material',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Lens material deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new LensMaterialController();
