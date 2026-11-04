const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const geo = require('../lib/utils/geo');
const roles = require('../lib/utils/roleHelpers');

// Exercise controller behavior without connecting to the deployment database.
function setup({ role = 'salesman', covered = true, source = 'geocoded', accuracy = 18, updateCount = 1 } = {}) {
  const writes = [];
  const party = { party_id: 'party-1', state_id: 'state-1', city_id: 'old-city', salesman_id: 'salesman-1',
    address: 'Old address', is_active: true, location_source: source, latitude: 21.1, longitude: 72.8,
    toJSON() { return { ...this }; }, async save() { writes.push({ ...this }); } };
  const Party = { findOne: async () => party, update: async (data, options) => { writes.push({ data, options }); return [updateCount]; } };
  const models = {
    Party,
    Country: { findByPk: async id => id === 'country-1' ? { id, is_active: true } : null },
    State: { findByPk: async id => id === 'state-1' ? { id, country_id: 'country-1', is_active: true } : null },
    Cities: { findByPk: async id => id === 'city-1' ? { id, state_id: 'state-1', is_active: true } : null },
  };
  const Op = Object.fromEntries(['or', 'ne', 'and', 'in', 'is'].map(k => [k, Symbol(k)]));
  const context = { module: { exports: {} }, console, process, require: name => {
    if (name.startsWith('../models/')) return models[path.basename(name)] || {};
    if (name === 'sequelize') return { Op };
    if (name === '../utils/geo') return geo;
    if (name === '../utils/roleHelpers') return roles;
    if (name === '../utils/scopeHelpers') return { resolveUserScope: async () => ({ salesmanId: 'salesman-1', distributorId: 'distributor-1' }) };
    if (name === '../utils/workingStates') return { salesmanCoversState: async () => covered, distributorCoversState: async () => covered };
    if (name === '../utils/auditLogger') return { logAudit: async () => {} };
    if (name === '../utils/geocode') return { reverseGeocode: async () => null, geocodeAddress: async () => null };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/controllers/partyController.js'), 'utf8'), context);
  const req = { params: { id: 'party-1' }, user: { user_id: 'user-1' }, userRoleName: role, userRoleNames: [role], body: {
    latitude: 21.1702, longitude: 72.8311, accuracy,
    shipping_address: { address: 'Shop 12, Market Road', pincode: '395009', country_id: 'country-1', state_id: 'state-1', city_id: 'city-1' },
  } };
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } };
  return { controller: context.module.exports, req, res, writes, party, Op };
}

test('confirmed capture writes shipping address and GPS together', async () => {
  const x = setup(); await x.controller.verifyPartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 200);
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].data.address, 'Shop 12, Market Road');
  assert.equal(x.writes[0].data.pincode, '395009');
  assert.equal(x.writes[0].data.latitude, 21.1702);
  assert.equal(x.writes[0].data.location_source, 'verified');
  assert.equal(x.writes[0].data.zone_id, null);
  assert.ok(x.writes[0].options.where[x.Op.or]);
});
test('all roles including admin must remove before recapture', async () => {
  for (const role of ['salesman', 'admin', 'party_manager']) {
    const x = setup({ role, source: 'verified' }); await x.controller.verifyPartyLocation(x.req, x.res);
    assert.equal(x.res.statusCode, 409); assert.equal(x.writes.length, 0);
  }
});
test('weak GPS is rejected for admin too', async () => {
  const x = setup({ role: 'admin', accuracy: 100 }); await x.controller.verifyPartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 422); assert.equal(x.writes.length, 0);
});
test('missing coordinates cannot silently become zero', () => {
  assert.equal(geo.validateOnsiteCapture({ deviceLat: null, deviceLng: null, accuracy: 18 }).ok, false);
});
test('a concurrent capture returns conflict', async () => {
  const x = setup({ updateCount: 0 }); await x.controller.verifyPartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 409);
});
test('invalid PIN or mismatched geography cannot be saved', async () => {
  for (const patch of [{ pincode: '' }, { pincode: '123' }, { city_id: 'other-city' }]) {
    const x = setup(); Object.assign(x.req.body.shipping_address, patch); await x.controller.verifyPartyLocation(x.req, x.res);
    assert.equal(x.res.statusCode, 400); assert.equal(x.writes.length, 0);
  }
});
test('field users cannot capture parties outside their scope', async () => {
  const x = setup({ covered: false }); x.party.salesman_id = 'other-salesman';
  await x.controller.verifyPartyLocation(x.req, x.res); assert.equal(x.res.statusCode, 403); assert.equal(x.writes.length, 0);
});
test('field users cannot move shipping to an unallotted state', async () => {
  const x = setup({ covered: false }); await x.controller.verifyPartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 403); assert.equal(x.writes.length, 0);
});
test('location removal is restricted to authorized office roles', async () => {
  const x = setup(); await x.controller.removePartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 403); assert.equal(x.writes.length, 0);
  const manager = setup({ role: 'party_manager', source: 'verified' });
  await manager.controller.removePartyLocation(manager.req, manager.res);
  assert.equal(manager.res.statusCode, 200); assert.equal(manager.party.location_source, null); assert.equal(manager.party.latitude, null);
});
test('ordinary visits do not implicitly save an unconfirmed address as an exact shop', () => {
  const result = geo.checkVisitLocation({ deviceLat: 21.17, deviceLng: 72.83, accuracy: 18,
    party: { latitude: 21.17, longitude: 72.83, location_source: 'geocoded' } });
  assert.equal(result.ok, true); assert.equal(result.learn, false);
});
test('ordinary shipping edits cannot unlock a verified party', async () => {
  const x = setup({ role: 'party_manager', source: 'verified' });
  x.req.body = { address: 'New wording of shop address', pincode: '395007' };
  await x.controller.updateParty(x.req, x.res);
  assert.equal(x.res.statusCode, 200); assert.equal(x.res.data.location_reset, false);
  assert.equal(x.writes[0].data.latitude, undefined); assert.equal(x.res.data.location_source, 'verified');
});
test('admin setter cannot bypass remove-before-recapture', async () => {
  const x = setup({ role: 'admin', source: 'verified' }); await x.controller.setPartyLocation(x.req, x.res);
  assert.equal(x.res.statusCode, 409); assert.equal(x.writes.length, 0);
});
