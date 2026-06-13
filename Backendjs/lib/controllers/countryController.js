const Country = require('../models/Country');
const AuditLog = require('../models/AuditLog');

class CountryController {
    async getCountries(req, res) {
        try {
            const countries = await Country.findAll({ where: { is_active: true } });
            if (!countries || countries.length === 0) {
                return res.status(404).json({ error: 'Countries not found' });
            }
            res.status(200).json(countries);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getCountryById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Country ID is required' });
            }
            const country = await Country.findOne({ where: { id } });
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            res.status(200).json(country);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createCountry(req, res) {
        try {
            const user = req.user;
            const { name, code, phone_code, currency } = req.body;
            const country = await Country.create({ name, code, phone_code, currency, created_by: user.user_id, created_at: new Date(), updated_at: new Date(), is_active: true });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Country created',
                table_name: 'countries',
                record_id: country.id,
                old_values: null,
                new_values: country.toJSON(),
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(country);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateCountry(req, res) {
        try {
            const user = req.user;
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Country ID is required' });
            }
            const { name, code, phone_code, currency } = req.body;
            const country = await Country.update({ name, code, phone_code, currency }, { where: { id: id } });
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Country updated',
                table_name: 'countries',
                record_id: id,
                old_values: country,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Country updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteCountry(req, res) {
        try {
            const user = req.user;
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Country ID is required' });
            }
            const country = await Country.destroy({ where: { id: id } });
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Country deleted',
                table_name: 'countries',
                record_id: id,
                old_values: country,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Country deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CountryController();