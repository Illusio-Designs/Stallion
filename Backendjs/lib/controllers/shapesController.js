const Shape = require('../models/Shape');
const { logAudit } = require('../utils/auditLogger');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class ShapesController {
    async getShapes(req, res) {
        try {
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['shape_name'],
                phoneFields: [],
            });
            const where = mergeWhere({}, searchFilter);
            const shapes = await Shape.findAll({ where });
            if (!shapes || shapes.length === 0) {
                return res.status(404).json({ error: 'Shapes not found' });
            }
            res.status(200).json(shapes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createShape(req, res) {
        try {
            const { shape_name } = req.body;
            if (!shape_name) {
                return res.status(400).json({ error: 'Shape name is required' });
            }
            const shape = await Shape.create({ shape_name: shape_name, created_at: new Date(), updated_at: new Date() });
            await logAudit({
                req,
                action: 'create',
                description: 'Shape created',
                tableName: 'shape',
                recordId: shape.shape_id,
                oldValues: null,
                newValues: shape,
            });
            res.status(200).json(shape);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateShape(req, res) {
        try {
            const { shape_name } = req.body;
            const { id } = req.params;
            if (!id || !shape_name) {
                return res.status(400).json({ error: 'Shape ID and shape name are required' });
            }
            const shape = await Shape.findOne({ where: { shape_id: id } });
            if (!shape) {
                return res.status(404).json({ error: 'Shape not found' });
            }
            const oldSnapshot = shape.toJSON();
            const payload = {
                shape_name: shape_name,
                updated_at: new Date(),
            };
            await Shape.update(payload, { where: { shape_id: id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Shape updated',
                tableName: 'shape',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Shape updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteShape(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Shape ID is required' });
            }
            const shape = await Shape.findOne({ where: { shape_id: id } });
            if (!shape) {
                return res.status(404).json({ error: 'Shape not found' });
            }
            const snapshot = shape.toJSON();
            await shape.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Shape deleted',
                tableName: 'shape',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Shape deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ShapesController();
