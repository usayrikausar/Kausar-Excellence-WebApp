process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-kausar-group';
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ projectId: 'demo-kausar-group' });
const db = getFirestore();

const records = JSON.parse(readFileSync(new URL('./parsed_perancangan.json', import.meta.url), 'utf8'));

const usersSnap = await db.collection('users').get();
const byDaieId = new Map();
const byNormName = new Map();
function normName(n) {
  return n.toUpperCase().replace(/[^A-Z]/g, '');
}
usersSnap.forEach((doc) => {
  const d = doc.data();
  if (d.daieId) byDaieId.set(String(d.daieId), { uid: doc.id, ...d });
  const key = normName(d.name);
  if (!byNormName.has(key)) byNormName.set(key, []);
  byNormName.get(key).push({ uid: doc.id, ...d });
});

const matchedByKod = new Map(); // uid -> {user, total, rows: []}
const unmatched = [];

for (const rec of records) {
  let user = rec.kod ? byDaieId.get(rec.kod) : null;
  let how = 'kod';
  if (!user) {
    const candidates = byNormName.get(normName(rec.name)) ?? [];
    if (candidates.length === 1) {
      user = candidates[0];
      how = 'name';
    } else if (candidates.length > 1) {
      how = 'ambiguous-name';
    }
  }
  if (user) {
    if (!matchedByKod.has(user.uid)) matchedByKod.set(user.uid, { user, total: 0, rows: [] });
    const entry = matchedByKod.get(user.uid);
    entry.total += rec.jumlah;
    entry.rows.push({ ...rec, matchedHow: how });
  } else {
    unmatched.push({ ...rec, matchedHow: how });
  }
}

console.log('Matched to', matchedByKod.size, 'distinct users, from', records.length, 'rows');
console.log('Unmatched rows:', unmatched.length);
console.log('\n--- Unmatched (name, kod, unit, jumlah) ---');
for (const u of unmatched) {
  console.log(u.name, '|', u.kod, '|', u.unit, '|', u.jumlah, '|', u.matchedHow);
}

// people matched from MULTIPLE rows (the "same name, add both figure" case)
const multi = [...matchedByKod.values()].filter((e) => e.rows.length > 1);
console.log('\n--- People with multiple rows (summed) ---');
for (const m of multi) {
  console.log(m.user.name, m.user.daieId, '-> total', m.total, 'from', m.rows.length, 'rows:', m.rows.map(r => `${r.unit}:${r.jumlah}`).join(', '));
}

const output = [...matchedByKod.values()].map((e) => ({
  uid: e.user.uid,
  daieId: e.user.daieId,
  name: e.user.name,
  unitId: e.user.unitId,
  total: Math.round(e.total * 100) / 100,
  rowCount: e.rows.length,
}));
writeFileSync(new URL('./matched_perancangan.json', import.meta.url), JSON.stringify(output, null, 1));
console.log('\nWrote matched_perancangan.json with', output.length, 'entries');
