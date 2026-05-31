import { compactNameMatch, exactCustomerNameMatch } from './customerNameMatch.js';
import { findCustomersInText } from './voiceParse.js';

function compactName(s) {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

export function isLineGroupOrder(lineGroupId) {
  return !!String(lineGroupId || '').trim();
}

export function collectCustomerSearchNames(customer) {
  const aliases = Array.isArray(customer?.aliases) ? customer.aliases : [];
  return [customer?.name, customer?.nickname, customer?.shortName, ...aliases]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
}

export function suggestCustomersForLineName(customerName, allCustomers) {
  const want = String(customerName || '').trim();
  if (!want) return [];

  const list = (allCustomers || []).filter((c) => c.id && c.id !== 'general');
  const hits = new Map();

  for (const c of list) {
    for (const label of collectCustomerSearchNames(c)) {
      if (exactCustomerNameMatch(label, want)) {
        hits.set(c.id, { customer: c, reason: 'ชื่อตรง', score: 3 });
        break;
      }
      if (compactNameMatch(label, want)) {
        const prev = hits.get(c.id);
        if (!prev || prev.score < 2) {
          hits.set(c.id, { customer: c, reason: 'ชื่อใกล้เคียง', score: 2 });
        }
        break;
      }
    }
  }

  const foundInText = findCustomersInText(want, list);
  for (const f of foundInText) {
    const c = list.find((x) => x.id === f.id);
    if (!c) continue;
    if (!hits.has(c.id)) hits.set(c.id, { customer: c, reason: 'พบในข้อความ', score: 2 });
  }

  return [...hits.values()].sort((a, b) => b.score - a.score);
}

/** จับคู่จากชื่อเท่านั้น (ไม่มี lineUserId) */
export function resolveLineCustomerByName(customerName, allCustomers) {
  const list = allCustomers || [];
  const general = list.find((c) => c.id === 'general') || {
    id: 'general',
    name: 'ลูกค้าทั่วไปและตลาดนัด',
    zone: 'ทั่วไป',
  };

  if (!customerName?.trim()) return general;

  const suggestions = suggestCustomersForLineName(customerName, list);
  if (suggestions.length === 1 && suggestions[0].score >= 2) {
    return suggestions[0].customer;
  }
  if (suggestions.length > 0 && suggestions[0].score === 3) {
    return suggestions[0].customer;
  }

  const found = findCustomersInText(customerName, list);
  if (found.length === 1) {
    return list.find((c) => c.id === found[0].id)
      || { id: found[0].id, name: found[0].name, zone: 'ทั่วไป' };
  }

  const cn = compactName(customerName);
  const partials = list.filter((c) => {
    const names = collectCustomerSearchNames(c);
    return names.some((label) => {
      const n = compactName(label);
      return n.includes(cn) || cn.includes(n);
    });
  });
  if (partials.length === 1) return partials[0];

  return { id: 'general', name: customerName.trim(), zone: 'ทั่วไป' };
}

export function lineCustomerNeedsManualPick(customer) {
  return !customer?.id || customer.id === 'general';
}
