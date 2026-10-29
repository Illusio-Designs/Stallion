const RetailSetting = require('../models/RetailSetting');

const parse = (v) => { try { return JSON.parse(v); } catch (_e) { return v; } };

// Read one setting (parsed JSON) or a fallback.
async function getSetting(key, fallback = null) {
    const row = await RetailSetting.findByPk(key);
    return row && row.value != null ? parse(row.value) : fallback;
}

// Read several at once: { key: value }.
async function getSettings(keys) {
    const rows = await RetailSetting.findAll({ where: { setting_key: keys } });
    const out = {};
    rows.forEach((r) => { out[r.setting_key] = parse(r.value); });
    return out;
}

async function setSetting(key, value, { secret = false } = {}) {
    await RetailSetting.upsert({ setting_key: key, value: JSON.stringify(value), is_secret: secret });
    return value;
}

module.exports = { getSetting, getSettings, setSetting };
