const Country = require('../models/Country');
const { logAudit } = require('../utils/auditLogger');

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
            await logAudit({
                req,
                action: 'create',
                description: 'Country created',
                tableName: 'countries',
                recordId: country.id,
                oldValues: null,
                newValues: country,
            });
            res.status(200).json(country);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateCountry(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Country ID is required' });
            }
            const { name, code, phone_code, currency } = req.body;
            const country = await Country.findOne({ where: { id } });
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            const oldSnapshot = country.toJSON();
            const payload = { name, code, phone_code, currency };
            await Country.update(payload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Country updated',
                tableName: 'countries',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Country updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteCountry(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Country ID is required' });
            }
            const country = await Country.findOne({ where: { id } });
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            const snapshot = country.toJSON();
            await country.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Country deleted',
                tableName: 'countries',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Country deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CountryController();
