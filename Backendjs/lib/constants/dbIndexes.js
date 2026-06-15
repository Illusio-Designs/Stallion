/**
 * Canonical database index definitions.
 *
 * Every entry MUST have an explicit `name` so DatabaseManager can add indexes
 * idempotently on existing live databases without relying on Sequelize alter/sync.
 *
 * Applied on startup via DatabaseManager.syncIndexes().
 */
const DB_INDEXES = [
    // ── users (manually managed table) ──────────────────────────────────────
    { table: 'users', fields: ['role_id'], name: 'idx_users_role_id' },
    { table: 'users', fields: ['is_active'], name: 'idx_users_is_active' },
    { table: 'users', fields: ['phone'], name: 'idx_users_phone' },

    // ── user_roles ─────────────────────────────────────────────────────────
    { table: 'user_roles', fields: ['user_id'], name: 'idx_user_roles_user_id' },
    { table: 'user_roles', fields: ['role_id'], name: 'idx_user_roles_role_id' },
    {
        table: 'user_roles',
        fields: ['user_id', 'role_id'],
        name: 'idx_user_roles_user_id_role_id_unique',
        unique: true,
    },

    // ── audit_logs ───────────────────────────────────────────────────────────
    { table: 'audit_logs', fields: ['user_id'], name: 'idx_audit_logs_user_id' },
    { table: 'audit_logs', fields: ['table_name'], name: 'idx_audit_logs_table_name' },
    { table: 'audit_logs', fields: ['record_id'], name: 'idx_audit_logs_record_id' },
    { table: 'audit_logs', fields: ['action'], name: 'idx_audit_logs_action' },
    { table: 'audit_logs', fields: ['created_at'], name: 'idx_audit_logs_created_at' },
    { table: 'audit_logs', fields: ['table_name', 'record_id'], name: 'idx_audit_logs_table_record' },

    // ── parties ────────────────────────────────────────────────────────────
    { table: 'parties', fields: ['salesman_id'], name: 'idx_parties_salesman_id' },
    { table: 'parties', fields: ['distributor_id'], name: 'idx_parties_distributor_id' },
    { table: 'parties', fields: ['zone_id'], name: 'idx_parties_zone_id' },
    { table: 'parties', fields: ['user_id'], name: 'idx_parties_user_id' },
    { table: 'parties', fields: ['is_active'], name: 'idx_parties_is_active' },
    { table: 'parties', fields: ['salesman_id', 'is_active'], name: 'idx_parties_salesman_active' },
    { table: 'parties', fields: ['phone'], name: 'idx_parties_phone' },

    // ── distributors ───────────────────────────────────────────────────────
    { table: 'distributors', fields: ['user_id'], name: 'idx_distributors_user_id' },
    { table: 'distributors', fields: ['is_active'], name: 'idx_distributors_is_active' },
    { table: 'distributors', fields: ['country_id'], name: 'idx_distributors_country_id' },
    { table: 'distributors', fields: ['phone'], name: 'idx_distributors_phone' },

    // ── salesmen ───────────────────────────────────────────────────────────
    { table: 'salesmen', fields: ['user_id'], name: 'idx_salesmen_user_id' },
    { table: 'salesmen', fields: ['is_active'], name: 'idx_salesmen_is_active' },
    { table: 'salesmen', fields: ['employee_code'], name: 'idx_salesmen_employee_code' },

    // ── order ──────────────────────────────────────────────────────────────
    { table: 'order', fields: ['party_id'], name: 'idx_order_party_id' },
    { table: 'order', fields: ['distributor_id'], name: 'idx_order_distributor_id' },
    { table: 'order', fields: ['salesman_id'], name: 'idx_order_salesman_id' },
    { table: 'order', fields: ['order_status'], name: 'idx_order_status' },
    { table: 'order', fields: ['order_date'], name: 'idx_order_order_date' },
    { table: 'order', fields: ['event_id'], name: 'idx_order_event_id' },
    { table: 'order', fields: ['order_number'], name: 'idx_order_order_number' },
    { table: 'order', fields: ['salesman_id', 'order_date'], name: 'idx_order_salesman_date' },
    { table: 'order', fields: ['party_id', 'order_status'], name: 'idx_order_party_status' },

    // ── order_operation ────────────────────────────────────────────────────
    { table: 'order_operation', fields: ['order_id'], name: 'idx_order_operation_order_id' },
    { table: 'order_operation', fields: ['product_id'], name: 'idx_order_operation_product_id' },
    { table: 'order_operation', fields: ['order_id', 'product_id'], name: 'idx_order_operation_order_product' },

    // ── product ────────────────────────────────────────────────────────────
    { table: 'product', fields: ['collection_id'], name: 'idx_product_collection_id' },
    { table: 'product', fields: ['brand_id'], name: 'idx_product_brand_id' },
    { table: 'product', fields: ['color_code_id'], name: 'idx_product_color_code_id' },
    { table: 'product', fields: ['shape_id'], name: 'idx_product_shape_id' },
    { table: 'product', fields: ['lens_color_id'], name: 'idx_product_lens_color_id' },
    { table: 'product', fields: ['frame_color_id'], name: 'idx_product_frame_color_id' },
    { table: 'product', fields: ['frame_type_id'], name: 'idx_product_frame_type_id' },
    { table: 'product', fields: ['lens_material_id'], name: 'idx_product_lens_material_id' },
    { table: 'product', fields: ['frame_material_id'], name: 'idx_product_frame_material_id' },
    { table: 'product', fields: ['gender_id'], name: 'idx_product_gender_id' },
    { table: 'product', fields: ['model_no'], name: 'idx_product_model_no' },
    { table: 'product', fields: ['status'], name: 'idx_product_status' },
    {
        table: 'product',
        fields: ['model_no', 'color_code_id'],
        name: 'idx_product_model_no_color_code_unique',
        unique: true,
    },

    // ── tray_product ─────────────────────────────────────────────────────────
    { table: 'tray_product', fields: ['tray_id'], name: 'idx_tray_product_tray_id' },
    { table: 'tray_product', fields: ['product_id'], name: 'idx_tray_product_product_id' },
    { table: 'tray_product', fields: ['status'], name: 'idx_tray_product_status' },
    {
        table: 'tray_product',
        fields: ['tray_id', 'product_id'],
        name: 'idx_tray_product_tray_product_unique',
        unique: true,
    },
    { table: 'tray_product', fields: ['product_id', 'status'], name: 'idx_tray_product_product_status' },

    // ── salesman_tray ──────────────────────────────────────────────────────
    { table: 'salesman_tray', fields: ['salesman_id'], name: 'idx_salesman_tray_salesman_id' },
    { table: 'salesman_tray', fields: ['tray_id'], name: 'idx_salesman_tray_tray_id' },

    // ── distributor_zones ────────────────────────────────────────────────────
    { table: 'distributor_zones', fields: ['distributor_id'], name: 'idx_distributor_zones_distributor_id' },
    { table: 'distributor_zones', fields: ['zone_id'], name: 'idx_distributor_zones_zone_id' },
    {
        table: 'distributor_zones',
        fields: ['distributor_id', 'zone_id'],
        name: 'idx_distributor_zones_dist_zone_unique',
        unique: true,
    },

    // ── salesman_zones ───────────────────────────────────────────────────────
    { table: 'salesman_zones', fields: ['salesman_id'], name: 'idx_salesman_zones_salesman_id' },
    { table: 'salesman_zones', fields: ['zone_id'], name: 'idx_salesman_zones_zone_id' },
    {
        table: 'salesman_zones',
        fields: ['salesman_id', 'zone_id'],
        name: 'idx_salesman_zones_salesman_zone_unique',
        unique: true,
    },

    // ── salesman_expense ───────────────────────────────────────────────────
    { table: 'salesman_expense', fields: ['salesman_id'], name: 'idx_salesman_expense_salesman_id' },
    { table: 'salesman_expense', fields: ['status'], name: 'idx_salesman_expense_status' },
    { table: 'salesman_expense', fields: ['expense_date'], name: 'idx_salesman_expense_date' },
    { table: 'salesman_expense', fields: ['salesman_id', 'status'], name: 'idx_salesman_expense_salesman_status' },

    // ── salesman_targets ───────────────────────────────────────────────────
    { table: 'salesman_targets', fields: ['salesman_id'], name: 'idx_salesman_targets_salesman_id' },
    { table: 'salesman_targets', fields: ['end_date'], name: 'idx_salesman_targets_end_date' },
    { table: 'salesman_targets', fields: ['salesman_id', 'end_date'], name: 'idx_salesman_targets_salesman_end' },

    // ── salesman_check_ins ───────────────────────────────────────────────────
    { table: 'salesman_check_ins', fields: ['salesman_id'], name: 'idx_salesman_check_ins_salesman_id' },
    { table: 'salesman_check_ins', fields: ['party_id'], name: 'idx_salesman_check_ins_party_id' },
    { table: 'salesman_check_ins', fields: ['check_in_date'], name: 'idx_salesman_check_ins_date' },

    // ── zones / cities / states (lookup paths) ───────────────────────────────
    { table: 'zones', fields: ['city_id'], name: 'idx_zones_city_id' },
    { table: 'zones', fields: ['state_id'], name: 'idx_zones_state_id' },
    { table: 'cities', fields: ['state_id'], name: 'idx_cities_state_id' },
    { table: 'states', fields: ['country_id'], name: 'idx_states_country_id' },

    // ── collection / brand (product catalog) ───────────────────────────────
    { table: 'collection', fields: ['brand_id'], name: 'idx_collection_brand_id' },
];

module.exports = { DB_INDEXES };
