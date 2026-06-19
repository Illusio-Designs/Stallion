const City = require('../models/Cities');
const { logAudit } = require('../utils/auditLogger');
const State = require('../models/State');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class CityController {

    async getCities(req, res) {
        try {
            const { state_id } = req.body;
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['name'],
                phoneFields: [],
            });
            const where = mergeWhere({ is_active: true, state_id }, searchFilter);
            const cities = await City.findAll({ where });
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
            await logAudit({
                req,
                action: 'create',
                description: 'City created',
                tableName: 'cities',
                recordId: newCity.id,
                oldValues: null,
                newValues: newCity,
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
            const city = await City.findOne({ where: { id } });
            if (!city) {
                return res.status(404).json({ error: 'City not found' });
            }
            const oldSnapshot = city.toJSON();
            const payload = {
                name: name || city.name,
                state_id: state_id || city.state_id,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            await City.update(payload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'City updated',
                tableName: 'cities',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
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
            const city = await City.findOne({ where: { id } });
            if (!city) {
                return res.status(404).json({ error: 'City not found' });
            }
            const snapshot = city.toJSON();
            await city.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'City deleted',
                tableName: 'cities',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'City deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CityController();
