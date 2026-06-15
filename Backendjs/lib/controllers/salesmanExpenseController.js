const SalesmanExpense = require('../models/SalesmanExpense');
const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const { normalizeRole, isOfficeRole } = require('../utils/roleHelpers');

async function resolveSalesmanIdForUser(userId, roleName) {
    if (normalizeRole(roleName) === 'salesman') {
        const salesman = await Salesman.findOne({ where: { user_id: userId } });
        return salesman ? salesman.salesman_id : null;
    }
    return null;
}

class SalesmanExpenseController {
    async getSalesmanExpenses(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id, req.userRoleName);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const salesmanExpenses = await SalesmanExpense.findAll({ where: { salesman_id: salesmanId } });
            if (!salesmanExpenses || salesmanExpenses.length === 0) {
                return res.status(404).json({ error: 'Salesman expenses not found' });
            }
            res.status(200).json(salesmanExpenses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAdminSalesmanExpenses(req, res) {
        try {
            if (!isOfficeRole(req.userRoleName)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const { salesman_id } = req.params;
            if (!salesman_id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const salesmanExpenses = await SalesmanExpense.findAll({ where: { salesman_id: salesman_id } });
            if (!salesmanExpenses || salesmanExpenses.length === 0) {
                return res.status(404).json({ error: 'Salesman expenses not found' });
            }
            res.status(200).json(salesmanExpenses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAllAdminSalesmanExpenses(req, res) {
        try {
            if (!isOfficeRole(req.userRoleName)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const salesmanExpenses = await SalesmanExpense.findAll({
                include: [
                    {
                        model: Salesman,
                        as: 'salesman',
                        attributes: ['full_name'],
                    },
                ],
            });
            if (!salesmanExpenses || salesmanExpenses.length === 0) {
                return res.status(404).json({ error: 'Salesman expenses not found' });
            }

            const response = salesmanExpenses.map((expense) => {
                const plain = expense.get({ plain: true });
                const { salesman, ...rest } = plain;
                return {
                    ...rest,
                    salesman_name: salesman ? salesman.full_name : null,
                };
            });

            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createSalesmanExpense(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id, req.userRoleName);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const { remarks, kilometers, expense_date, expense_amount, expense_description, expense_type, images } = req.body;
            const salesmanExpense = await SalesmanExpense.create({
                remarks,
                kilometers,
                expense_date,
                expense_amount,
                expense_description,
                expense_type,
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

            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id, req.userRoleName);
            const isOwner = normalizeRole(req.userRoleName) === 'salesman'
                && existingExpense.salesman_id === salesmanId;
            const isOffice = isOfficeRole(req.userRoleName);

            if (!isOwner && !isOffice) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const { remarks, kilometers, status, expense_date, expense_amount, expense_description, expense_type } = req.body;
            const oldSnapshot = existingExpense.toJSON();
            const updatePayload = {
                remarks: remarks !== undefined ? remarks : existingExpense.remarks,
                kilometers: kilometers !== undefined ? kilometers : existingExpense.kilometers,
                expense_date: expense_date !== undefined ? expense_date : existingExpense.expense_date,
                expense_amount: expense_amount !== undefined ? expense_amount : existingExpense.expense_amount,
                expense_description: expense_description !== undefined ? expense_description : existingExpense.expense_description,
                expense_type: expense_type !== undefined ? expense_type : existingExpense.expense_type,
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

    async uploadImages(req, res) {
        try {
            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id, req.userRoleName);
            if (!salesmanId) {
                return res.status(404).json({ error: 'Salesman record not found for this user' });
            }
            const { expense_id } = req.body;
            if (!expense_id) {
                return res.status(400).json({ error: 'Expense ID is required' });
            }
            const salesmanExpense = await SalesmanExpense.findOne({
                where: { id: expense_id, salesman_id: salesmanId },
            });
            if (!salesmanExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }
            const fileInfos = req.fileInfos;
            if (fileInfos == undefined || fileInfos.length === 0) {
                return res.status(400).json({ error: 'Images not found' });
            }

            const images = fileInfos.map(fileInfo => fileInfo.path);

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
            res.status(200).json(updatedSalesmanExpense);
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

            const salesmanId = await resolveSalesmanIdForUser(req.user.user_id, req.userRoleName);
            const isOwner = normalizeRole(req.userRoleName) === 'salesman' && salesmanExpense.salesman_id === salesmanId;
            if (!isOwner && !isOfficeRole(req.userRoleName)) {
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
