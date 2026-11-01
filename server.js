// ============================================================
// CBT SPENDA-DIGI — SERVER API v4
// Express + Supabase (dijalankan sebagai Serverless Function Vercel)
// ============================================================
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const XLSX = require('xlsx');
const mammoth = require('mammoth');
const fs = require('fs');
const os = require('os');
const { scoreExam, sanitizeQuestion } = require('./lib/scoring');

// ── Konfigurasi (bisa diatur lewat Environment Variables di Vercel) ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uftiednbhdmexxlabhad.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const APP_SECRET = process.env.APP_SECRET || crypto.createHash('sha256').update('cbt-spenda::' + SUPABASE_KEY).digest('hex');
const RECOVERY_KEY = process.env.RECOVERY_KEY || '';          // kosong = jalur darurat nonaktif
const SHOW_SCORE_TO_STUDENT = process.env.SHOW_SCORE !== '0';   // tampilkan nilai ke siswa setelah selesai

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 15 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Bungkus handler async agar error tidak membuat function crash
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message || 'Server error' });
});

// ============================================================
// TOKEN (HMAC, tanpa tabel tambahan — cocok untuk serverless)
// ============================================================
const b64 = s => Buffer.from(s).toString('base64url');
function sign(payload, ttlSec) {
    const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
    const sig = crypto.createHmac('sha256', APP_SECRET).update(body).digest('base64url');
    return body + '.' + sig;
}
function verify(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', APP_SECRET).update(body).digest('base64url');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    try {
        const data = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (data.exp && data.exp < Date.now() / 1000) return null;
        return data;
    } catch (e) { return null; }
}

function auth(...roles) {
    return (req, res, next) => {
        const h = req.headers.authorization || '';
        const user = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
        if (!user || user.t !== 'session') return res.status(401).json({ status: 'error', message: 'Sesi berakhir. Silakan login ulang.' });
        if (roles.length && !roles.includes(user.role)) return res.status(403).json({ status: 'error', message: 'Anda tidak memiliki akses untuk tindakan ini.' });
        req.user = user; next();
    };
}
const STAFF = auth('admin', 'guru');
const ADMIN = auth('admin');
const SISWA = auth('siswa');

// Tiket ujian: membuktikan siswa sudah memasukkan PIN yang valid
function readTicket(req) {
    const t = verify(req.body.ticket);
    if (!t || t.t !== 'exam' || t.u !== req.user.username) return null;
    return t;
}

// Cache soal per paket (mengurangi beban Supabase saat ping massal)
const qCache = new Map();
async function getQuestions(mapelStr) {
    const key = mapelStr;
    const hit = qCache.get(key);
    if (hit && hit.until > Date.now()) return hit.data;
    const ids = mapelStr.split(',').map(m => m.trim()).filter(Boolean);
    const { data, error } = await supabase.from('questions').select('*').in('exam_id', ids).order('id', { ascending: true });
    if (error) throw error;
    qCache.set(key, { data: data || [], until: Date.now() + 60 * 1000 });
    return data || [];
}
const clearQCache = () => qCache.clear();

// Insert/update dengan fallback jika kolom opsional belum ada di database
async function withOptionalCols(run, payload, optionalCols) {
    let { error } = await run(payload);
    if (error && optionalCols.some(c => (error.message || '').includes(c))) {
        const p = { ...payload }; optionalCols.forEach(c => delete p[c]);
        ({ error } = await run(p));
        return { error, droppedCols: true };
    }
    return { error, droppedCols: false };
}

const nowTime = () => new Date().toLocaleTimeString('id-ID', { timeZone: process.env.TZ_DISPLAY || 'Asia/Makassar' });
const nowDate = () => new Date().toLocaleDateString('id-ID', { timeZone: process.env.TZ_DISPLAY || 'Asia/Makassar' });
const fmtDur = sec => `${Math.floor(sec / 60)}m ${sec % 60}s`;

// ============================================================
// 0. JALUR DARURAT (PEMULIHAN ADMIN) — wajib RECOVERY_KEY
// ============================================================
app.get('/api/admin/darurat', wrap(async (req, res) => {
    if (!RECOVERY_KEY) return res.status(403).send('<h3>Jalur darurat nonaktif.</h3><p>Set environment variable <b>RECOVERY_KEY</b> di Vercel lalu buka /api/admin/darurat?key=KUNCI_ANDA</p>');
    if (req.query.key !== RECOVERY_KEY) return res.status(403).send('Kunci pemulihan salah.');
    const { error } = await supabase.from('users').upsert({ username: 'admin', password: '123', name: 'Administrator Utama', role: 'admin', kelas: 'Admin', mapel: 'Semua' }, { onConflict: 'username' });
    if (error) return res.send('Gagal memulihkan admin: ' + error.message);
    res.send('<h1>BERHASIL!</h1><p>Akun admin dipulihkan. Username: <b>admin</b>, Password: <b>123</b>. Segera ganti password setelah login.</p>');
}));

// ============================================================
// 1. OTENTIKASI
// ============================================================
app.post('/api/login', wrap(async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ status: 'error', message: 'Username dan password wajib diisi.' });
    const { data } = await supabase.from('users').select('*').eq('username', username).eq('password', password).maybeSingle();
    if (!data) return res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
    const role = String(data.role || 'siswa').toLowerCase();
    const user = { id: data.id, name: data.name, username: data.username, role, kelas: data.kelas || '', mapel: data.mapel || '' };
    const token = sign({ t: 'session', ...user }, role === 'siswa' ? 12 * 3600 : 24 * 3600);
    res.json({ status: 'success', user, token });
}));

app.get('/api/me', auth(), (req, res) => {
    const { t, exp, ...user } = req.user;
    res.json({ status: 'success', user });
});

// ============================================================
// 2. SISWA: CEK PIN, AMBIL SOAL, PING, SUBMIT
// ============================================================
function kelasCocokan(examCode, studentKelas) {
    // MTK-7A → hanya 7A | MTK-7 → semua kelas 7 | IPA → semua kelas
    const e = examCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const s = studentKelas.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const sMatch = s.match(/(\d+)([a-z]?)/);
    if (!sMatch) return e.includes(s);
    const [, sGrade, sLetter] = sMatch;
    if (sLetter && e.includes(sGrade + sLetter)) return true;
    const gradeOnlyRe = new RegExp(sGrade + '(?![a-z])');
    const hasClassLetter = new RegExp(sGrade + '[a-z]').test(e);
    return gradeOnlyRe.test(e) && !hasClassLetter;
}

app.post('/api/siswa/cek-pin', SISWA, wrap(async (req, res) => {
    const pin = String(req.body.pin || '').trim();
    const studentName = req.user.name;
    const kelas = String(req.user.kelas || '').trim();
    const { data, error } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif');
    if (error || !data || data.length === 0) return res.json({ status: 'error', message: 'PIN salah atau ujian sudah ditutup.' });

    const allMapels = [];
    data.forEach(d => { if (d.mapel) d.mapel.split(',').forEach(m => { if (m.trim()) allMapels.push(m.trim()); }); });

    let mapelList = allMapels;
    if (kelas) {
        const cocok = allMapels.filter(m => kelasCocokan(m, kelas));
        if (cocok.length) mapelList = cocok;
        else if (!allMapels.every(m => !/\d/.test(m.replace(/[^a-zA-Z0-9]/g, '')))) {
            return res.json({ status: 'error', message: `Paket soal pada PIN ini tidak tersedia untuk kelas ${kelas}.` });
        }
    }
    const mapel = mapelList.join(', ');

    const { data: actData } = await supabase.from('activity').select('status').eq('student_name', studentName).eq('exam_name', mapel);
    if (actData && actData.length) {
        if (actData.some(a => a.status && a.status.includes('Terkunci'))) return res.json({ status: 'locked', message: 'Akun Anda terkunci karena pelanggaran. Hubungi guru/pengawas untuk membuka akses, lalu masuk kembali.' });
        if (actData.some(a => a.status === 'Selesai')) return res.json({ status: 'finished', message: 'Anda sudah menyelesaikan ujian ini. Hasil telah tersimpan.' });
    }

    const questions = await getQuestions(mapel);
    if (!questions.length) return res.json({ status: 'error', message: 'Paket soal untuk kelas Anda belum tersedia pada PIN ini.' });

    const durasi = data.reduce((s, d) => s + parseInt(d.durasi || 0), 0) || 60;
    const acakSoal = data.some(d => d.acak_soal === true);
    const acakOpsi = data.some(d => d.acak_opsi === true);
    const tanggal = (data[0].tanggal || '').split('|');
    const exam = { mapel, durasi, jumlah_soal: questions.length, acak_soal: acakSoal, acak_opsi: acakOpsi, tanggal: tanggal[0] || '', jam: tanggal[1] || '', resume: !!(actData && actData.length) };
    const ticket = sign({ t: 'exam', u: req.user.username, mapel, durasi, acakSoal, acakOpsi }, (durasi + 24 * 60) * 60);
    res.json({ status: 'success', exam, ticket });
}));

app.post('/api/siswa/get-soal', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error', message: 'Tiket ujian tidak valid. Masukkan PIN kembali.' });
    const questions = await getQuestions(tk.mapel);
    res.json({ status: 'success', questions: questions.map(sanitizeQuestion) });
}));

app.post('/api/siswa/ping', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error' });
    const name = req.user.name;
    const { data: cur } = await supabase.from('activity').select('status').eq('student_name', name).eq('exam_name', tk.mapel).maybeSingle();
    const curStatus = (cur && cur.status) || '';
    if (curStatus.includes('Terkunci') || curStatus === 'Selesai') return res.json({ status: 'protected', state: curStatus });

    const questions = await getQuestions(tk.mapel);
    const r = scoreExam(questions, req.body.answers || {});
    const elapsed = Math.max(0, parseInt(req.body.elapsed || 0));
    const keepWarning = curStatus.includes('Peringatan') || curStatus.includes('Curang');
    const payload = { student_name: name, exam_name: tk.mapel, status: keepWarning ? curStatus : 'Mengerjakan', score: r.nilai, last_seen: `${nowTime()} (${fmtDur(elapsed)} | ${r.terjawab}/${r.total} Soal)` };
    const { error } = await supabase.from('activity').upsert({ ...payload, kelas: req.user.kelas || '-' }, { onConflict: 'student_name,exam_name' });
    if (error) await supabase.from('activity').upsert(payload, { onConflict: 'student_name,exam_name' });
    res.json({ status: 'success', state: payload.status });
}));

app.post('/api/siswa/submit', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error', message: 'Tiket ujian tidak valid.' });
    const name = req.user.name;
    const isCurang = req.body.is_curang === true || req.body.is_curang === 'true';
    const questions = await getQuestions(tk.mapel);
    const r = scoreExam(questions, req.body.answers || {});
    const elapsed = Math.max(0, parseInt(req.body.elapsed || 0));
    const durasiTxt = `${fmtDur(elapsed)} | ${r.terjawab}/${r.total} Soal`;

    const { data: existing } = await supabase.from('results').select('nilai').eq('student_name', name).eq('mapel', tk.mapel).maybeSingle();
    if (isCurang && existing && Number(existing.nilai) >= Number(r.nilai)) return res.json({ status: 'success', skipped: true });
    if (existing) await supabase.from('results').delete().eq('student_name', name).eq('mapel', tk.mapel);

    const row = { student_name: name, mapel: tk.mapel, nilai: r.nilai, benar: r.benar, salah: r.salah, detail_jawaban: JSON.stringify(r.detail), tanggal: nowDate() + '|' + durasiTxt, kelas: req.user.kelas || '-' };
    const { error: insErr } = await withOptionalCols(p => supabase.from('results').insert([p]), row, ['kelas']);
    if (insErr) return res.json({ status: 'error', message: 'Gagal simpan: ' + insErr.message });

    const act = { status: isCurang ? 'Curang (Terkunci)' : 'Selesai', score: r.nilai, last_seen: `${nowTime()} (${durasiTxt})` };
    const { data: hasAct } = await supabase.from('activity').select('id').eq('student_name', name).eq('exam_name', tk.mapel).maybeSingle();
    if (hasAct) await supabase.from('activity').update(act).eq('student_name', name).eq('exam_name', tk.mapel);
    else await withOptionalCols(p => supabase.from('activity').insert([p]), { student_name: name, exam_name: tk.mapel, kelas: req.user.kelas || '-', ...act }, ['kelas']);

    res.json({ status: 'success', show_score: SHOW_SCORE_TO_STUDENT, nilai: SHOW_SCORE_TO_STUDENT ? r.nilai : null, terjawab: r.terjawab, total: r.total });
}));

app.post('/api/siswa/flag-curang', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error' });
    const count = parseInt(req.body.count) || 1;
    const statusText = count >= 4 ? 'Curang (Terkunci)' : `Mengerjakan (Peringatan ${count}x)`;
    const upd = { status: statusText };
    if (req.body.answers) {
        // sertakan progres terakhir agar pengawas melihat kondisi saat pelanggaran
        const r = scoreExam(await getQuestions(tk.mapel), req.body.answers);
        upd.score = r.nilai;
        upd.last_seen = `${nowTime()} (${fmtDur(Math.max(0, parseInt(req.body.elapsed || 0)))} | ${r.terjawab}/${r.total} Soal)`;
    }
    await supabase.from('activity').update(upd).eq('student_name', req.user.name).eq('exam_name', tk.mapel);
    res.json({ status: 'success' });
}));

// ============================================================
// 3. PUBLIK: LIVE SCORE (tanpa data sensitif)
// ============================================================
// PUBLIC_SCORE: 'on' (default) = skor sementara & akhir tampil
//               'final' = skor hanya tampil setelah siswa selesai
//               'off'  = papan skor dimatikan
const PUBLIC_SCORE = ['on', 'final', 'off'].includes(process.env.PUBLIC_SCORE) ? process.env.PUBLIC_SCORE : 'on';
app.get('/api/public/config', (req, res) => res.json({ live_score: PUBLIC_SCORE }));

// ============================================================
// PROFIL SEKOLAH (nama, alamat, kepala sekolah, logo) — untuk
// tampilan aplikasi & kop surat. Disimpan di tabel `config`
// (key = 'sekolah'), logo sebagai data URL yang sudah dikompres.
// ============================================================
const SEKOLAH_DEFAULT = {
    nama_sekolah: 'SMP Negeri 2 Soyo Jaya', singkatan: 'Spenda', npsn: '',
    instansi_1: 'PEMERINTAH KABUPATEN MOROWALI UTARA', instansi_2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
    alamat: '', kecamatan: 'Soyo Jaya', kabupaten: 'Morowali Utara', provinsi: 'Sulawesi Tengah', kode_pos: '',
    telepon: '', email: '', website: '', kepala_sekolah: '', nip_kepala: '', tahun_pelajaran: '', tempat_ttd: '',
    logo_sekolah: '', logo_pemda: '', updated_at: 0,
};
const SEKOLAH_FIELDS = Object.keys(SEKOLAH_DEFAULT).filter(k => !['logo_sekolah', 'logo_pemda', 'updated_at'].includes(k));
let sekolahCache = null;
async function getSekolah() {
    if (sekolahCache && sekolahCache.until > Date.now()) return sekolahCache.data;
    let data = { ...SEKOLAH_DEFAULT };
    try {
        const { data: row } = await supabase.from('config').select('*').eq('key', 'sekolah').maybeSingle();
        if (row && row.value) data = { ...data, ...JSON.parse(row.value) };
    } catch (e) { /* tabel config belum ada → pakai bawaan */ }
    sekolahCache = { data, until: Date.now() + 60 * 1000 };
    return data;
}
const DATA_URL_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;

app.get('/api/public/sekolah', wrap(async (req, res) => {
    const s = await getSekolah();
    const { logo_sekolah, logo_pemda, ...rest } = s;
    res.set('Cache-Control', 'no-cache');
    res.json({ ...rest, has_logo_sekolah: !!logo_sekolah, has_logo_pemda: !!logo_pemda });
}));

// Gambar logo: /api/public/logo (sekolah) atau /api/public/logo?jenis=pemda
app.get('/api/public/logo', wrap(async (req, res) => {
    const s = await getSekolah();
    const src = req.query.jenis === 'pemda' ? s.logo_pemda : s.logo_sekolah;
    const m = String(src || '').match(DATA_URL_RE);
    if (!m) return req.query.jenis === 'pemda' ? res.status(404).end() : res.redirect(302, '/logo-sekolah.png');
    res.set('Content-Type', 'image/' + m[1]);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(Buffer.from(m[2], 'base64'));
}));

app.put('/api/admin/sekolah', ADMIN, wrap(async (req, res) => {
    const cur = await getSekolah();
    const next = { ...cur };
    SEKOLAH_FIELDS.forEach(k => { if (req.body[k] !== undefined) next[k] = String(req.body[k] || '').trim().slice(0, 300); });
    if (!next.nama_sekolah) return res.json({ status: 'error', message: 'Nama sekolah wajib diisi.' });
    for (const k of ['logo_sekolah', 'logo_pemda']) {
        if (req.body[k] === undefined) continue;
        const v = String(req.body[k] || '');
        if (v === '') { next[k] = ''; continue; }
        if (!DATA_URL_RE.test(v)) return res.json({ status: 'error', message: 'Format logo harus PNG, JPG, WEBP, atau SVG.' });
        if (v.length > 700 * 1024) return res.json({ status: 'error', message: 'Ukuran logo terlalu besar (maks ±500 KB).' });
        next[k] = v;
    }
    next.updated_at = Date.now();
    const { error } = await supabase.from('config').upsert({ key: 'sekolah', value: JSON.stringify(next) }, { onConflict: 'key' });
    if (error) {
        const missing = /config/.test(error.message || '') && /(exist|schema cache|relation)/i.test(error.message || '');
        return res.json({ status: 'error', message: missing ? 'Tabel "config" belum ada. Jalankan file supabase-migration.sql di Supabase (SQL Editor) lalu coba lagi.' : error.message });
    }
    sekolahCache = null;
    res.json({ status: 'success', updated_at: next.updated_at });
}));

app.get('/api/public/live-score', wrap(async (req, res) => {
    if (PUBLIC_SCORE === 'off') return res.status(403).json({ status: 'off', message: 'Papan skor dinonaktifkan oleh sekolah.' });
    const { data } = await supabase.from('activity').select('*');
    res.set('Cache-Control', 'no-store');
    res.json((data || []).map(a => {
        const selesai = a.status === 'Selesai';
        const m = String(a.last_seen || '').match(/\|\s*(\d+)\/(\d+)/);
        return {
            student_name: a.student_name, kelas: a.kelas || '-', exam_name: a.exam_name,
            // Status pelanggaran (peringatan/terkunci) tidak ditampilkan ke publik
            status: selesai ? 'Selesai' : 'Mengerjakan',
            score: (PUBLIC_SCORE === 'final' && !selesai) ? null : (a.score === null || a.score === undefined ? null : parseFloat(String(a.score).split('|')[0])),
            done: m ? +m[1] : null, total: m ? +m[2] : null,
        };
    }));
}));

// ============================================================
// 4. DASHBOARD & MONITORING (admin + guru)
// ============================================================
app.get('/api/admin/stats', STAFF, wrap(async (req, res) => {
    const [{ count: cSiswa }, { count: cGuru }, { data: qs }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'siswa'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'guru'),
        supabase.from('questions').select('exam_id'),
    ]);
    res.json({ total_siswa: cSiswa || 0, total_guru: cGuru || 0, total_soal: (qs || []).length, total_paket: new Set((qs || []).map(q => q.exam_id)).size });
}));

app.get('/api/admin/recent-activity', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('activity').select('*').order('last_seen', { ascending: false });
    res.json(data || []);
}));

app.get('/api/admin/results', STAFF, wrap(async (req, res) => {
    const [{ data: results }, { data: activity }, { data: users }] = await Promise.all([
        supabase.from('results').select('*').order('id', { ascending: false }),
        supabase.from('activity').select('student_name, exam_name, kelas'),
        supabase.from('users').select('name, kelas').eq('role', 'siswa'),
    ]);
    const actMap = {}, userMap = {};
    (activity || []).forEach(a => { actMap[`${a.student_name}|${a.exam_name}`] = a.kelas || '-'; });
    (users || []).forEach(u => { if (u.name) userMap[u.name] = u.kelas || '-'; });
    const seen = new Set();
    const merged = (results || []).map(r => {
        let kelas = (r.kelas && r.kelas !== '-') ? r.kelas : (actMap[`${r.student_name}|${r.mapel}`] || '-');
        if (kelas === '-') kelas = userMap[r.student_name] || '-';
        return { ...r, kelas };
    }).filter(r => { const k = `${r.student_name}|${r.mapel}`; if (seen.has(k)) return false; seen.add(k); return true; });
    res.json(merged);
}));

app.get('/api/admin/exam-roster', STAFF, wrap(async (req, res) => {
    const { mapel } = req.query;
    if (!mapel) return res.json([]);
    const [{ data: actData }, { data: resData }, { data: usersData }] = await Promise.all([
        supabase.from('activity').select('student_name, kelas').eq('exam_name', mapel),
        supabase.from('results').select('*').eq('mapel', mapel),
        supabase.from('users').select('name, kelas').eq('role', 'siswa'),
    ]);
    const userMap = {};
    (usersData || []).forEach(u => { if (u.name) userMap[u.name] = u.kelas || '-'; });
    const kelasIkut = new Set();
    [...(actData || []), ...(resData || [])].forEach(a => {
        const k = (a.kelas && a.kelas !== '-') ? a.kelas : (userMap[a.student_name] || null);
        if (k && k !== '-') kelasIkut.add(k);
    });
    if (!kelasIkut.size) return res.json([]);
    const roster = new Map();
    (usersData || []).filter(u => kelasIkut.has(u.kelas)).forEach(u => roster.set(u.name, u.kelas || '-'));
    (actData || []).forEach(a => {
        if (!roster.has(a.student_name)) {
            const k = (a.kelas && a.kelas !== '-') ? a.kelas : (userMap[a.student_name] || '-');
            if (kelasIkut.has(k)) roster.set(a.student_name, k);
        }
    });
    res.json([...roster.entries()].map(([name, kelas]) => ({ name, kelas })));
}));

// Buka akses siswa terkunci (status kembali 'Mengerjakan', jawaban lokal tetap)
app.post('/api/admin/reset-siswa', STAFF, wrap(async (req, res) => {
    await supabase.from('activity').update({ status: 'Mengerjakan' }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);
    res.json({ status: 'success' });
}));

// Izinkan siswa mengulang ujian dari awal (hapus aktivitas + nilai)
app.post('/api/admin/ulang-ujian', ADMIN, wrap(async (req, res) => {
    await supabase.from('activity').delete().eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);
    await supabase.from('results').delete().eq('student_name', req.body.student_name).eq('mapel', req.body.mapel);
    res.json({ status: 'success' });
}));

app.delete('/api/admin/remove-activity/:id', ADMIN, wrap(async (req, res) => { await supabase.from('activity').delete().eq('id', req.params.id); res.json({ status: 'success' }); }));
app.delete('/api/admin/clear-monitoring', ADMIN, wrap(async (req, res) => { await supabase.from('activity').delete().neq('id', 0); res.json({ status: 'success' }); }));
app.delete('/api/admin/clear-results', ADMIN, wrap(async (req, res) => { await supabase.from('results').delete().neq('id', 0); res.json({ status: 'success' }); }));
app.delete('/api/admin/delete-result/:id', ADMIN, wrap(async (req, res) => { await supabase.from('results').delete().eq('id', req.params.id); res.json({ status: 'success' }); }));

// ============================================================
// 5. JADWAL UJIAN
// ============================================================
const genPin = () => String(crypto.randomInt(1000, 10000));

app.get('/api/admin/schedules', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('schedules').select('*').order('id', { ascending: false });
    res.json(data || []);
}));
app.post('/api/admin/add-schedule', ADMIN, wrap(async (req, res) => {
    const row = { mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: parseInt(req.body.durasi) || 60, pin: genPin(), status: 'Aktif', acak_soal: !!req.body.acak_soal, acak_opsi: !!req.body.acak_opsi };
    const { error, droppedCols } = await withOptionalCols(p => supabase.from('schedules').insert([p]), row, ['acak_soal', 'acak_opsi']);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', pin: row.pin, warning: droppedCols && (row.acak_soal || row.acak_opsi) ? 'Fitur acak belum aktif: jalankan file migrasi SQL (supabase-migration.sql) di Supabase.' : null });
}));
app.put('/api/admin/update-schedule', ADMIN, wrap(async (req, res) => {
    const row = { mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: parseInt(req.body.durasi) || 60, status: req.body.status };
    if (req.body.acak_soal !== undefined) row.acak_soal = !!req.body.acak_soal;
    if (req.body.acak_opsi !== undefined) row.acak_opsi = !!req.body.acak_opsi;
    const { error, droppedCols } = await withOptionalCols(p => supabase.from('schedules').update(p).eq('id', req.body.id), row, ['acak_soal', 'acak_opsi']);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', warning: droppedCols && (row.acak_soal || row.acak_opsi) ? 'Fitur acak belum aktif: jalankan supabase-migration.sql.' : null });
}));
app.post('/api/admin/schedule-status', ADMIN, wrap(async (req, res) => {
    await supabase.from('schedules').update({ status: req.body.status === 'Aktif' ? 'Aktif' : 'Ditutup' }).eq('id', req.body.id);
    res.json({ status: 'success' });
}));
app.post('/api/admin/regenerate-pin', ADMIN, wrap(async (req, res) => {
    const pin = genPin();
    await supabase.from('schedules').update({ pin }).eq('id', req.body.id);
    res.json({ status: 'success', pin });
}));
app.delete('/api/admin/delete-schedule/:id', ADMIN, wrap(async (req, res) => { await supabase.from('schedules').delete().eq('id', req.params.id); res.json({ status: 'success' }); }));
app.delete('/api/admin/clear-schedules', ADMIN, wrap(async (req, res) => { await supabase.from('schedules').delete().neq('id', 0); res.json({ status: 'success' }); }));

// ============================================================
// 6. BANK SOAL
// ============================================================
app.get('/api/admin/available-exams', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('questions').select('exam_id');
    const counts = {};
    (data || []).forEach(q => { counts[q.exam_id] = (counts[q.exam_id] || 0) + 1; });
    if (req.query.withCount) return res.json(counts);
    res.json(Object.keys(counts));
}));
app.get('/api/admin/questions', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('questions').select('*').order('id', { ascending: true });
    res.json(data || []);
}));
app.post('/api/admin/add-soal-bulk', STAFF, wrap(async (req, res) => {
    const qs = (req.body.questions || []).filter(q => q && q.exam_id && (q.tanya || q.tipe === 'GFORM'));
    if (!qs.length) return res.json({ status: 'error', message: 'Tidak ada soal valid untuk disimpan.' });
    const { error } = await supabase.from('questions').insert(qs);
    clearQCache();
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', total: qs.length });
}));
app.put('/api/admin/update-soal', STAFF, wrap(async (req, res) => {
    const { id } = req.body;
    const update = {};
    ['kunci', 'tanya', 'opsi_json', 'tipe', 'media_path'].forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (req.body.skor !== undefined) update.skor = parseFloat(req.body.skor) || 1;
    const { error } = await supabase.from('questions').update(update).eq('id', id);
    clearQCache();
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success' });
}));
app.post('/api/admin/rename-exam', ADMIN, wrap(async (req, res) => {
    const from = String(req.body.from || '').trim(), to = String(req.body.to || '').trim();
    if (!from || !to) return res.json({ status: 'error', message: 'Kode lama & baru wajib diisi.' });
    await supabase.from('questions').update({ exam_id: to }).eq('exam_id', from);
    clearQCache();
    res.json({ status: 'success' });
}));
app.delete('/api/admin/delete-question/:id', ADMIN, wrap(async (req, res) => { await supabase.from('questions').delete().eq('id', req.params.id); clearQCache(); res.json({ status: 'success' }); }));
app.delete('/api/admin/delete-exam/:exam_id', ADMIN, wrap(async (req, res) => { await supabase.from('questions').delete().eq('exam_id', req.params.exam_id); clearQCache(); res.json({ status: 'success' }); }));
app.delete('/api/admin/clear-questions', ADMIN, wrap(async (req, res) => { await supabase.from('questions').delete().neq('id', 0); clearQCache(); res.json({ status: 'success' }); }));

app.post('/api/admin/upload-excel', STAFF, upload.single('file'), wrap(async (req, res) => {
    try {
        if (!req.file) return res.json({ status: 'error', message: 'File kosong!' });
        const examId = (req.body.exam_id || '').trim();
        if (!examId) return res.json({ status: 'error', message: 'Kode Ujian wajib diisi!' });
        const wb = XLSX.readFile(req.file.path);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const bsMap = { B: 'A', S: 'B', BENAR: 'A', SALAH: 'B', T: 'A', TS: 'B', SESUAI: 'A', TIDAK: 'B' };
        const questions = rows.map(row => {
            const tipe = String(row.Tipe || row.tipe || 'PG').toUpperCase().trim();
            const tanya = String(row.Pertanyaan || row.pertanyaan || row.tanya || '').trim();
            if (!tanya) return null;
            const opts = ['Opsi_A', 'Opsi_B', 'Opsi_C', 'Opsi_D', 'Opsi_E', 'Opsi_F', 'Opsi_G'].map(c => String(row[c] || '').trim()).filter(o => o);
            const kunciRaw = String(row.Kunci || row.kunci || '').trim();
            let kunci = kunciRaw;
            if (tipe === 'BS' || tipe === 'TS') kunci = kunciRaw.split(',').map(k => bsMap[k.trim().toUpperCase()] || k.trim()).join(',');
            else if (tipe === 'PG') kunci = kunciRaw.toUpperCase().charAt(0);
            else if (tipe === 'PGK' || tipe === 'SIFAT') kunci = kunciRaw.toUpperCase().replace(/\s/g, '');
            return { exam_id: examId, tipe, tanya, opsi_json: opts.join('|||'), kunci, media_path: String(row.Link_Gambar || row.link_gambar || row.media_path || '').trim(), skor: parseFloat(row.Skor || row.skor || 1) || 1, gform_url: '' };
        }).filter(Boolean);
        if (!questions.length) return res.json({ status: 'error', message: 'Tidak ada data soal valid di file.' });
        const { error } = await supabase.from('questions').insert(questions);
        clearQCache();
        if (error) throw error;
        res.json({ status: 'success', message: `${questions.length} soal berhasil diimport dari Excel!`, total: questions.length });
    } finally {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
}));

// Parsing Word di server (opsional; klien juga punya parser sendiri)
app.post('/api/admin/upload-word', STAFF, upload.single('file'), wrap(async (req, res) => {
    try {
        if (!req.file) return res.json({ status: 'error', message: 'File kosong!' });
        const examId = (req.body.exam_id || '').trim();
        const raw = await mammoth.convertToHtml({ path: req.file.path });
        const tableM = raw.value.match(/<table[\s\S]*?>([\s\S]*?)<\/table>/i);
        if (!tableM) {
            const txt = await mammoth.extractRawText({ path: req.file.path });
            return res.json({ status: 'no_table', text_mentah: txt.value });
        }
        const rows = (tableM[1].match(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi) || []).map(tr =>
            (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(tc => tc.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()));
        const headers = (rows[0] || []).map(h => h.toLowerCase().replace(/\s+/g, '_'));
        const col = n => headers.indexOf(n);
        const get = (r, i) => (i >= 0 && r[i]) ? r[i].trim() : '';
        if (col('pertanyaan') < 0) return res.json({ status: 'error', message: "Kolom 'Pertanyaan' tidak ditemukan." });
        const questions = rows.slice(1).map(r => {
            const tanya = get(r, col('pertanyaan')); if (!tanya) return null;
            const tipe = (get(r, col('tipe')) || 'PG').toUpperCase();
            const opsi = ['opsi_a', 'opsi_b', 'opsi_c', 'opsi_d', 'opsi_e'].map(c => get(r, col(c))).filter(Boolean);
            return { exam_id: examId, tipe, tanya, opsi_json: opsi.join('|||'), kunci: get(r, col('kunci')).toUpperCase(), media_path: get(r, col('link_gambar')), skor: parseFloat(get(r, col('skor')).replace(',', '.')) || 1, gform_url: '' };
        }).filter(Boolean);
        res.json({ status: 'success', questions, total: questions.length });
    } finally {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
}));

// ============================================================
// 7. MANAJEMEN PENGGUNA (admin)
// ============================================================
app.get('/api/admin/users', ADMIN, wrap(async (req, res) => {
    const { data } = await supabase.from('users').select('*').order('id', { ascending: false });
    res.json(data || []);
}));
app.post('/api/admin/add-user', ADMIN, wrap(async (req, res) => {
    const u = { name: String(req.body.name || '').trim(), username: String(req.body.username || '').trim(), password: String(req.body.password || '').trim(), role: String(req.body.role || 'siswa').toLowerCase(), kelas: String(req.body.kelas || '').trim(), mapel: String(req.body.mapel || '').trim() };
    if (!u.name || !u.username || !u.password) return res.json({ status: 'error', message: 'Nama, username, dan password wajib diisi.' });
    const { data: ex } = await supabase.from('users').select('id').eq('username', u.username).maybeSingle();
    if (ex) return res.json({ status: 'error', message: `Username "${u.username}" sudah dipakai.` });
    const { error } = await supabase.from('users').insert([u]);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success' });
}));
app.put('/api/admin/update-user', ADMIN, wrap(async (req, res) => {
    const upd = { name: req.body.name, username: req.body.username, password: req.body.password, role: String(req.body.role || 'siswa').toLowerCase(), kelas: req.body.kelas || '', mapel: req.body.mapel || '' };
    const { error } = await supabase.from('users').update(upd).eq('username', req.body.old_username);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success' });
}));
app.delete('/api/admin/delete-user/:username', ADMIN, wrap(async (req, res) => {
    if (req.params.username === req.user.username) return res.json({ status: 'error', message: 'Tidak bisa menghapus akun yang sedang dipakai.' });
    await supabase.from('users').delete().eq('username', req.params.username);
    res.json({ status: 'success' });
}));
app.delete('/api/admin/clear-users', ADMIN, wrap(async (req, res) => {
    await supabase.from('users').delete().neq('role', 'admin');
    res.json({ status: 'success' });
}));

app.post('/api/admin/import-users', ADMIN, wrap(async (req, res) => {
    const { data } = req.body;
    if (!data || !data.length) return res.json({ status: 'error', message: 'Data kosong' });
    const toProcess = data.map(row => ({
        username: String(row.username || '').trim(), name: String(row.nama || row.name || '').trim(),
        password: String(row.password || row.pass || '').trim(), role: String(row.role || 'siswa').toLowerCase().trim(),
        kelas: String(row.kelas || '').trim(), mapel: String(row.mapel || '').trim(),
    })).filter(r => r.username && r.password);
    if (!toProcess.length) return res.json({ status: 'error', message: 'Data tidak valid.' });
    const { data: existing } = await supabase.from('users').select('username');
    const existingSet = new Set((existing || []).map(u => u.username));
    const toInsert = toProcess.filter(u => !existingSet.has(u.username));
    const toUpdate = toProcess.filter(u => existingSet.has(u.username));
    if (toInsert.length) { const { error } = await supabase.from('users').insert(toInsert); if (error) return res.json({ status: 'error', message: error.message }); }
    for (const u of toUpdate) await supabase.from('users').update({ name: u.name, password: u.password, role: u.role, kelas: u.kelas, mapel: u.mapel }).eq('username', u.username);
    res.json({ status: 'success', imported: toProcess.length, inserted: toInsert.length, updated: toUpdate.length });
}));

// Ganti password akun sendiri (admin & guru)
app.post('/api/account/password', auth(), wrap(async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!new_password || String(new_password).length < 4) return res.json({ status: 'error', message: 'Password baru minimal 4 karakter.' });
    const { data } = await supabase.from('users').select('id').eq('username', req.user.username).eq('password', old_password).maybeSingle();
    if (!data) return res.json({ status: 'error', message: 'Password lama salah.' });
    await supabase.from('users').update({ password: new_password }).eq('username', req.user.username);
    res.json({ status: 'success' });
}));

module.exports = app;
