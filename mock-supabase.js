// ============================================================
// MOCK SUPABASE (in-memory) — HANYA UNTUK UJI LOKAL
// Meniru subset API supabase-js yang dipakai server.js,
// sehingga aplikasi bisa dicoba tanpa koneksi ke Supabase.
// Jalankan: npm run dev   (lihat dev-server.js)
// ============================================================
const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, 'seed.json');
const db = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) : {};
['users', 'schedules', 'questions', 'activity', 'results', 'config'].forEach(t => { db[t] = db[t] || []; });
const seq = {};
Object.keys(db).forEach(t => { seq[t] = db[t].reduce((m, r) => Math.max(m, r.id || 0), 0); });

class Query {
    constructor(table) {
        this.table = table; this.op = 'select'; this.filters = []; this.payload = null;
        this.opts = {}; this.orderBy = null; this.mode = 'many'; this.selectOpts = {}; this.returning = false;
    }
    select(cols, opts) { if (this.op === 'select') { this.selectOpts = opts || {}; } else { this.returning = true; } return this; }
    insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
    upsert(rows, opts) { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.opts = opts || {}; return this; }
    update(v) { this.op = 'update'; this.payload = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filters.push(r => String(r[c]) === String(v)); return this; }
    neq(c, v) { this.filters.push(r => String(r[c]) !== String(v)); return this; }
    in(c, arr) { const s = arr.map(String); this.filters.push(r => s.includes(String(r[c]))); return this; }
    ilike(c, p) { const re = new RegExp('^' + p.replace(/%/g, '.*') + '$', 'i'); this.filters.push(r => re.test(r[c] || '')); return this; }
    order(c, o) { this.orderBy = { c, asc: !o || o.ascending !== false }; return this; }
    limit() { return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybe'; return this; }
    match(r) { return this.filters.every(f => f(r)); }
    run() {
        const rows = db[this.table] = db[this.table] || [];
        const clone = o => JSON.parse(JSON.stringify(o));
        if (this.op === 'insert') {
            const out = this.payload.map(r => { const n = { id: ++seq[this.table] || (seq[this.table] = 1), ...clone(r) }; rows.push(n); return n; });
            return { data: this.returning ? out : null, error: null };
        }
        if (this.op === 'upsert') {
            const keys = (this.opts.onConflict || 'id').split(',').map(s => s.trim());
            this.payload.forEach(r => {
                const ex = rows.find(x => keys.every(k => String(x[k]) === String(r[k])));
                if (ex) Object.assign(ex, clone(r)); else rows.push({ id: (seq[this.table] = (seq[this.table] || 0) + 1), ...clone(r) });
            });
            return { data: null, error: null };
        }
        let hit = rows.filter(r => this.match(r));
        if (this.op === 'update') { hit.forEach(r => Object.assign(r, clone(this.payload))); return { data: this.returning ? hit : null, error: null }; }
        if (this.op === 'delete') { db[this.table] = rows.filter(r => !this.match(r)); return { data: null, error: null }; }
        if (this.orderBy) { const { c, asc } = this.orderBy; hit = [...hit].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
        if (this.selectOpts.head) return { data: null, count: hit.length, error: null };
        hit = clone(hit);
        if (this.mode === 'single') return hit.length === 1 ? { data: hit[0], error: null } : { data: null, error: { message: 'Row not found' } };
        if (this.mode === 'maybe') return { data: hit[0] || null, error: null };
        return { data: hit, count: hit.length, error: null };
    }
    then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
}

module.exports = { createClient: () => ({ from: t => new Query(t) }), _db: db };
