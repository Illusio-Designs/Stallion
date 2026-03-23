/** 
 * CREATE TABLE salesmen (
salesman_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL,
employee_code VARCHAR(50) UNIQUE,
phone VARCHAR(20) NOT NULL,
alternate_phone VARCHAR(20),
email VARCHAR(255),
full_name VARCHAR(255) NOT NULL,
reporting_manager UUID,
address TEXT,
country_id UUID,
state_id UUID,
city_id UUID,
zone_preference TEXT,
joining_date DATE,
is_active BOOLEAN DEFAULT true,
created_by UUID,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
FOREIGN KEY (reporting_manager) REFERENCES users(user_id),
FOREIGN KEY (country_id) REFERENCES countries(country_id),
FOREIGN KEY (state_id) REFERENCES states(state_id),
FOREIGN KEY (city_id) REFERENCES cities(city_id)
);
*/

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Salesman = sequelize.define('Salesman', {
    salesman_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    employee_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    alternate_phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    full_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    reporting_manager: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    country_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'countries',
            key: 'id'
        }
    },
    state_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'states',
            key: 'id'
        }
    },
    city_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'cities',
            key: 'id'
        }
    },
    zone_preference: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    joining_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
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
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    }
}, {
    tableName: 'salesmen',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Salesman;