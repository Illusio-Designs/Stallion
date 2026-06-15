const Tray = require('../models/Tray');
const { logAudit } = require('../utils/auditLogger');

class TrayController {
    async getTrays(req, res) {
        try {
            const trays = await Tray.findAll();
            if (!trays || trays.length === 0) {
                return res.status(404).json({ error: 'Trays not found' });
            }
            res.status(200).json(trays);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createTray(req, res) {
        try {
            const { tray_name, tray_status } = req.body;
            if (!tray_name || !tray_status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const tray = await Tray.create({
                tray_name,
                tray_status,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Tray created',
                tableName: 'tray',
                recordId: tray.tray_id,
                oldValues: null,
                newValues: tray,
            });
            res.status(200).json(tray);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateTray(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Tray ID is required' });
            }
            const { tray_name, tray_status } = req.body;
            const tray = await Tray.findByPk(id);
            if (!tray) {
                return res.status(404).json({ error: 'Tray not found' });
            }
            const oldSnapshot = tray.toJSON();
            const payload = {
                tray_name: tray_name || tray.tray_name,
                tray_status: tray_status || tray.tray_status,
                updated_at: new Date(),
            };
            await tray.update(payload);
            await logAudit({
                req,
                action: 'update',
                description: 'Tray updated',
                tableName: 'tray',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Tray updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteTray(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Tray ID is required' });
            }
            const tray = await Tray.findByPk(id);
            if (!tray) {
                return res.status(404).json({ error: 'Tray not found' });
            }
            const snapshot = tray.toJSON();
            await tray.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Tray deleted',
                tableName: 'tray',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Tray deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TrayController();
