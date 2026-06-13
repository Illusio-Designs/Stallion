const Gender = require('../models/Gender');
const AuditLog = require('../models/AuditLog');
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
            const user = req.user;
            const { gender_name } = req.body;
            if (!gender_name) {
                return res.status(400).json({ error: 'Gender name is required' });
            }
            const gender = await Gender.create({
                gender_name: gender_name,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Gender created',
                table_name: 'gender',
                record_id: gender.gender_id,
                old_values: null,
                new_values: gender,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(gender);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateGender(req, res) {
        try {
            const user = req.user;
            const { gender_name } = req.body;
            const { id } = req.params;
            if (!id || !gender_name) {
                return res.status(400).json({ error: 'Gender ID and gender name are required' });
            }
            const gender = await Gender.update({
                gender_name: gender_name,
                updated_at: new Date(),
            }, { where: { gender_id: id } });
            if (!gender) {
                return res.status(404).json({ error: 'Gender not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Gender updated',
                table_name: 'gender',
                record_id: id,
                old_values: gender,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Gender updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteGender(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Gender ID is required' });
            }
            const gender = await Gender.destroy({ where: { gender_id: id } });
            if (!gender) {
                return res.status(404).json({ error: 'Gender not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Gender deleted',
                table_name: 'gender',
                record_id: id,
                old_values: gender,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Gender deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new GenderController();  