/**
 * CREATE TABLE products (
product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
model_no VARCHAR(255) NOT NULL UNIQUE,
gender_id INT,
colour_code_id INT,
shape_id INT,
lens_color_id INT,
frame_color_id INT,
frame_type_id INT,
lens_material_id INT,
frame_material_id INT,
image_url TEXT,
mrp DECIMAL(10,2),
whp DECIMAL(10,2),
size_mm VARCHAR(20),
qty INT DEFAULT 0,
status VARCHAR(20) DEFAULT 'draft',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (gender_id) REFERENCES genders(gender_id),
FOREIGN KEY (colour_code_id) REFERENCES colour_codes(colour_code_id),
FOREIGN KEY (shape_id) REFERENCES shapes(shape_id),
FOREIGN KEY (lens_color_id) REFERENCES lens_colors(lens_color_id),
FOREIGN KEY (frame_color_id) REFERENCES frame_colors(frame_color_id),
FOREIGN KEY (frame_type_id) REFERENCES frame_types(frame_type_id),
FOREIGN KEY (lens_material_id) REFERENCES lens_materials(lens_material_id),
FOREIGN KEY (frame_material_id) REFERENCES frame_materials(frame_material_id)
);

 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Product = sequelize.define('Product', {
    product_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    model_no: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false
    },
    gender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'gender',
            key: 'gender_id'
        }
    },
    color_code_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'color_code',
            key: 'color_code_id'
        }
    },
    shape_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'shape',
            key: 'shape_id'
        }
    },
    lens_color_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'lens_color',
            key: 'lens_color_id'
        }
    },
    frame_color_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'frame_color',
            key: 'frame_color_id'
        }
    },
    frame_type_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'frame_type',
            key: 'frame_type_id'
        }
    },
    lens_material_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'lens_material',
            key: 'lens_material_id'
        }
    },
    frame_material_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'frame_material',
            key: 'frame_material_id'
        }
    },
    image_urls: {
        type: DataTypes.JSON,
        allowNull: true
    },
    mrp: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    whp: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    size_mm: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    warehouse_qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    tray_qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    total_qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'draft'
    },
    brand_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'brand',
            key: 'brand_id'
        }
    },
    collection_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'collection',
            key: 'collection_id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'product',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        { fields: ['collection_id'], name: 'idx_product_collection_id' },
        { fields: ['brand_id'], name: 'idx_product_brand_id' },
        { fields: ['color_code_id'], name: 'idx_product_color_code_id' },
        { fields: ['shape_id'], name: 'idx_product_shape_id' },
        { fields: ['lens_color_id'], name: 'idx_product_lens_color_id' },
        { fields: ['frame_color_id'], name: 'idx_product_frame_color_id' },
        { fields: ['frame_type_id'], name: 'idx_product_frame_type_id' },
        { fields: ['lens_material_id'], name: 'idx_product_lens_material_id' },
        { fields: ['frame_material_id'], name: 'idx_product_frame_material_id' },
        { fields: ['gender_id'], name: 'idx_product_gender_id' },
        { fields: ['model_no'], name: 'idx_product_model_no' },
        { fields: ['status'], name: 'idx_product_status' },
        {
            fields: ['model_no', 'color_code_id'],
            name: 'idx_product_model_no_color_code_unique',
            unique: true,
        },
    ]
});

const Brand = require('./Brand');
const Collection = require('./Collection');
const ColorCode = require('./ColorCode');
const Shape = require('./Shape');
const LensColor = require('./LensColor');
const FrameColor = require('./FrameColor');
const FrameType = require('./FrameType');
const LensMaterial = require('./LensMaterial');
const FrameMaterial = require('./FrameMaterial');
const Gender = require('./Gender');

Product.belongsTo(Gender, { foreignKey: 'gender_id', as: 'gender' });
Product.belongsTo(ColorCode, { foreignKey: 'color_code_id', as: 'color_code' });
Product.belongsTo(Shape, { foreignKey: 'shape_id', as: 'shape' });
Product.belongsTo(LensColor, { foreignKey: 'lens_color_id', as: 'lens_color' });
Product.belongsTo(FrameColor, { foreignKey: 'frame_color_id', as: 'frame_color' });
Product.belongsTo(FrameType, { foreignKey: 'frame_type_id', as: 'frame_type' });
Product.belongsTo(LensMaterial, { foreignKey: 'lens_material_id', as: 'lens_material' });
Product.belongsTo(FrameMaterial, { foreignKey: 'frame_material_id', as: 'frame_material' });
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Product.belongsTo(Collection, { foreignKey: 'collection_id', as: 'collection' });

module.exports = Product;