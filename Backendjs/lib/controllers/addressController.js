const { Op, fn, col, where: sqlWhere } = require('sequelize');
const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/Cities');
const { logAudit } = require('../utils/auditLogger');
const places = require('../utils/googlePlaces');
const { resolveUserScope } = require('../utils/scopeHelpers');
const { salesmanStateIds } = require('../utils/workingStates');
const { isOfficeRole } = require('../utils/roleHelpers');

const ci = (column, value) => sqlWhere(fn('LOWER', col(column)), String(value).trim().toLowerCase());

// Find the row, or add it when the list does not have it yet. A row that was switched
// off in Manage is never switched back on or silently replaced: the caller is told.
async function findOrCreate(req, Model, label, lookup, values) {
  const found = await Model.findOne({ where: lookup });
  if (found) {
    return { row: found, created: false, inactive: found.is_active === false };
  }
  const row = await Model.create({ ...values, is_active: true });
  await logAudit({
    req,
    action: 'create',
    description: `${label} added from a Google address`,
    tableName: Model.getTableName(),
    recordId: row.id,
    oldValues: null,
    newValues: row,
  });
  return { row, created: true, inactive: false };
}

class AddressController {
    // POST /parties/address-suggest { input, session }
    async suggest(req, res) {
        try {
            if (!places.isConfigured()) return res.status(200).json({ configured: false, suggestions: [] });
            const input = String((req.body && req.body.input) || '').trim();
            if (input.length < 3) return res.status(200).json({ configured: true, suggestions: [] });
            const suggestions = await places.suggest(input, req.body && req.body.session);
            return res.status(200).json({ configured: true, suggestions });
        } catch (error) {
            // Never block the form: typing by hand always works.
            console.warn('[address-suggest]', error.message);
            return res.status(200).json({ configured: true, suggestions: [], unavailable: true, reason: String(error.message || '').slice(0, 240) });
        }
    }

    // POST /parties/address-details { place_id, session }
    // Returns the address and the ids of its country, state and city. Missing ones are added.
    async details(req, res) {
        try {
            if (!places.isConfigured()) return res.status(200).json({ configured: false });
            const placeId = req.body && req.body.place_id;
            if (!placeId) return res.status(400).json({ error: 'place_id is required' });
            const d = await places.details(placeId, req.body && req.body.session);

            const out = { configured: true, address: d.address, pincode: d.pincode, latitude: d.latitude, longitude: d.longitude, added: [] };
            let country = null, state = null, city = null;

            if (d.country) {
                const r = await findOrCreate(req, Country, 'Country',
                    { [Op.or]: [ci('name', d.country), ...(d.country_code ? [ci('code', d.country_code)] : [])] },
                    { name: d.country, code: d.country_code || null });
                if (r.inactive) return res.status(200).json({ ...out, blocked: { what: 'country', name: d.country } });
                country = r.row; if (r.created) out.added.push(`country ${d.country}`);
            }
            // A salesman only works in his allotted states: nothing is added for another state.
            let allowedStateIds = null;
            if (!isOfficeRole(req.userRoleNames || []) && String(req.userRoleName || '').toLowerCase() === 'salesman') {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                allowedStateIds = await salesmanStateIds(scope && scope.salesmanId);
                const existing = d.state ? await State.findOne({ where: ci('name', d.state) }) : null;
                if (!existing || !allowedStateIds.includes(String(existing.id))) {
                    return res.status(200).json({ ...out, blocked: { what: 'state_not_allotted', name: d.state || '' }, names: { state: d.state } });
                }
            }
            if (country && d.state) {
                // State names are unique across the table, so match by name only.
                let code = d.state_code && d.state_code.length <= 10 ? d.state_code.toUpperCase() : null;
                if (code && await State.findOne({ where: { code } })) code = null;
                const r = await findOrCreate(req, State, 'State',
                    ci('name', d.state),
                    { name: d.state, code, country_id: country.id });
                if (r.inactive) return res.status(200).json({ ...out, blocked: { what: 'state', name: d.state } });
                state = r.row; if (r.created) out.added.push(`state ${d.state}`);
            }
            if (state && d.city) {
                const r = await findOrCreate(req, City, 'City',
                    { [Op.and]: [ci('name', d.city), { state_id: state.id }] },
                    { name: d.city, state_id: state.id });
                if (r.inactive) return res.status(200).json({ ...out, blocked: { what: 'city', name: d.city } });
                city = r.row; if (r.created) out.added.push(`city ${d.city}`);
            }
            out.country_id = country ? country.id : null;
            out.state_id = state ? state.id : null;
            out.city_id = city ? city.id : null;
            out.names = { country: d.country, state: d.state, city: d.city };
            return res.status(200).json(out);
        } catch (error) {
            console.warn('[address-details]', error.message);
            return res.status(200).json({ configured: true, unavailable: true, reason: String(error.message || '').slice(0, 240) });
        }
    }
}

module.exports = new AddressController();
