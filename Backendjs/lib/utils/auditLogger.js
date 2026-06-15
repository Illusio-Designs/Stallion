const AuditLog = require('../models/AuditLog');
const { AuditAction } = require('../constants/enums');

/** Maps legacy or alias table_name values to actual DB table names. */
const AUDIT_TABLES = {
    brand: 'brand',
    brands: 'brand',
    collection: 'collection',
    collections: 'collection',
    tray: 'tray',
    trays: 'tray',
    gender: 'gender',
    genders: 'gender',
    shape: 'shape',
    shapes: 'shape',
    products: 'product',
    product: 'product',
    orders: 'order',
    order: 'order',
    events: 'event',
    event: 'event',
    tray_products: 'tray_product',
    tray_product: 'tray_product',
    frame_type: 'frame_type',
    frame_types: 'frame_type',
    frame_material: 'frame_material',
    frame_color: 'frame_color',
    lens_color: 'lens_color',
    lens_material: 'lens_material',
    color_code: 'color_code',
    salesman_expense: 'salesman_expense',
    salesman_expenses: 'salesman_expense',
    parties: 'parties',
    users: 'users',
    distributors: 'distributors',
    salesmen: 'salesmen',
    countries: 'countries',
    states: 'states',
    cities: 'cities',
    zones: 'zones',
    salesman_targets: 'salesman_targets',
    salesman_check_ins: 'salesman_check_ins',
    salesman_tray: 'salesman_tray',
    distributor_zones: 'distributor_zones',
    salesman_zones: 'salesman_zones',
};

function resolveTableName(tableName) {
    if (!tableName) return tableName;
    return AUDIT_TABLES[tableName] ?? tableName;
}

function serializeValues(val) {
    if (val == null) return null;
    if (Array.isArray(val)) return null;
    if (typeof val.toJSON === 'function') return val.toJSON();
    return val;
}

async function logAudit({
    req,
    transaction,
    actorId,
    action,
    description,
    tableName,
    recordId,
    oldValues,
    newValues,
}) {
    const payload = {
        user_id: actorId ?? req?.user?.user_id ?? null,
        action,
        description: description ?? null,
        table_name: resolveTableName(tableName),
        record_id: recordId != null ? String(recordId) : null,
        old_values: serializeValues(oldValues),
        new_values: serializeValues(newValues),
        ip_address: req?.ip ?? null,
    };

    return AuditLog.create(payload, transaction ? { transaction } : undefined);
}

module.exports = {
    logAudit,
    resolveTableName,
    serializeValues,
    AuditAction,
};
