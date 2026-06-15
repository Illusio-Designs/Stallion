const State = require('../models/State');
const { logAudit } = require('../utils/auditLogger');
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
            await logAudit({
                req,
                action: 'create',
                description: 'State created',
                tableName: 'states',
                recordId: state.id,
                oldValues: null,
                newValues: state,
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
            const state = await State.findOne({ where: { id } });
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            const oldSnapshot = state.toJSON();
            const payload = {
                name: name || state.name,
                code: code || state.code,
                country_id: country_id || state.country_id,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            await State.update(payload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'State updated',
                tableName: 'states',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
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
            const state = await State.findOne({ where: { id } });
            if (!state) {
                return res.status(404).json({ error: 'State not found' });
            }
            const snapshot = state.toJSON();
            await state.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'State deleted',
                tableName: 'states',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'State deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new StateController();
