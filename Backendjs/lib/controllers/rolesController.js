const Role = require('../models/Role');

class RolesController {

    async getRoles(req, res) {
        try {
            const roles = await Role.findAll();
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new RolesController();