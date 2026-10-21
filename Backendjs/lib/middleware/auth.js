const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const { getJwtSecret } = require('../utils/jwtSecret');
const { pickPrimaryRole } = require('../utils/roleHelpers');

async function attachUserRole(req) {
    // A member can hold several roles. Attach EVERY role name so authorization
    // checks the union (not just the primary), then set the singular
    // req.userRoleName for back-compat — preferring 'admin' if present so
    // admin-gated logic still recognizes a multi-role admin.
    const userRoles = await UserRole.findAll({
        where: { user_id: req.user.user_id },
        include: [{ model: Role, as: 'role' }],
    });

    const roleNames = userRoles
        .map((ur) => (ur.role ? ur.role.role_name : null))
        .filter(Boolean);

    req.userRoleNames = roleNames;

    if (roleNames.length === 0) {
        req.userRoleName = null;
        return;
    }

    // Same answer every time for a user with several roles (admin first, then office
    // roles, then salesman, distributor, party); the database order is not fixed.
    req.userRoleName = pickPrimaryRole(roleNames);
}

// A token is revoked when it was issued before the user's last logout.
function isRevoked(decoded, user) {
    if (!user.tokens_valid_from || !decoded.iat) return false;
    return decoded.iat < Math.floor(new Date(user.tokens_valid_from).getTime() / 1000);
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user + role to request object
 */
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required',
            });
        }

        const decoded = jwt.verify(token, getJwtSecret());
        const user = await User.findByPk(decoded.userId);
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user not found',
            });
        }

        if (isRevoked(decoded, user)) {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }

        req.user = user;
        await attachUserRole(req);
        next();
    } catch (error) {
        console.error('JWT Authentication Error:', error.message);

        if (error.message === 'JWT_SECRET environment variable is required') {
            return res.status(500).json({ success: false, message: 'Server authentication is not configured' });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }

        return res.status(500).json({ success: false, message: 'Authentication error' });
    }
}

async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, getJwtSecret());
            const user = await User.findByPk(decoded.userId);
            if (user && user.is_active && !isRevoked(decoded, user)) {
                req.user = user;
                await attachUserRole(req);
            }
        }

        next();
    } catch (error) {
        next();
    }
}

module.exports = {
    authenticateToken,
    optionalAuth,
    attachUserRole,
};
