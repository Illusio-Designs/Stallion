// Index definitions for the catalogue/content retail tables (same shape as lib/constants/dbIndexes.js, which spreads this in).
// Unique rules live here rather than on the model columns so the alter-sync never piles up duplicate keys on MySQL.
const RETAIL_CATALOG_INDEXES = [
    // retail_products: storefront filters always start from the "visible" triple
    { table: 'retail_products', fields: ['show_on_store', 'is_active', 'stock'], name: 'idx_retail_products_visible' },
    { table: 'retail_products', fields: ['model_no'], name: 'idx_retail_products_model_no' },
    { table: 'retail_products', fields: ['shape'], name: 'idx_retail_products_shape' },
    { table: 'retail_products', fields: ['frame_type'], name: 'idx_retail_products_frame_type' },
    { table: 'retail_products', fields: ['frame_material'], name: 'idx_retail_products_frame_material' },
    { table: 'retail_products', fields: ['gender'], name: 'idx_retail_products_gender' },
    { table: 'retail_products', fields: ['total_sold'], name: 'idx_retail_products_total_sold' },

    // retail_posts
    { table: 'retail_posts', fields: ['slug'], name: 'idx_retail_posts_slug', unique: true },
    { table: 'retail_posts', fields: ['status', 'published_at'], name: 'idx_retail_posts_status_published' },

    // retail_pages / retail_content / retail_faqs
    { table: 'retail_pages', fields: ['path'], name: 'idx_retail_pages_path', unique: true },
    { table: 'retail_content', fields: ['content_key'], name: 'idx_retail_content_key', unique: true },
    { table: 'retail_faqs', fields: ['is_active', 'category', 'sort_order'], name: 'idx_retail_faqs_active_category' },
];

module.exports = { RETAIL_CATALOG_INDEXES };
