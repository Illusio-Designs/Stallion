const SalesmanExpense = require('../models/SalesmanExpense');
const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const { normalizeRole, isAdmin } = require('../utils/roleHelpers');
const { parsePaginationParams, parseOptionalPagination, buildPaginatedResponse, UNPAGINATED_CAP } = require('../utils/listSearchHelpers');

// Expense types: 1 food, 2 travel (with a mode), 3 city tour, 4 toll (with a message), 5 hotel, 6 other.
// 'fuel' only exists on old rows.
const EXPENSE_TYPES = ['food', 'travel', 'city_tour', 'toll', 'hotel', 'other'];
const TRAVEL_MODES = ['bus', 'train', 'rapido', 'auto', 'cab', 'metro', 'bike', 'own_vehicle', 'other'];

// Checks the type and its extra field. Returns an error message or null.
function validateExpenseDetails({ expense_type, travel_mode, toll_message }, { isNew }) {
    if (expense_type === undefined) return null;
    const allowed = isNew ? EXPENSE_TYPES : [...EXPENSE_TYPES, 'fuel'];
    if (!allowed.includes(expense_type)) {
        return `Expense type must be one of: ${EXPENSE_TYPES.join(', ')}`;
    }
    if (expense_type === 'travel' && !TRAVEL_MODES.includes(travel_mode)) {
        return `Choose how you travelled: ${TRAVEL_MODES.join(', ')}`;
    }
    if (expense_type === 'toll' && !(typeof toll_message === 'string' && toll_message.trim())) {
        return 'Write a short message for the toll expense';
    }
    return null;
}

// A user's expenses belong to the salesman record linked to their login. The
// record is the proof, so this does not depend on which role happens to be listed
// first when a person holds several roles (that made multi-role salesmen fail).
async function resolveSalesmanIdForUser(userId) {
    const salesman = await Salesman.findOne({ where: { user_id: userId } });
    return salesman ? salesman.salesman_id : null;
}

class SalesmanExpenseController {
    async getSalesmanExpenses(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const pagination = parseOptionalPagination(req);
            const order = [['created_at', 'DESC'], ['id', 'DESC']];
            if (pagination) {
                const { count, rows } = await SalesmanExpense.findAndCountAll({
                    where: { salesman_id: salesmanId }, order, limit: pagination.limit, offset: pagination.offset,
                });
                return res.status(200).json(buildPaginatedResponse(rows, pagination, count));
            }
            const salesmanExpenses = await SalesmanExpense.findAll({ where: { salesman_id: salesmanId }, order, limit: UNPAGINATED_CAP });
            res.status(200).json(salesmanExpenses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAdminSalesmanExpenses(req, res) {
        try {
            if (!isAdmin(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { salesman_id } = req.params;
            if (!salesman_id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const { count, rows: salesmanExpenses } = await SalesmanExpense.findAndCountAll({
                where: { salesman_id },
                limit: pagination.limit,
                offset: pagination.offset,
            });
            res.status(200).json(buildPaginatedResponse(salesmanExpenses, pagination, count));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAllAdminSalesmanExpenses(req, res) {
        try {
            if (!isAdmin(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const where = {};
            const salesmanId = String(req.query.salesman_id ?? '').trim();
            if (salesmanId) {
                where.salesman_id = salesmanId;
            }
            const { count, rows: salesmanExpenses } = await SalesmanExpense.findAndCountAll({
                where,
                include: [
                    {
                        model: Salesman,
                        as: 'salesman',
                        attributes: ['full_name'],
                    },
                ],
                limit: pagination.limit,
                offset: pagination.offset,
                distinct: true,
            });

            const response = salesmanExpenses.map((expense) => {
                const plain = expense.get({ plain: true });
                const { salesman, ...rest } = plain;
                return {
                    ...rest,
                    salesman_name: salesman ? salesman.full_name : null,
                };
            });

            res.status(200).json(buildPaginatedResponse(response, pagination, count));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createSalesmanExpense(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const { remarks, kilometers, expense_date, expense_amount, expense_description, expense_type, images, travel_mode, toll_message } = req.body;
            const detailsError = validateExpenseDetails({ expense_type: expense_type === undefined ? null : expense_type, travel_mode, toll_message }, { isNew: true });
            if (detailsError) {
                return res.status(400).json({ error: detailsError });
            }
            const salesmanExpense = await SalesmanExpense.create({
                remarks,
                kilometers,
                expense_date,
                expense_amount,
                expense_description,
                expense_type,
                travel_mode: expense_type === 'travel' ? travel_mode : null,
                toll_message: expense_type === 'toll' ? String(toll_message).trim().slice(0, 500) : null,
                images,
                salesman_id: salesmanId,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Salesman expense created',
                tableName: 'salesman_expense',
                recordId: salesmanExpense.id,
                oldValues: null,
                newValues: salesmanExpense,
            });
            res.status(200).json(salesmanExpense);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSalesmanExpense(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Salesman expense ID is required' });
            }

            const existingExpense = await SalesmanExpense.findOne({ where: { id } });
            if (!existingExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }

            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id);
            const isOwner = normalizeRole(req.userRoleName) === 'salesman'
                && existingExpense.salesman_id === salesmanId;
            const isOffice = isAdmin(req.userRoleNames);

            if (!isOwner && !isOffice) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const { remarks, kilometers, status, expense_date, expense_amount, expense_description, expense_type, travel_mode, toll_message } = req.body;
            if (expense_type !== undefined) {
                const updateError = validateExpenseDetails({ expense_type, travel_mode, toll_message }, { isNew: false });
                if (updateError) {
                    return res.status(400).json({ error: updateError });
                }
            }
            const oldSnapshot = existingExpense.toJSON();
            const updatePayload = {
                remarks: remarks !== undefined ? remarks : existingExpense.remarks,
                kilometers: kilometers !== undefined ? kilometers : existingExpense.kilometers,
                expense_date: expense_date !== undefined ? expense_date : existingExpense.expense_date,
                expense_amount: expense_amount !== undefined ? expense_amount : existingExpense.expense_amount,
                expense_description: expense_description !== undefined ? expense_description : existingExpense.expense_description,
                expense_type: expense_type !== undefined ? expense_type : existingExpense.expense_type,
                travel_mode: expense_type !== undefined ? (expense_type === 'travel' ? travel_mode : null) : existingExpense.travel_mode,
                toll_message: expense_type !== undefined ? (expense_type === 'toll' ? String(toll_message).trim().slice(0, 500) : null) : existingExpense.toll_message,
                updated_at: new Date(),
            };

            if (status !== undefined) {
                if (!isOffice) {
                    return res.status(403).json({ error: 'Only office staff can update expense status' });
                }
                updatePayload.status = status;
            }

            await SalesmanExpense.update(updatePayload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Salesman expense updated',
                tableName: 'salesman_expense',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...updatePayload },
            });
            const updatedSalesmanExpense = await SalesmanExpense.findOne({ where: { id } });
            res.status(200).json(updatedSalesmanExpense);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Bill photos. The expense form uploads the files BEFORE the expense exists (it then sends the
    // returned paths when it creates the expense), so no expense_id is needed: the files are saved
    // and their public paths are returned. If an expense_id IS sent, the files are attached to that
    // expense (kept for older callers).
    async uploadImages(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const fileInfos = req.fileInfos;
            if (fileInfos == undefined || fileInfos.length === 0) {
                return res.status(400).json({ error: 'Images not found' });
            }
            // Public path under /uploads, never the server's disk path.
            const images = fileInfos.map((fileInfo) => `/uploads/bills/${fileInfo.filename}`);

            const { expense_id } = req.body || {};
            if (!expense_id) {
                return res.status(200).json({ images });
            }

            const salesmanExpense = await SalesmanExpense.findOne({
                where: { id: expense_id, salesman_id: salesmanId },
            });
            if (!salesmanExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }
            const oldSnapshot = salesmanExpense.toJSON();
            const imagesPayload = { images };

            await SalesmanExpense.update(
                imagesPayload,
                { where: { id: expense_id } }
            );
            await logAudit({
                req,
                action: 'update',
                description: 'Salesman expense images uploaded',
                tableName: 'salesman_expense',
                recordId: salesmanExpense.id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...imagesPayload },
            });
            const updatedSalesmanExpense = await SalesmanExpense.findOne({ where: { id: expense_id } });
            res.status(200).json({ ...updatedSalesmanExpense.toJSON(), images });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteSalesmanExpense(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Salesman expense ID is required' });
            }
            const salesmanExpense = await SalesmanExpense.findOne({ where: { id } });
            if (!salesmanExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }

            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id);
            const isOwner = normalizeRole(req.userRoleName) === 'salesman' && salesmanExpense.salesman_id === salesmanId;
            if (!isOwner && !isAdmin(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const snapshot = salesmanExpense.toJSON();
            await salesmanExpense.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Salesman expense deleted',
                tableName: 'salesman_expense',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            return res.status(200).json({
                success: true,
                message: 'Salesman expense deleted successfully',
                data: snapshot,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanExpenseController();
