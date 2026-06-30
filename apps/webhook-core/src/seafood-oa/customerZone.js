const { BUILTIN_CUSTOMERS, BUILTIN_BY_ID } = require('./shrimpBuiltinCustomers');
const { customerMatchesName, canonicalCustomerNameKey } = require('./customerNameAliases');

const DEFAULT_ZONE = 'อื่นๆ';
const ZONE_ORDER = ['ป่าตอง', 'กะทู้', 'ภูเก็ต', 'ราไวย์', 'ทั่วไป', 'LINE OA', DEFAULT_ZONE];

function zoneSortKey(zone) {
  const z = String(zone || '').trim() || DEFAULT_ZONE;
  const idx = ZONE_ORDER.indexOf(z);
  return idx >= 0 ? idx : ZONE_ORDER.length;
}

function catalogRow(data, builtin = null) {
  const name = String(data?.name || builtin?.name || '').trim();
  if (!name) return null;
  return {
    id: data?.id || builtin?.id || '',
    name,
    zone: String(data?.zone || builtin?.zone || '').trim() || DEFAULT_ZONE,
    aliases: Array.isArray(data?.aliases) && data.aliases.length
      ? data.aliases
      : (builtin?.aliases || []),
  };
}

function looseNameZoneMatch(row, want) {
  const target = canonicalCustomerNameKey(want);
  if (!target) return false;
  const labels = [row.name, ...(row.aliases || [])];
  for (const label of labels) {
    const key = canonicalCustomerNameKey(String(label || '').replace(/^ร้าน\s*/i, ''));
    if (!key) continue;
    if (key === target || key.endsWith(target) || target.endsWith(key)) return true;
  }
  return false;
}

function findZoneInCatalog(name, catalog) {
  const want = String(name || '').trim();
  if (!want) return '';
  for (const row of catalog) {
    if (customerMatchesName(row, want) || looseNameZoneMatch(row, want)) {
      return row.zone || DEFAULT_ZONE;
    }
  }
  return '';
}

async function buildCustomerZoneCatalog(db) {
  const byId = {};
  for (const builtin of BUILTIN_CUSTOMERS) {
    byId[builtin.id] = catalogRow({ id: builtin.id }, builtin);
  }

  if (db) {
    const snap = await db.collection('customers').limit(2000).get();
    for (const doc of snap.docs) {
      const data = { id: doc.id, ...(doc.data() || {}) };
      const merged = catalogRow(data, BUILTIN_BY_ID[doc.id]);
      if (merged) byId[doc.id] = { ...byId[doc.id], ...merged };
    }
  }

  return Object.values(byId).filter(Boolean);
}

function orderCustomerNames(order) {
  const names = new Set();
  if (order?.customerName) names.add(String(order.customerName).trim());
  for (const it of order?.items || []) {
    if (it?.customerName) names.add(String(it.customerName).trim());
  }
  return [...names].filter(Boolean);
}

function resolveZoneForOrder(order, catalog) {
  const stored = String(order?.zone || '').trim();
  if (stored) return stored;

  if (order?.customerId && catalog) {
    const byId = catalog.find((row) => row.id === order.customerId);
    if (byId?.zone) return byId.zone;
  }

  for (const name of orderCustomerNames(order)) {
    const zone = findZoneInCatalog(name, catalog);
    if (zone) return zone;
  }

  return DEFAULT_ZONE;
}

function groupOrdersByZone(orders, catalog) {
  const groups = new Map();
  for (const order of orders) {
    const zone = resolveZoneForOrder(order, catalog);
    if (!groups.has(zone)) groups.set(zone, []);
    groups.get(zone).push(order);
  }
  return [...groups.entries()].sort((a, b) => zoneSortKey(a[0]) - zoneSortKey(b[0]));
}

module.exports = {
  DEFAULT_ZONE,
  buildCustomerZoneCatalog,
  findZoneInCatalog,
  groupOrdersByZone,
  resolveZoneForOrder,
  zoneSortKey,
};
