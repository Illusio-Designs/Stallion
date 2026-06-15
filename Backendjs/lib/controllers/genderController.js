const Gender = require('../models/Gender');
const { logAudit } = require('../utils/auditLogger');
class GenderController {
    async getGenders(req, res) {
        try {
            const genders = await Gender.findAll();
            if (!genders || genders.length === 0) {
                return res.status(404).json({ error: 'Genders not found' });
            }
            res.status(200).json(genders);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getGenderById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Gender ID is required' });
            }
            const gender = await Gender.findOne({ where: { gender_id: id } });
            if (!gender) {
                return res.status(404).json({ error: 'Gender not found' });
            }
            res.status(200).json(gender);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createGender(req, res) {
        try {
            const { gender_name } = req.body;
            if (!gender_name) {
                return res.status(400).json({ error: 'Gender name is required' });
            }
            const gender = await Gender.create({
                gender_name: gender_name,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Gender created',
                tableName: 'gender',
                recordId: gender.gender_id,
                oldValues: null,
                newValues: gender,
            });
            res.status(200).json(gender);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateGender(req, res) {
        try {
            const { gender_name } = req.body;
            const { id } = req.params;
            if (!id || !gender_name) {
                return res.status(400).json({ error: 'Gender ID and gender name are required' });
            }
            const gender = await Gender.findOne({ where: { gender_id: id } });
            if (!gender) {
                return res.status(404).json({ error: 'Gender not found' });
            }
            const oldSnapshot = gender.toJSON();
            const payload = {
                gender_name: gender_name,
                updated_at: new Date(),
            };
            await Gender.update(payload, { where: { gender_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Gender updated',
                tableName: 'gender',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Gender updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteGender(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Gender ID is required' });
            }
            const gender = await Gender.findOne({ where: { gender_id: id } });
            if (!gender) {
                return res.status(404).json({ error: 'Gender not found' });
            }
            const snapshot = gender.toJSON();
            await gender.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Gender deleted',
                tableName: 'gender',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Gender deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new GenderController();
