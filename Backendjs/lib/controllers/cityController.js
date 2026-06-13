const City = require('../models/Cities');
const AuditLog = require('../models/AuditLog');
const State = require('../models/State');
class CityController {

    async getCities(req, res) {
        try {
            const { state_id } = req.body;
            const cities = await City.findAll({ where: { is_active: true, state_id: state_id } });
            if (!cities || cities.length === 0) {
                return res.status(404).json({ error: 'Cities not found' });
            }
            res.status(200).json(cities);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getCityById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'City ID is required' });
            }
            const city = await City.findOne({ where: { id } });
            if (!city) {
                return res.status(404).json({ error: 'City not found' });
            }
            res.status(200).json(city);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createCity(req, res) {
        try {
            const user = req.user;
            const { name, state_id } = req.body;
            if (!name || !state_id) {
                return res.status(400).json({ error: 'Name and state ID are required' });
            }
            const state = await State.findByPk(state_id);
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            const city = await City.findOne({ where: { name: name, state_id: state_id } });
            if (city) {
                return res.status(400).json({ error: 'City already exists' });
            }
            const newCity = await City.create({
                name,
                state_id,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'City created',
                table_name: 'cities',
                record_id: newCity.id,
                old_values: null,
                new_values: newCity,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(201).json(newCity);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateCity(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'City ID is required' });
            }
            const { name, state_id } = req.body;
            const user = req.user;
            const city = await City.update({
                name: name || city.name,
                state_id: state_id || city.state_id,
                updated_at: new Date(),
                updated_by: user.user_id
            }, { where: { id: id } });
            if (!city) {
                return res.status(404).json({ error: 'City not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'City updated',
                table_name: 'cities',
                record_id: id,
                old_values: city,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'City updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteCity(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'City ID is required' });
            }
            const city = await City.destroy({ where: { id: id } });
            if (!city) {
                return res.status(404).json({ error: 'City not found' });
            }
            const user = req.user;
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'City deleted',
                table_name: 'cities',
                record_id: id,
                old_values: city,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'City deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CityController();