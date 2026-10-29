// Writes an entry to the existing audit_logs table (via the shared auditLogger) for retail admin changes.
// Best effort: a logging problem must never fail the admin's save. Never pass secrets in the values.
const { logAudit, AuditAction } = require('../../utils/auditLogger');

async function audit(req, action, tableName, recordId, description, oldValues, newValues) {
    try {
        await logAudit({ req, action: AuditAction[action.toUpperCase()] || action, description, tableName, recordId, oldValues, newValues });
    } catch (err) {
        console.log('⚠️ Retail audit entry skipped:', err.message);
    }
}

module.exports = { audit };
