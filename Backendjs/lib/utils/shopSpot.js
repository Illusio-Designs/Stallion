// "Learn the spot": the first visit order or check-in at a shop whose point only came from its
// address saves the phone's position as the shop's precise spot (location_source 'verified'),
// so every later visit is measured against the real shop door with the 50m rule.
const Party = require('../models/Party');
const { logAudit } = require('./auditLogger');

async function learnShopSpot(req, party, { latitude, longitude, accuracy }, options = {}) {
  try {
    const lat = Number(latitude), lng = Number(longitude), acc = Number(accuracy);
    if (!party || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const oldSnapshot = party.toJSON();
    await Party.update(
      { latitude: lat, longitude: lng, location_source: 'verified', location_accuracy_m: Number.isFinite(acc) ? acc : null, updated_at: new Date() },
      { where: { party_id: party.party_id }, transaction: options.transaction },
    );
    await logAudit({
      req,
      transaction: options.transaction,
      action: 'update',
      description: `Shop spot saved from the first visit (±${Number.isFinite(acc) ? Math.round(acc) : '?'}m)`,
      tableName: 'parties',
      recordId: party.party_id,
      oldValues: oldSnapshot,
      newValues: { ...oldSnapshot, latitude: lat, longitude: lng, location_source: 'verified' },
    });
    return true;
  } catch (err) {
    console.warn('[learnShopSpot] could not save the shop spot:', err.message);
    return false;
  }
}

module.exports = { learnShopSpot };
