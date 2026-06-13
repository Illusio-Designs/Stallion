const State = require('../models/State');
const AuditLog = require('../models/AuditLog');
const Country = require('../models/Country');

class StateController {
    async getStates(req, res) {
        try {
            const { country_id } = req.body;
            const states = await State.findAll({ where: { is_active: true, country_id: country_id } });
            if (!states || states.length === 0) {
                return res.status(404).json({ error: 'States not found' });
            }
            res.status(200).json(states);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getStateById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'State ID is required' });
            }
            const state = await State.findOne({ where: { id } });
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            res.status(200).json(state);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createState(req, res) {
        try {
            const user = req.user;
            const { name, code, country_id } = req.body;
            if (!name || !country_id) {
                return res.status(400).json({ error: 'Name and country ID are required' });
            }
            const country = await Country.findByPk(country_id);
            if (!country) {
                return res.status(404).json({ error: 'Country not found' });
            }
            const state = await State.create({
                name,
                code,
                country_id,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'State created',
                table_name: 'states',
                record_id: state.id,
                old_values: null,
                new_values: state.toJSON(),
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(state);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateState(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'State ID is required' });
            }
            const { name, code, country_id } = req.body;
            const user = req.user;
            const state = await State.update({
                name: name || state.name,
                code: code || state.code,
                country_id: country_id || state.country_id,
                updated_at: new Date(),
                updated_by: user.user_id
            }, { where: { id: id } });
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'State updated',
                table_name: 'states',
                record_id: id,
                old_values: state,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'State updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteState(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'State ID is required' });
            }
            const user = req.user;
            const state = await State.destroy({ where: { id: id } });
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'State deleted',
                table_name: 'states',
                record_id: id,
                old_values: state,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'State deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new StateController();