const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const UserRole = require('../models/UserRole');

class UserController {
    async getUsers(req, res) {
        try {
            const roles = await Role.findAll(
                {
                    where: {
                        is_office_role: true
                    }
                }
            );
            const roleIds = roles.map(role => role.role_id);
            console.log("roleIds", roleIds);
            const users = await User.findAll(
                {
                    where: {
                        role_id: {
                            [Op.in]: roleIds
                        }
                    }
                }
            );
            res.status(200).json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            await user.destroy();
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'User deleted',
                table_name: 'users',
                record_id: user.user_id,
                old_values: user.toJSON(),
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'User deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateUser(req, res) {
        try {
            const id = req.user.user_id;
            console.log("id", id);
            const { name, is_active, phone, role_id, email, image_url } = req.body;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            const role = await Role.findByPk(role_id);
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            await user.update({
                full_name: name || user.full_name,
                phone: phone || user.phone,
                email: email || user.email,
                role_id: role_id || user.role_id,
                is_active: is_active || user.is_active,
                profile_image: image_url || user.profile_image,
                updated_at: new Date()
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'User updated',
                table_name: 'users',
                record_id: user.user_id,
                old_values: user.toJSON(),
                new_values: {
                    full_name: name || user.full_name,
                    phone: phone || user.phone,
                    role_id: role_id || user.role_id,
                    is_active: is_active || user.is_active,
                    profile_image: image_url || user.profile_image,
                    updated_at: new Date()
                },
                ip_address: req.ip,
                created_at: new Date()
            });
            const updatedUser = await User.findByPk(id);
            res.status(200).json(updatedUser);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }


    // Upload profile image
    async uploadProfileImage(req, res) {
        try {
            console.log("req.fileInfo", req.fileInfo);
            if (!req.fileInfo) {
                console.log("No file uploaded");
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const id = req.user.user_id;
            const user = await User.findByPk(id);

            if (!user) {
                console.log("User not found");
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Delete old profile image if exists
            if (user.profile_image) {
                const oldImagePath = path.join(__dirname, '../uploads/profile', user.profile_image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Update user with new image
            await user.update({
                profile_image: req.fileInfo.filename
            });
            const updatedUser = await User.findByPk(id);
            res.status(200).json(updatedUser);
        } catch (error) {
            console.log("error", error);
            res.status(500).json({
                success: false,
                message: 'Error uploading profile image',
                error: error.message
            });
        }
    };

    async getMe(req, res) {
        try {
            res.status(200).json(req.user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUserRole(req, res) {
        try {
            const user = req.user;

            const userRoles = await UserRole.findAll({
                where: { user_id: user.user_id },
                include: [{
                    model: Role,
                    as: 'role'
                }]
            });
            const roles = userRoles.map(ur => ({
                role_id: ur.role_id,
                role_name: ur.role ? ur.role.role_name : null,
                role_description: ur.role ? ur.role.description : null,
                assigned_at: ur.assigned_at
            }));
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();