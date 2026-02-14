const SalesmanExpense = require('../models/SalesmanExpense');
const AuditLog = require('../models/AuditLog');
const path = require('path');

class SalesmanExpenseController {
    async getSalesmanExpenses(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const salesmanExpenses = await SalesmanExpense.findAll({ where: { salesman_id: id } });
            if (!salesmanExpenses || salesmanExpenses.length === 0) {
                return res.status(404).json({ error: 'Salesman expenses not found' });
            }
            res.status(200).json(salesmanExpenses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createSalesmanExpense(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const { kilometers, expense_date, expense_amount, expense_description, expense_type, images } = req.body;
            const salesmanExpense = await SalesmanExpense.create({
                kilometers,
                expense_date,
                expense_amount,
                expense_description,
                expense_type,
                images,
                salesman_id: id,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: id,
                action: 'create',
                description: 'Salesman expense created',
                table_name: 'salesman_expense',
                record_id: salesmanExpense.id,
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
            const { kilometers, status, expense_date, expense_amount, expense_description, expense_type } = req.body;
            const salesmanExpense = await SalesmanExpense.update({
                kilometers,
                status,
                expense_date,
                expense_amount,
                expense_description,
                expense_type,
                updated_at: new Date(),
            }, { where: { id: id } });
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'update',
                description: 'Salesman expense updated',
                table_name: 'salesman_expense',
                record_id: id,
                old_values: salesmanExpense,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date(),
            });
            const updatedSalesmanExpense = await SalesmanExpense.findOne({ where: { id: id } });
            res.status(200).json(updatedSalesmanExpense);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async uploadImages(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            console.log("id", id);
            const salesmanExpense = await SalesmanExpense.findOne({ where: { salesman_id: id } });
            if (!salesmanExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }
            const fileInfos = req.fileInfos;
            if (fileInfos == undefined || fileInfos.length === 0) {
                return res.status(400).json({ error: 'Images not found' });
            }

            const images = fileInfos.map(fileInfo => fileInfo.path);

            await SalesmanExpense.update(
                { images: images },
                {
                    where: { salesman_id: id }
                }
            );
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'update',
                description: 'Salesman expense images uploaded',
                table_name: 'salesman_expense',
                record_id: salesmanExpense.id,
                old_values: salesmanExpense,
                new_values: { images: images },
                ip_address: req.ip,
                created_at: new Date(),
            });
            const updatedSalesmanExpense = await SalesmanExpense.findOne({ where: { salesman_id: id } });
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
            const salesmanExpense = await SalesmanExpense.findOne({ where: { id: id } });
            if (!salesmanExpense) {
                return res.status(404).json({ error: 'Salesman expense not found' });
            }
            await salesmanExpense.destroy();
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'delete',
                description: 'Salesman expense deleted',
                table_name: 'salesman_expense',
                record_id: id,
                old_values: salesmanExpense,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date(),
            });
            res.status(200).json({ message: 'Salesman expense deleted successfully' });
            return res.status(200).json({
                success: true,
                message: 'Salesman expense deleted successfully',
                data: salesmanExpense,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanExpenseController();