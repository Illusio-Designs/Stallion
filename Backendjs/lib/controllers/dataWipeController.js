const fs = require('fs');
const path = require('path');
const sequelize = require('../constants/database');

// Transactional / test data models to wipe, in child-before-parent order.
// (Foreign-key checks are disabled during the wipe as a belt-and-braces measure,
//  but keeping a sane order means the wipe still works if that ever changes.)
const Product = require('../models/Product');
const Party = require('../models/Party');
const Order = require('../models/Order');
const OrderOperation = require('../models/OrderOperation');
const Salesman = require('../models/Salesman');
const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const SalesmanExpense = require('../models/SalesmanExpense');
const SalesmanTargets = require('../models/SalesmanTargets');
const SalesmanTray = require('../models/SalesmanTray');
const SalesmanStates = require('../models/SalesmanStates');
const SalesmanZones = require('../models/SalesmanZones');
const Tray = require('../models/Tray');
const TrayProducts = require('../models/TrayProducts');
const Offer = require('../models/Offer');
const Distributor = require('../models/distributor');
const DistributorStates = require('../models/DistributorStates');
const DistributorZones = require('../models/DistributorZones');
const EventModel = require('../models/event');
const AuditLog = require('../models/AuditLog');

// The exact phrase the caller must send in the request body to arm the wipe.
const CONFIRM_PHRASE = 'WIPE ALL DATA';

// Superadmin that must ALWAYS survive a wipe (matches the seed in
// databaseManager). Combined with "any user holding the admin role" and "the
// caller", this guarantees you can never lock yourself out.
const PROTECTED_ADMIN_EMAIL = 'illusiodesigns@gmail.com';

// Ordered list of models whose tables get fully emptied. Children first.
const WIPE_MODELS = [
    // salesman-owned records
    SalesmanCheckIns,
    SalesmanExpense,
    SalesmanTargets,
    SalesmanTray,
    SalesmanStates,
    SalesmanZones,
    // orders
    OrderOperation,
    Order,
    // trays
    TrayProducts,
    Tray,
    // catalog-adjacent test data
    Offer,
    // distributors
    DistributorStates,
    DistributorZones,
    Distributor,
    // misc
    EventModel,
    Party,
    Product,
    Salesman,
    AuditLog,
];

// uploads/<dir> folders whose files are cleared. `profile` is deliberately
// excluded so the surviving admin keeps their avatar.
const UPLOAD_DIRS_TO_CLEAR = [
    'products',
    'salesman',
    'bills',
    'sliders',
    'product_uploads',
    'party_uploads',
];

// Delete every plain file inside uploads/<dir> (keeps the folder itself and any
// sub-directories). Returns how many files were removed and any errors.
function clearUploadDir(dirName) {
    const rootDir = path.join(__dirname, '..', '..');
    const dirPath = path.join(rootDir, 'uploads', dirName);
    const result = { dir: dirName, deleted: 0, errors: [] };

    if (!fs.existsSync(dirPath)) {
        return result;
    }

    let entries = [];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
        result.errors.push(`read ${dirName}: ${err.message}`);
        return result;
    }

    for (const entry of entries) {
        if (!entry.isFile()) continue; // leave sub-dirs / symlinks alone
        try {
            fs.unlinkSync(path.join(dirPath, entry.name));
            result.deleted += 1;
        } catch (err) {
            result.errors.push(`${dirName}/${entry.name}: ${err.message}`);
        }
    }

    return result;
}

const dataWipeController = {
    /**
     * DESTRUCTIVE: wipe all test/transactional data + product (and related)
     * image files in one shot, leaving master data (roles, geography, product
     * attributes, brands, collections) and the admin account(s) intact.
     *
     * Guarded by: admin role (route middleware) + an exact confirmation phrase
     * in the request body.
     *
     *   POST /api/admin/wipe-data
     *   body: { "confirm": "WIPE ALL DATA" }
     */
    async wipeData(req, res) {
        // 1) Confirmation phrase — must match exactly.
        const confirm = req.body && req.body.confirm;
        if (confirm !== CONFIRM_PHRASE) {
            return res.status(400).json({
                success: false,
                message: `Confirmation failed. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`,
            });
        }

        const callerId = req.user && req.user.user_id;
        const rowsDeleted = {};

        try {
            // 2) Database wipe inside a single transaction so it is all-or-nothing.
            await sequelize.transaction(async (t) => {
                // Disable FK checks on this connection so child/parent order and
                // RESTRICT constraints can't block the wipe. The try/finally
                // guarantees we re-enable them on THIS connection even if a delete
                // throws — otherwise the pooled connection could be handed back with
                // checks still off, corrupting later requests.
                await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
                try {
                for (const model of WIPE_MODELS) {
                    const table = model.getTableName();
                    const count = await model.destroy({ where: {}, transaction: t });
                    rowsDeleted[table] = count;
                }

                // Figure out which users are admins and MUST be kept:
                //   - anyone holding the `admin` role (via user_roles or users.role_id)
                //   - the protected superadmin email
                //   - the caller performing the wipe
                const [adminRows] = await sequelize.query(
                    `SELECT DISTINCT u.user_id AS id
                       FROM users u
                       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
                       LEFT JOIN roles r1 ON r1.role_id = ur.role_id
                       LEFT JOIN roles r2 ON r2.role_id = u.role_id
                      WHERE r1.role_name = 'admin'
                         OR r2.role_name = 'admin'
                         OR u.email = :protectedEmail
                         OR u.user_id = :callerId`,
                    {
                        replacements: {
                            protectedEmail: PROTECTED_ADMIN_EMAIL,
                            callerId: callerId || '',
                        },
                        transaction: t,
                    }
                );

                const adminIds = adminRows.map((r) => r.id).filter(Boolean);

                // Safety net: never proceed if we somehow resolved zero admins to
                // keep — that would delete every account and lock everyone out.
                if (adminIds.length === 0) {
                    throw new Error('Aborting wipe: could not identify an admin account to preserve.');
                }

                const [[userCountRow]] = await sequelize.query(
                    `SELECT COUNT(*) AS c FROM users WHERE user_id NOT IN (:ids)`,
                    { replacements: { ids: adminIds }, transaction: t }
                );
                const usersToDelete = Number(userCountRow.c) || 0;

                // Detach role assignments belonging to soon-to-be-deleted users, and
                // null out any assigned_by pointer on surviving rows that references a
                // user we're about to remove.
                await sequelize.query(
                    `UPDATE user_roles SET assigned_by = NULL
                      WHERE assigned_by IS NOT NULL AND assigned_by NOT IN (:ids)`,
                    { replacements: { ids: adminIds }, transaction: t }
                );
                await sequelize.query(
                    `DELETE FROM user_roles WHERE user_id NOT IN (:ids)`,
                    { replacements: { ids: adminIds }, transaction: t }
                );
                await sequelize.query(
                    `DELETE FROM users WHERE user_id NOT IN (:ids)`,
                    { replacements: { ids: adminIds }, transaction: t }
                );

                rowsDeleted.users = usersToDelete;
                rowsDeleted.admins_kept = adminIds.length;
                } finally {
                    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
                }
            });

            // 3) Filesystem wipe (non-transactional — done only after the DB commit
            //    so a DB failure never loses files). Report per-folder results.
            const filesDeleted = UPLOAD_DIRS_TO_CLEAR.map(clearUploadDir);
            const totalFiles = filesDeleted.reduce((sum, r) => sum + r.deleted, 0);
            const fileErrors = filesDeleted.flatMap((r) => r.errors);

            return res.status(200).json({
                success: true,
                message: 'Data wipe completed. Master data and admin account(s) were preserved.',
                rowsDeleted,
                filesDeleted: { total: totalFiles, byFolder: filesDeleted },
                ...(fileErrors.length ? { fileWarnings: fileErrors } : {}),
            });
        } catch (error) {
            console.error('Data wipe error:', error);
            return res.status(500).json({
                success: false,
                message: 'Data wipe failed. No partial database changes were committed.',
                error: error.message,
            });
        }
    },

    /**
     * DESTRUCTIVE: delete ALL parties (and their linked login accounts + party
     * upload files) in one shot, leaving everything else (products, orders,
     * salesmen, distributors, master data, admins) intact.
     *
     * Guarded by: admin role (route middleware) + the same exact confirmation
     * phrase as the full wipe.
     *
     *   POST /api/admin/delete-all-parties
     *   body: { "confirm": "WIPE ALL DATA" }
     */
    async deleteAllParties(req, res) {
        const confirm = req.body && req.body.confirm;
        if (confirm !== CONFIRM_PHRASE) {
            return res.status(400).json({
                success: false,
                message: `Confirmation failed. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`,
            });
        }

        const rowsDeleted = {};
        try {
            await sequelize.transaction(async (t) => {
                // FK checks off so party rows referenced by orders/check-ins can be
                // removed; re-enabled in finally on this connection no matter what.
                await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction: t });
                try {
                    // The login accounts that belong to parties — deleted with them.
                    // CRITICAL: never collect an admin's account (or the caller, or the
                    // protected superadmin). If an admin is ever also linked to a party,
                    // deleting it here would strip their role and lock them out.
                    const [partyUserRows] = await sequelize.query(
                        `SELECT DISTINCT p.user_id AS id
                           FROM parties p
                          WHERE p.user_id IS NOT NULL
                            AND p.user_id <> :callerId
                            AND p.user_id NOT IN (
                                SELECT u.user_id FROM users u
                                LEFT JOIN user_roles ur ON ur.user_id = u.user_id
                                LEFT JOIN roles r1 ON r1.role_id = ur.role_id
                                LEFT JOIN roles r2 ON r2.role_id = u.role_id
                                WHERE r1.role_name = 'admin'
                                   OR r2.role_name = 'admin'
                                   OR u.email = :protectedEmail
                            )`,
                        {
                            replacements: {
                                callerId: (req.user && req.user.user_id) || '',
                                protectedEmail: PROTECTED_ADMIN_EMAIL,
                            },
                            transaction: t,
                        }
                    );
                    const partyUserIds = partyUserRows.map((r) => r.id).filter(Boolean);

                    rowsDeleted.parties = await Party.destroy({ where: {}, transaction: t });

                    if (partyUserIds.length) {
                        await sequelize.query(
                            `DELETE FROM user_roles WHERE user_id IN (:ids)`,
                            { replacements: { ids: partyUserIds }, transaction: t }
                        );
                        const [[cntRow]] = await sequelize.query(
                            `SELECT COUNT(*) AS c FROM users
                              WHERE user_id IN (:ids)
                                AND email <> :protectedEmail`,
                            { replacements: { ids: partyUserIds, protectedEmail: PROTECTED_ADMIN_EMAIL }, transaction: t }
                        );
                        await sequelize.query(
                            `DELETE FROM users WHERE user_id IN (:ids) AND email <> :protectedEmail`,
                            { replacements: { ids: partyUserIds, protectedEmail: PROTECTED_ADMIN_EMAIL }, transaction: t }
                        );
                        rowsDeleted.party_users = Number(cntRow.c) || 0;
                    } else {
                        rowsDeleted.party_users = 0;
                    }
                } finally {
                    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction: t });
                }
            });

            // Party document/KYC uploads — all parties are gone, so clear the folder.
            const filesResult = clearUploadDir('party_uploads');

            return res.status(200).json({
                success: true,
                message: `Deleted ${rowsDeleted.parties} part${rowsDeleted.parties === 1 ? 'y' : 'ies'} and ${rowsDeleted.party_users} linked login account(s).`,
                rowsDeleted,
                filesDeleted: { total: filesResult.deleted, byFolder: [filesResult] },
                ...(filesResult.errors.length ? { fileWarnings: filesResult.errors } : {}),
            });
        } catch (error) {
            console.error('Delete all parties error:', error);
            return res.status(500).json({
                success: false,
                message: 'Delete all parties failed. No partial database changes were committed.',
                error: error.message,
            });
        }
    },
};

module.exports = dataWipeController;
