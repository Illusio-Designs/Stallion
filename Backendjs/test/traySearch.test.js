const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup({ search = 'MODEL', fail = false } = {}) {
  const Op = Object.fromEntries(['in', 'gt', 'ne', 'like'].map(k => [k, Symbol(k)]));
  let query;
  const models = {
    Product: {
      findAndCountAll: async q => {
        query = q;
        if (fail) throw Error('Database unavailable');
        return { count: 22, rows: [
          { product_id: 'p1', model_no: 'Model 1' },
          { product_id: 'p2', model_no: 'Model 2' },
        ] };
      },
      findAll: async () => [{ product_id: 'p1', model_no: 'Model 1' }],
    },
    TrayProducts: { findAll: async () => [{ product_id: 'p1', tray_id: 't1', qty: 1 }, { product_id: 'p1', tray_id: 't2', qty: 1 }] },
    Tray: { findAll: async () => [{ tray_id: 't1', tray_name: 'Tray 1' }, { tray_id: 't2', tray_name: 'Tray 2' }] },
    SalesmanTray: { findAll: async () => [{ tray_id: 't1', salesman_id: 's1' }] },
    Salesman: { findAll: async () => [{ salesman_id: 's1', full_name: 'Holder' }] },
  };
  const helpers = {
    parsePaginationParams: () => ({ page: 2, limit: 20, offset: 20 }),
    getListSearchParams: req => ({ name: req.query.search.trim() }),
    likeContains: s => '%' + s.replace(/[\\%_]/g, '\\$&') + '%',
    buildPaginatedResponse: (data, pagination, total) => ({ data, pagination: { ...pagination, total } }),
  };
  const context = { module: { exports: {} }, require: name => {
    if (name.startsWith('../models/')) return models[path.basename(name)] || {};
    if (name === 'sequelize') return { Op, fn: (...args) => args, col: s => s, where: (...args) => args };
    if (name.endsWith('listSearchHelpers')) return helpers;
    return {};
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/controllers/trayController.js'), 'utf8'), context);
  const res = { status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } };
  return { run: () => context.module.exports.searchProducts({ query: { search } }, res), res, getQuery: () => query, Op };
}

test('catalog search includes unassigned products, multiple trays and office holders', async () => {
  const x = setup(); await x.run();
  assert.equal(x.res.statusCode, 200);
  assert.equal(x.res.data.data[0].assignments.length, 2);
  assert.equal(x.res.data.data[0].assignments[0].holder_name, 'Holder');
  assert.equal(x.res.data.data[0].assignments[1].holder_name, null);
  assert.equal(x.res.data.data[1].assignments.length, 0);
  assert.equal(x.getQuery().offset, 20);
  assert.equal(x.res.data.pagination.total, 22);
  assert.equal(x.getQuery().where[1][x.Op.like], '%model%');
});
test('search escapes wildcard input', async () => {
  const x = setup({ search: 'A%_' }); await x.run();
  assert.equal(x.getQuery().where[1][x.Op.like], '%a\\%\\_%');
});
test('blank search skips database queries', async () => {
  const x = setup({ search: '  ' }); await x.run();
  assert.equal(x.getQuery(), undefined);
  assert.equal(x.res.data.data.length, 0);
});
test('search reports failures instead of claiming products are unassigned', async () => {
  const x = setup({ fail: true }); await x.run();
  assert.equal(x.res.statusCode, 500);
  assert.equal(x.res.data.error, 'Database unavailable');
});
