// DIBANGUN OTOMATIS dari src/server.js + src/lib/scoring.js — edit di src/ lalu jalankan: npm run build
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
// ---- Mesin penilaian (digabung dari src/lib/scoring.js) ----

const ABJAD = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MATRIX_TYPES = ['BS', 'TS', 'NK', 'SIFAT'];

const splitOpsi = q => (q.opsi_json ? String(q.opsi_json).split(/\|\|\|/).map(o => o.trim()).filter(o => o) : []);

// Teks bacaan (stimulus) disimpan di awal kolom tanya: [stimulus]…[/stimulus]
const STIM_RE = /^\s*\[stimulus\][\s\S]*?\[\/stimulus\]\s*/i;
const tanpaStimulus = t => String(t || '').replace(STIM_RE, '');

// Jumlah pasangan menjodohkan (dipakai klien tanpa perlu tahu kunci)
function jodohPairCount(q) {
    if (q.kunci && String(q.kunci).trim()) return String(q.kunci).split(',').filter(x => x.trim()).length;
    const premises = tanpaStimulus(q.tanya).split(/\r?\n|<br\s*\/?>/i).filter(l => /^\s*\d+[.)]\s?/.test(l));
    return premises.length || 4;
}

// Apakah sebuah jawaban dianggap "terjawab lengkap"
function isAnswered(q, ans) {
    const a = ans || '';
    if (a === '') return false;
    if (MATRIX_TYPES.includes(q.tipe)) return a.indexOf('-') === -1;
    if (q.tipe === 'JODOH') return a.split(',').filter(x => x).length >= jodohPairCount(q);
    return true;
}

function getFullAnswerText(q, rawAnswer, isKey) {
    if (!rawAnswer || rawAnswer === '-') return '-';
    rawAnswer = String(rawAnswer);
    const opsiArray = splitOpsi(q);
    if (q.tipe === 'PG') { const idx = ABJAD.indexOf(rawAnswer); return idx !== -1 && opsiArray[idx] ? `${rawAnswer}. ${opsiArray[idx]}` : rawAnswer; }
    if (q.tipe === 'PGK') {
        return rawAnswer.split(',').map(a => { const idx = ABJAD.indexOf(a); return idx !== -1 && opsiArray[idx] ? `${a}. ${opsiArray[idx]}` : a; }).join(', ');
    }
    if (q.tipe === 'JODOH') {
        return rawAnswer.split(',').map(a => {
            const num = a.replace(/[a-zA-Z]/g, ''); const letPart = a.replace(/[0-9]/g, '');
            const idx = ABJAD.indexOf(letPart.toUpperCase());
            return idx !== -1 && opsiArray[idx] ? `No.${num} -> ${opsiArray[idx]}` : a;
        }).join(' | ');
    }
    if (MATRIX_TYPES.includes(q.tipe)) {
        let hd = [];
        const hm = (opsiArray[0] || '').match(/^HEADER\[(.+)\]$/i);
        if (q.tipe === 'BS') hd = ['Benar', 'Salah'];
        else if (q.tipe === 'TS') hd = ['Sesuai', 'Tidak Sesuai'];
        else if (q.tipe === 'NK') hd = hm ? hm[1].split(',').map(h => h.trim()).filter(h => h) : ['Numerik', 'Kategorik'];
        else hd = hm ? hm[1].split(',').map(h => h.trim()).filter(h => h) : ['Sifat Komutatif', 'Sifat Asosiatif', 'Sifat Distributif'];
        let parts = rawAnswer.replace(/\s/g, '').toUpperCase().split(',');
        // Kunci BS/TS boleh ditulis notasi B/S (B=Benar, S=Salah) → konversi ke kolom A/B
        if (isKey && (q.tipe === 'BS' || q.tipe === 'TS') && parts.includes('S')) parts = parts.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k));
        return parts.map((a, i) => {
            const idx = ABJAD.indexOf(a);
            return (idx !== -1 && hd[idx]) ? `No.${i + 1}:${hd[idx]}` : `No.${i + 1}:-`;
        }).join(', ');
    }
    return rawAnswer;
}

// Nilai satu butir soal → { status, poin, maks, benar(bool|null) }
function scoreQuestion(q, ans) {
    ans = ans || '';
    const bobot = q.skor ? parseFloat(q.skor) || 1 : 1;
    const kunci = String(q.kunci || '');
    if (kunci.trim() === '' && q.tipe !== 'ISIAN' && q.tipe !== 'ESAI') {
        return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
    }
    if (q.tipe === 'PG') {
        const ok = ans && ans.replace(/\s/g, '').toLowerCase() === kunci.replace(/\s/g, '').toLowerCase();
        return ok ? { status: 'Benar', poin: bobot, maks: bobot, hit: true } : { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'PGK') {
        const kArr = kunci.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        const aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        if (!kArr.length) return { status: 'Salah', poin: 0, maks: 0, hit: false };
        // Aturan: memilih satu saja jawaban yang salah (termasuk memilih lebih banyak dari kunci) → poin 0.
        // Semua pilihan sesuai kunci → poin penuh. Pilihan benar tetapi belum lengkap → poin sebanding.
        let betul = 0, salah = 0; aArr.forEach(a => { if (kArr.includes(a)) betul++; else salah++; });
        if (salah > 0) return { status: `Salah (${salah} pilihan keliru)`, poin: 0, maks: bobot, hit: false };
        if (betul === kArr.length) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (betul > 0) return { status: `Sebagian Benar (${betul}/${kArr.length})`, poin: (betul / kArr.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (MATRIX_TYPES.includes(q.tipe)) {
        let kArr = kunci.replace(/\s/g, '').toUpperCase().split(',').filter(x => x);
        if ((q.tipe === 'BS' || q.tipe === 'TS') && kArr.some(k => k === 'S')) kArr = kArr.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k));
        const aArr = ans.replace(/\s/g, '').toUpperCase().split(',');
        let cor = 0; for (let j = 0; j < kArr.length; j++) if (aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== '') cor++;
        if (cor === kArr.length && kArr.length > 0) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (cor > 0) return { status: `Sebagian Benar (${cor}/${kArr.length})`, poin: (cor / kArr.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'JODOH') {
        const kArr = kunci.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        const aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        let cor = 0; kArr.forEach(k => { if (aArr.includes(k)) cor++; });
        if (cor === kArr.length && kArr.length > 0) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (cor > 0) return { status: `Sebagian Benar (${cor}/${kArr.length})`, poin: (cor / kArr.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') {
        // Penilaian otomatis yang toleran:
        //  • angka dibandingkan nilainya (1/2 = 0,5), kata dicocokkan dengan toleransi salah ketik & imbuhan (menabung ≈ tabungan)
        //  • kata penghubung (yang, dan, untuk, …) diabaikan
        //  • ≥ 80% kata kunci ditemukan → poin penuh; 40–79% → setengah poin; di bawah itu → 0
        //  • kunci boleh berisi beberapa alternatif jawaban dipisah ";" atau "|"
        const alts = String(kunci).split(/\s*[;|\n]\s*/).map(x => x.trim()).filter(Boolean);
        const at = tokIsian(ans); let best = null;
        for (const alt of alts) {
            const kt = tokIsian(alt);
            let kw = kt.words.filter(w => !STOP_ID.has(w)); if (!kw.length) kw = kt.words;
            const total = kt.nums.length + kw.length;
            if (!total) continue;
            const pool = at.nums.slice(), wpool = at.words.slice(); let m = 0;
            kt.nums.forEach(n => { const ix = pool.findIndex(x => Math.abs(x - n) <= 1e-9 * Math.max(1, Math.abs(n), Math.abs(x))); if (ix >= 0) { pool.splice(ix, 1); m++; } });
            kw.forEach(w => { const ix = wpool.findIndex(x => kataMirip(w, x)); if (ix >= 0) { wpool.splice(ix, 1); m++; } });
            let ratio = m / total;
            const na = normIsian(alt), nb = normIsian(ans); // jawaban hampir sama persis dengan kunci (mis. salah ketik 1-2 huruf)
            if (na && nb && na.length <= 300 && nb.length <= 300 && 1 - lev(na, nb) / Math.max(na.length, nb.length) >= 0.88) ratio = 1;
            if (!best || ratio > best.ratio) best = { ratio, m, total };
        }
        if (!best) return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
        if (best.ratio >= 0.8) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (best.ratio >= 0.4) return { status: `Sebagian Benar (${best.m}/${best.total})`, poin: bobot / 2, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
}

// ---- Bantuan penilaian isian/esai: kata penghubung, jarak edit, kemiripan kata ----
const STOP_ID = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'adalah', 'ialah', 'itu', 'ini', 'atau', 'dalam', 'sebagai', 'karena', 'agar', 'supaya', 'oleh', 'akan', 'juga', 'para', 'sebuah', 'suatu', 'dapat', 'bisa', 'telah', 'sudah', 'saya', 'kita', 'kami', 'nya', 'si', 'sang', 'tersebut', 'bahwa', 'serta', 'maka', 'jadi', 'lebih', 'sangat']);
function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
}
function stemId(w) {
    if (w.length < 6) return w;
    let r = w.replace(/(nya|kan|lah|kah|an|i)$/, ''); if (r.length < 4) r = w;
    const p = r.replace(/^(meng|meny|mem|men|me|peng|peny|pem|pen|pe|ber|ter|per|di|ke|se)/, ''); return p.length >= 4 ? p : r;
}
function kataMirip(k, a) {
    if (k === a) return true;
    const sk = stemId(k), sa = stemId(a); if (sk === sa) return true;
    const L = Math.min(sk.length, sa.length); if (L < 5) return false; // kata pendek harus persis
    return lev(sk, sa) <= (L >= 7 ? 2 : 1);
}
const normIsian = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s/,.-]/g, ' ').replace(/\s+/g, ' ').trim();

// Memecah jawaban isian menjadi angka (pecahan, desimal, campuran, ½, \frac{a}{b}) dan kata
const UF_PECAHAN = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
function tokIsian(str) {
    let s = String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[−–—]/g, '-').replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2').replace(/\\dfrac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2')
        .replace(/[½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, m => ' ' + UF_PECAHAN[m] + ' ').replace(/÷/g, '/');
    const nums = [];
    s = s.replace(/(?<![\w.,/])(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)(?![\d/])/g, (m, sg, a, b, c) => { if (+c) { nums.push((sg ? -1 : 1) * (+a + +b / +c)); return ' '; } return m; }); // pecahan campuran "1 1/2"
    s = s.replace(/(?<![\w.,])-?\d+(?:\.\d{3})+(?![\d.,])|(?<![\w.,])-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?(?![\d])/g, m => {
        const t = m.replace(/\s+/g, '');
        const num = x => /^-?\d+(?:\.\d{3})+$/.test(x) ? parseFloat(x.replace(/\./g, '')) : parseFloat(x.replace(',', '.'));
        if (t.includes('/')) { const [p, q] = t.split('/'); const d = num(q); if (d) nums.push(num(p) / d); }
        else nums.push(num(t));
        return ' ';
    });
    return { nums: nums.filter(Number.isFinite), words: [...new Set(s.match(/[a-z]+/g) || [])] };
}

// answers: { [question_id]: "jawaban" }
function scoreExam(questions, answers) {
    answers = answers || {};
    if (questions.length > 0 && questions[0].tipe === 'GFORM') {
        return { nilai: 'Cek G-Form', benar: 0, salah: 0, detail: [], terjawab: questions.length, total: questions.length };
    }
    let benar = 0, salah = 0, maks = 0, dapat = 0, terjawab = 0;
    const detail = questions.map((q, i) => {
        const ans = answers[q.id] || '';
        if (isAnswered(q, ans)) terjawab++;
        const r = scoreQuestion(q, ans);
        maks += r.maks; dapat += r.poin;
        if (r.hit === true) benar++; else if (r.hit === false) salah++;
        return {
            no: i + 1, qid: q.id, tipe: q.tipe, tanya: tanpaStimulus(q.tanya),
            jawab: getFullAnswerText(q, ans), kunci: getFullAnswerText(q, q.kunci, true),
            status: r.status, poin: Math.round(r.poin * 100) / 100,
        };
    });
    const nilai = maks > 0 ? Math.round((dapat / maks) * 100) : 0;
    return { nilai, benar, salah, detail, terjawab, total: questions.length };
}

// Versi soal yang aman dikirim ke siswa (tanpa kunci)
function sanitizeQuestion(q) {
    const out = { id: q.id, exam_id: q.exam_id, tipe: q.tipe, tanya: q.tanya, opsi_json: q.opsi_json, media_path: q.media_path, gform_url: q.gform_url, skor: q.skor };
    if (q.tipe === 'JODOH') out.pair_count = jodohPairCount(q);
    return out;
}



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

// ------------------------------------------------------------
// AKSES GURU MAPEL — guru hanya melihat/mengelola paket & kelas yang diampu
// Isi kolom Mapel guru: "PAI" | "MTK-7" (semua kelas 7) | "MTK-7A,IPA-8B" | kosong/"Semua" = semua mapel
// Pemantauan (aktivitas, jadwal/PIN, token) tetap terbuka untuk semua guru.
// ------------------------------------------------------------
const alnumLow = v => String(v || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
function normKelas(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(viii|vii|ix)/, r => ({ viii: '8', vii: '7', ix: '9' })[r]); }
function parseAksesGuru(mapelStr) {
    const raw = String(mapelStr || '').trim();
    if (!raw || /^semua/i.test(raw)) return null;
    return raw.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).map(x => {
        const t = alnumLow(x), m = t.match(/^([a-z]*?)(\d+)([a-z]?)$/);
        return { t, subject: m ? m[1] : t, grade: m ? m[2] : '', letter: m ? m[3] : '' };
    });
}
function tokenCocokExam(tk, examId) {
    const e = alnumLow(examId);
    if (!e || !tk.t) return false;
    if (e.includes(tk.t)) return true;
    if (tk.letter && tk.subject && e.includes(tk.subject)) return String(examId).split(/[^a-zA-Z0-9]+/).some(sg => sg === tk.grade);
    return false;
}
function tokenCocokKelas(tk, kelas) {
    const k = normKelas(kelas);
    if (!k || k === '-') return true;
    if (tk.grade && tk.letter) return k === tk.grade + tk.letter;
    if (tk.grade) return k.startsWith(tk.grade);
    return true;
}
const aksesGuru = req => (req.user && req.user.role === 'guru') ? parseAksesGuru(req.user.mapel) : null; // null = tanpa batasan
const guruBolehExam = (ak, examId) => ak === null || ak.some(tk => tokenCocokExam(tk, examId));
const guruBolehRow = (ak, examId, kelas) => ak === null || ak.some(tk => tokenCocokExam(tk, examId) && tokenCocokKelas(tk, kelas));
const tolakMapel = res => res.status(403).json({ status: 'error', message: 'Bukan mapel yang Anda ampu.' });

// Jadwal baru dibuka setelah tanggal & jam mulai (WITA, UTC+8). Format tanggal jadwal: "YYYY-MM-DD|HH:MM"
function jadwalSudahMulai(j) {
    const [tgl, jam] = String(j.tanggal || '').split('|');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl || '')) return true;
    const hm = /^\d{1,2}:\d{2}$/.test(jam || '') ? jam.padStart(5, '0') : '00:00';
    const t = new Date(`${tgl}T${hm}:00+08:00`);
    return isNaN(t.getTime()) || Date.now() >= t.getTime();
}
const infoMulai = j => { const [tgl, jam] = String(j.tanggal || '').split('|'); return `${tgl}${jam ? ' pukul ' + jam : ''} WITA`; };

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
// Soal khusus: siswa tertentu mengerjakan paket lain (satu paket khusus per mapel, dipakai bersama). Nilai tetap tersimpan di paket biasa.
const khususCache = { until: 0, data: { siswa: [], map: {} } };
async function getKhusus() {
    if (khususCache.until > Date.now()) return khususCache.data;
    let d = { siswa: [], map: {} };
    try { const { data: row } = await supabase.from('config').select('*').eq('key', 'soal_khusus').maybeSingle(); if (row && row.value) { const v = JSON.parse(row.value); d = { siswa: Array.isArray(v.siswa) ? v.siswa : [], map: v.map && typeof v.map === 'object' ? v.map : {} }; } } catch (e) { /* belum ada */ }
    khususCache.data = d; khususCache.until = Date.now() + 20 * 1000;
    return d;
}
async function getQuestionsSiswa(username, mapelStr) {
    const k = await getKhusus();
    if (!k.siswa.includes(username) || !Object.keys(k.map).length) return getQuestions(mapelStr);
    const out = [];
    for (const id of mapelStr.split(',').map(m => m.trim()).filter(Boolean)) {
        let qs = k.map[id] ? await getQuestions(k.map[id]) : [];
        if (!qs.length) qs = await getQuestions(id); // paket khusus kosong → pakai paket biasa
        out.push(...qs);
    }
    return out;
}

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
// ============================================================
// ANTI JOKI: kunci perangkat, token pengawas, lokasi
// ============================================================
const clientIp = req => String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();

// Token pengawas: 6 karakter, berganti tiap TOKEN_MENIT menit, dihitung dari
// rahasia server + PIN (tidak perlu disimpan di database).
const TOKEN_MENIT = Math.max(2, parseInt(process.env.TOKEN_MENIT || '15'));
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tokenWindow = () => Math.floor(Date.now() / (TOKEN_MENIT * 60000));
function tokenFor(sch, w) {
    const h = crypto.createHmac('sha256', APP_SECRET).update(`tok|${sch.id}|${sch.pin}|${w}`).digest();
    let t = ''; for (let i = 0; i < 6; i++) t += TOKEN_CHARS[h[i] % TOKEN_CHARS.length];
    return t;
}
function cekToken(schs, input) {
    const v = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const w = tokenWindow();
    return schs.some(s => tokenFor(s, w) === v || tokenFor(s, w - 1) === v); // token sebelumnya masih diterima (toleransi pergantian)
}
function jarakMeter(lat1, lng1, lat2, lng2) {
    const R = 6371000, r = d => d * Math.PI / 180;
    const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
// Sesi perangkat per siswa per paket (tabel exam_sessions, lihat supabase-migration.sql)
let SESI_AKTIF = true;
async function getSesi(studentName, mapel) {
    if (!SESI_AKTIF) return null;
    const { data, error } = await supabase.from('exam_sessions').select('*').eq('student_name', studentName).eq('mapel', mapel).maybeSingle();
    if (error) { if (/exam_sessions/.test(error.message || '')) SESI_AKTIF = false; return null; }
    return data;
}
async function cekPerangkat(req, mapel) {
    // null = boleh; objek = ditolak
    const sesi = await getSesi(req.user.name, mapel);
    const dev = String(req.body.device_id || '');
    if (!sesi || !dev || sesi.device_id === dev) return { ok: true, sesi };
    return { ok: false, sesi };
}

async function catatPercobaan(req, mapel, ket) {
    if (!SESI_AKTIF) return;
    const sesi = await getSesi(req.user.name, mapel);
    if (!sesi) return;
    const log = `${nowTime()} — ${ket}`;
    await supabase.from('exam_sessions').update({ percobaan: (sesi.percobaan || 0) + 1, percobaan_info: log }).eq('id', sesi.id);
}

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
    let { data, error } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif');
    if (error || !data || data.length === 0) return res.json({ status: 'error', message: 'PIN salah atau ujian sudah ditutup.' });
    const sudahMulai = data.filter(jadwalSudahMulai);
    if (!sudahMulai.length) return res.json({ status: 'error', message: `Ujian belum dimulai. Jadwal mulai: ${infoMulai(data[0])}.` });
    data = sudahMulai;

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

    const questions = await getQuestionsSiswa(req.user.username, mapel);
    if (!questions.length) return res.json({ status: 'error', message: 'Paket soal untuk kelas Anda belum tersedia pada PIN ini.' });

    const durasi = data.reduce((s, d) => s + parseInt(d.durasi || 0), 0) || 60;
    const acakSoal = data.some(d => d.acak_soal === true);
    const acakOpsi = data.some(d => d.acak_opsi === true);
    const tanggal = (data[0].tanggal || '').split('|');
    const wajibToken = data.some(d => d.wajib_token === true);
    const wajibLokasi = data.some(d => d.wajib_lokasi === true);
    const exam = { mapel, durasi, jumlah_soal: questions.length, acak_soal: acakSoal, acak_opsi: acakOpsi, wajib_token: wajibToken, wajib_lokasi: wajibLokasi, tanggal: tanggal[0] || '', jam: tanggal[1] || '', resume: !!(actData && actData.length) };
    const ticket = sign({ t: 'exam', u: req.user.username, mapel, durasi, acakSoal, acakOpsi, sids: data.map(d => d.id) }, (durasi + 24 * 60) * 60);
    res.json({ status: 'success', exam, ticket });
}));

app.post('/api/siswa/get-soal', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error', message: 'Tiket ujian tidak valid. Masukkan PIN kembali.' });
    // Tiket lama (sebelum pembaruan) tidak membawa id jadwal → lewati pemeriksaan token/lokasi
    const { data: schs } = tk.sids ? await supabase.from('schedules').select('*').in('id', tk.sids) : { data: null };
    const aktifSemua = (schs || []).filter(s => s.status === 'Aktif');
    const aktif = aktifSemua.filter(jadwalSudahMulai);
    if (tk.sids && aktifSemua.length && !aktif.length) return res.json({ status: 'error', code: 'notstarted', message: `Ujian belum dimulai. Jadwal mulai: ${infoMulai(aktifSemua[0])}.` });
    if (tk.sids && !aktif.length) return res.json({ status: 'error', code: 'closed', message: 'Ujian sudah ditutup oleh pengawas.' });

    // 1) Token pengawas
    if (aktif.some(s => s.wajib_token === true) && !cekToken(aktif.filter(s => s.wajib_token === true), req.body.token)) {
        return res.json({ status: 'error', code: 'token', message: 'Token salah atau sudah kedaluwarsa. Lihat token terbaru di layar pengawas.' });
    }

    // 2) Lokasi (jika diwajibkan dan koordinat sekolah sudah diisi)
    let lokasi = null;
    if (aktif.some(s => s.wajib_lokasi === true)) {
        const sk = await getSekolah();
        const L = req.body.lokasi || {};
        if (!isFinite(L.lat) || !isFinite(L.lng)) return res.json({ status: 'error', code: 'lokasi', message: 'Ujian ini hanya bisa dikerjakan di sekolah. Izinkan akses lokasi (GPS) lalu coba lagi.' });
        const sLat = parseFloat(sk.lat), sLng = parseFloat(sk.lng), radius = parseFloat(sk.radius_m) || 300;
        const akurasi = Math.round(Math.max(0, parseFloat(L.acc) || 0));
        if (isFinite(sLat) && isFinite(sLng)) {
            const jarak = jarakMeter(sLat, sLng, +L.lat, +L.lng);
            lokasi = { lat: +L.lat, lng: +L.lng, jarak, akurasi };
            // Ditolak hanya bila yakin berada di luar radius (jarak dikurangi ketidakpastian GPS)
            if (jarak - akurasi > radius) {
                const km = jarak >= 1000 ? (jarak / 1000).toFixed(1).replace('.', ',') + ' km' : jarak + ' m';
                await catatPercobaan(req, tk.mapel, `Lokasi di luar sekolah (${km})`);
                return res.json({ status: 'error', code: 'lokasi', message: `Kamu terdeteksi berada ${km} dari sekolah. Ujian ini hanya bisa dikerjakan di sekolah.` });
            }
        } else lokasi = { lat: +L.lat, lng: +L.lng, jarak: null, akurasi };
    }

    // 3) Satu akun satu perangkat
    const dev = String(req.body.device_id || '').slice(0, 64);
    const cek = await cekPerangkat(req, tk.mapel);
    if (!cek.ok) {
        await catatPercobaan(req, tk.mapel, `Perangkat lain (${String(req.body.device_info || '?').slice(0, 60)}, IP ${clientIp(req)})`);
        return res.json({ status: 'error', code: 'device', message: 'Akun ini sedang dipakai di perangkat lain untuk ujian ini. Jika perangkatmu rusak/berganti, minta pengawas menekan "Reset perangkat".' });
    }
    if (SESI_AKTIF && dev) {
        const row = { student_name: req.user.name, username: req.user.username, kelas: req.user.kelas || '-', mapel: tk.mapel, device_id: dev, device_info: String(req.body.device_info || '').slice(0, 120), ip: clientIp(req), lokasi: lokasi ? JSON.stringify(lokasi) : null, updated_at: new Date().toISOString() };
        if (cek.sesi) await supabase.from('exam_sessions').update(row).eq('id', cek.sesi.id);
        else { const { error } = await supabase.from('exam_sessions').insert([row]); if (error && /exam_sessions/.test(error.message || '')) SESI_AKTIF = false; }
    }
    const questions = await getQuestionsSiswa(req.user.username, tk.mapel);
    res.json({ status: 'success', questions: questions.map(sanitizeQuestion) });
}));

app.post('/api/siswa/ping', SISWA, wrap(async (req, res) => {
    const tk = readTicket(req);
    if (!tk) return res.status(403).json({ status: 'error' });
    if (!(await cekPerangkat(req, tk.mapel)).ok) return res.json({ status: 'device_locked' });
    const name = req.user.name;
    const { data: cur } = await supabase.from('activity').select('status').eq('student_name', name).eq('exam_name', tk.mapel).maybeSingle();
    const curStatus = (cur && cur.status) || '';
    if (curStatus.includes('Terkunci') || curStatus === 'Selesai') return res.json({ status: 'protected', state: curStatus });

    const questions = await getQuestionsSiswa(req.user.username, tk.mapel);
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
    if (!(await cekPerangkat(req, tk.mapel)).ok) {
        await catatPercobaan(req, tk.mapel, `Perangkat lain mencoba mengumpulkan (IP ${clientIp(req)})`);
        return res.json({ status: 'error', code: 'device', message: 'Jawaban ditolak: akun ini terdaftar di perangkat lain untuk ujian ini. Hubungi pengawas.' });
    }
    const name = req.user.name;
    const isCurang = req.body.is_curang === true || req.body.is_curang === 'true';
    const questions = await getQuestionsSiswa(req.user.username, tk.mapel);
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
        const r = scoreExam(await getQuestionsSiswa(req.user.username, tk.mapel), req.body.answers);
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
    telepon: '', email: '', website: '', kepala_sekolah: '', nip_kepala: '', tahun_pelajaran: '', tempat_ttd: '', lat: '', lng: '', radius_m: '300',
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
    const { logo_sekolah, logo_pemda, logo_app, logo_app_192, ...rest } = s;
    res.set('Cache-Control', 'no-cache');
    res.json({ ...rest, has_logo_sekolah: !!logo_sekolah, has_logo_pemda: !!logo_pemda, has_logo_app: !!logo_app });
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

// Ikon aplikasi (tab browser, layar HP): memakai gambar yang diunggah admin di Profil sekolah.
// Jika belum diunggah, dipakai file bawaan /icon-192.png dan /icon-512.png.
app.get('/api/public/icon', wrap(async (req, res) => {
    const size = req.query.size === '512' ? 512 : 192;
    const s = await getSekolah();
    const src = size === 512 ? s.logo_app : (s.logo_app_192 || s.logo_app);
    const m = String(src || '').match(DATA_URL_RE);
    if (!m) { res.set('Cache-Control', 'no-cache'); return res.redirect(302, `/icon-${size}.png`); }
    res.set('Content-Type', 'image/' + m[1]);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(Buffer.from(m[2], 'base64'));
}));
app.get('/api/public/manifest', wrap(async (req, res) => {
    const s = await getSekolah();
    const v = s.updated_at || 0, custom = !!s.logo_app;
    const src = sz => custom ? `/api/public/icon?size=${sz}&v=${v}` : `/icon-${sz}.png`;
    res.set('Content-Type', 'application/manifest+json');
    res.set('Cache-Control', 'no-cache');
    res.json({
        name: 'CBT SMP Negeri 2 Soyo Jaya', short_name: 'CBT Spenda',
        description: 'Ujian berbasis komputer & smartphone SMP Negeri 2 Soyo Jaya',
        start_url: '/', display: 'standalone', background_color: '#F3F5F9', theme_color: '#14306B',
        icons: [{ src: src(192), sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: src(512), sizes: '512x512', type: 'image/png', purpose: 'any' }],
    });
}));

// ============================================================
// CADANGAN & PEMULIHAN DATA (pindah akun/proyek Supabase)
// Diambil per tabel per halaman agar tidak melewati batas ukuran
// permintaan Vercel (±4,5 MB). Gambar soal diambil sedikit-sedikit.
// ============================================================
const TABEL_CADANGAN = { users: 'id', schedules: 'id', questions: 'id', media: 'id', results: 'id', activity: 'id', exam_sessions: 'id', config: 'key' };
const tabelTidakAda = e => e && /(does not exist|schema cache|relation)/i.test(e.message || '') && !/column/i.test(e.message || '');
app.get('/api/admin/cadangan/:tabel', ADMIN, wrap(async (req, res) => {
    const t = req.params.tabel, key = TABEL_CADANGAN[t];
    if (!key) return res.status(400).json({ status: 'error', message: 'Tabel tidak dikenal' });
    const from = Math.max(0, parseInt(req.query.from) || 0), n = Math.min(1000, Math.max(1, parseInt(req.query.n) || 500));
    const { data, error } = await supabase.from(t).select('*').order(key, { ascending: true }).range(from, from + n - 1);
    if (error) return tabelTidakAda(error) ? res.json({ status: 'success', rows: [], selesai: true, catatan: 'tabel belum ada' }) : res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', rows: data || [], selesai: (data || []).length < n });
}));
app.post('/api/admin/pulihkan/:tabel', ADMIN, wrap(async (req, res) => {
    const t = req.params.tabel, key = TABEL_CADANGAN[t];
    if (!key) return res.status(400).json({ status: 'error', message: 'Tabel tidak dikenal' });
    let rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (req.body.kosongkan) {
        const { error } = await supabase.from(t).delete().neq(key, key === 'id' && t !== 'media' ? -1 : '___');
        if (error) return res.json({ status: 'error', message: `Gagal mengosongkan ${t}: ${error.message}` });
    }
    // Kolom lama yang tidak ada di tabel baru dibuang otomatis
    const dibuang = [];
    for (let i = 0; rows.length && i < 15; i++) {
        const { error } = await supabase.from(t).upsert(rows, { onConflict: key });
        if (!error) break;
        const m = (error.message || '').match(/Could not find the '([^']+)' column/i) || (error.message || '').match(/column "([^"]+)" of relation/i);
        if (!m) return res.json({ status: 'error', message: `${t}: ${error.message}` });
        dibuang.push(m[1]); rows = rows.map(r => { const c = { ...r }; delete c[m[1]]; return c; });
    }
    res.json({ status: 'success', n: rows.length, dibuang });
}));
app.post('/api/admin/pulihkan-selesai', ADMIN, wrap(async (req, res) => {
    // Nomor id berikutnya dilanjutkan dari data yang dipulihkan
    const { error } = await supabase.rpc('cbt_reset_sequences');
    clearQCache(); mediaCache.clear();
    res.json({ status: 'success', peringatan: error ? 'Fungsi cbt_reset_sequences belum ada — jalankan supabase-schema-lengkap.sql. (' + error.message + ')' : '' });
}));

// ============================================================
// KEEP-ALIVE: dipanggil Vercel Cron setiap hari agar proyek
// Supabase gratis tidak dijeda saat lama tidak ada ujian.
// Buka /api/keep-alive di browser untuk cek koneksi database.
// ============================================================
function jenisKunci(k) {
    if (/^sb_secret_/.test(k)) return 'secret';
    if (/^sb_publishable_/.test(k)) return 'publishable';
    try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString()).role || 'tidak dikenal'; } catch (e) { return 'tidak dikenal'; }
}
app.get('/api/keep-alive', wrap(async (req, res) => {
    const t0 = Date.now();
    const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
    const kunci = jenisKunci(SUPABASE_KEY);
    res.set('Cache-Control', 'no-store');
    res.json({
        status: error ? 'error' : 'ok',
        database: error ? 'GAGAL: ' + error.message : 'terhubung',
        proyek: (SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1] || SUPABASE_URL,
        jumlah_pengguna: error ? null : count,
        jenis_kunci: kunci,
        peringatan: ['secret', 'service_role'].includes(kunci) ? '' : 'SUPABASE_KEY sebaiknya memakai Secret key (bukan publishable/anon). Dengan tabel ber-RLS, kunci publishable tidak bisa membaca data.',
        waktu_ms: Date.now() - t0,
    });
}));

// ============================================================
// GAMBAR SOAL (tanpa Google Drive) — disimpan di tabel `media`
// Gambar sudah dikompres di browser (maks ±1280 px) sebelum dikirim.
// URL: /api/media/<id acak>  — di-cache browser & CDN Vercel.
// ============================================================
const MEDIA_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const mediaCache = new Map();
app.post('/api/admin/media', STAFF, wrap(async (req, res) => {
    const m = String(req.body.data || '').match(MEDIA_RE);
    if (!m) return res.json({ status: 'error', message: 'Format gambar harus PNG, JPG, WEBP, atau GIF.' });
    if (m[2].length > 2.5 * 1024 * 1024) return res.json({ status: 'error', message: 'Gambar terlalu besar (maks ±1,8 MB setelah dikompres).' });
    const id = crypto.randomUUID().replace(/-/g, '');
    const { error } = await supabase.from('media').insert([{ id, mime: m[1], data: m[2], size: Math.round(m[2].length * 0.75), uploader: req.user.username }]);
    if (error) {
        const missing = /media/.test(error.message || '') && /(exist|schema cache|relation)/i.test(error.message || '');
        return res.json({ status: 'error', message: missing ? 'Tabel "media" belum ada. Jalankan file supabase-migration.sql di Supabase lalu coba lagi.' : error.message });
    }
    res.json({ status: 'success', url: '/api/media/' + id });
}));
app.get('/api/media/:id', wrap(async (req, res) => {
    const id = String(req.params.id || '').replace(/[^a-f0-9]/g, '').slice(0, 40);
    let row = mediaCache.get(id);
    if (!row) {
        const { data } = await supabase.from('media').select('mime,data').eq('id', id).maybeSingle();
        if (!data) return res.status(404).end();
        row = { mime: data.mime, buf: Buffer.from(data.data, 'base64') };
        if (mediaCache.size > 200) mediaCache.delete(mediaCache.keys().next().value);
        mediaCache.set(id, row);
    }
    res.set('Content-Type', row.mime);
    res.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.send(row.buf);
}));

app.put('/api/admin/sekolah', ADMIN, wrap(async (req, res) => {
    const cur = await getSekolah();
    const next = { ...cur };
    SEKOLAH_FIELDS.forEach(k => { if (req.body[k] !== undefined) next[k] = String(req.body[k] || '').trim().slice(0, 300); });
    if (!next.nama_sekolah) return res.json({ status: 'error', message: 'Nama sekolah wajib diisi.' });
    for (const k of ['logo_sekolah', 'logo_pemda', 'logo_app', 'logo_app_192']) {
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
    let sesiMap = {};
    if (SESI_AKTIF) {
        const { data: ss, error } = await supabase.from('exam_sessions').select('*');
        if (error && /exam_sessions/.test(error.message || '')) SESI_AKTIF = false;
        (ss || []).forEach(x => { sesiMap[x.student_name + '|' + x.mapel] = { device_info: x.device_info, ip: x.ip, lokasi: x.lokasi ? JSON.parse(x.lokasi) : null, percobaan: x.percobaan || 0, percobaan_info: x.percobaan_info || '' }; });
    }
    if (req.query.v === '2') return res.json({ sesi_aktif: SESI_AKTIF, rows: (data || []).map(a => ({ ...a, sesi: sesiMap[a.student_name + '|' + a.exam_name] || null })) });
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
    const akG = aksesGuru(req);
    res.json(akG === null ? merged : merged.filter(r => guruBolehRow(akG, r.mapel, r.kelas)));
}));

app.get('/api/admin/exam-roster', STAFF, wrap(async (req, res) => {
    const { mapel } = req.query;
    if (!mapel) return res.json([]);
    const akG = aksesGuru(req);
    if (!guruBolehExam(akG, mapel)) return res.json([]);
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
    res.json([...roster.entries()].map(([name, kelas]) => ({ name, kelas })).filter(r => guruBolehRow(akG, mapel, r.kelas)));
}));

// Buka akses siswa terkunci (status kembali 'Mengerjakan', jawaban lokal tetap)
app.post('/api/admin/reset-siswa', STAFF, wrap(async (req, res) => {
    if (!guruBolehExam(aksesGuru(req), req.body.mapel)) return tolakMapel(res);
    await supabase.from('activity').update({ status: 'Mengerjakan' }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);
    res.json({ status: 'success' });
}));

// Izinkan siswa masuk dari perangkat baru (HP rusak/berganti)
app.post('/api/admin/reset-perangkat', STAFF, wrap(async (req, res) => {
    if (!guruBolehExam(aksesGuru(req), req.body.mapel)) return tolakMapel(res);
    if (SESI_AKTIF) await supabase.from('exam_sessions').delete().eq('student_name', req.body.student_name).eq('mapel', req.body.mapel);
    res.json({ status: 'success' });
}));

// Token pengawas untuk jadwal aktif
app.get('/api/admin/tokens', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('schedules').select('*').eq('status', 'Aktif');
    const w = tokenWindow(), berakhir = (w + 1) * TOKEN_MENIT * 60000;
    res.json({ menit: TOKEN_MENIT, berakhir, server_now: Date.now(), tokens: (data || []).filter(s => s.wajib_token === true).map(s => ({ id: s.id, mapel: s.mapel, pin: s.pin, token: tokenFor(s, w) })) });
}));

// Izinkan siswa mengulang ujian dari awal (hapus aktivitas + nilai)
app.post('/api/admin/ulang-ujian', ADMIN, wrap(async (req, res) => {
    await supabase.from('activity').delete().eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);
    await supabase.from('results').delete().eq('student_name', req.body.student_name).eq('mapel', req.body.mapel);
    if (SESI_AKTIF) await supabase.from('exam_sessions').delete().eq('student_name', req.body.student_name).eq('mapel', req.body.mapel);
    res.json({ status: 'success' });
}));

app.delete('/api/admin/remove-activity/:id', ADMIN, wrap(async (req, res) => { await supabase.from('activity').delete().eq('id', req.params.id); res.json({ status: 'success' }); }));
app.delete('/api/admin/clear-monitoring', ADMIN, wrap(async (req, res) => {
    await supabase.from('activity').delete().neq('id', 0);
    if (SESI_AKTIF) await supabase.from('exam_sessions').delete().neq('id', 0);
    res.json({ status: 'success' });
}));
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
    const row = { mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: parseInt(req.body.durasi) || 60, pin: genPin(), status: 'Aktif', acak_soal: !!req.body.acak_soal, acak_opsi: !!req.body.acak_opsi, wajib_token: !!req.body.wajib_token, wajib_lokasi: !!req.body.wajib_lokasi };
    const { error, droppedCols } = await withOptionalCols(p => supabase.from('schedules').insert([p]), row, ['acak_soal', 'acak_opsi', 'wajib_token', 'wajib_lokasi']);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', pin: row.pin, warning: droppedCols ? 'Acak soal, token pengawas & wajib lokasi belum aktif: jalankan file supabase-migration.sql di Supabase.' : null });
}));
app.put('/api/admin/update-schedule', ADMIN, wrap(async (req, res) => {
    const row = { mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: parseInt(req.body.durasi) || 60, status: req.body.status };
    if (req.body.acak_soal !== undefined) row.acak_soal = !!req.body.acak_soal;
    if (req.body.acak_opsi !== undefined) row.acak_opsi = !!req.body.acak_opsi;
    if (req.body.wajib_token !== undefined) row.wajib_token = !!req.body.wajib_token;
    if (req.body.wajib_lokasi !== undefined) row.wajib_lokasi = !!req.body.wajib_lokasi;
    const { error, droppedCols } = await withOptionalCols(p => supabase.from('schedules').update(p).eq('id', req.body.id), row, ['acak_soal', 'acak_opsi', 'wajib_token', 'wajib_lokasi']);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', warning: droppedCols ? 'Acak soal, token & lokasi belum aktif: jalankan supabase-migration.sql.' : null });
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
    const akG = aksesGuru(req);
    Object.keys(counts).forEach(k => { if (!guruBolehExam(akG, k)) delete counts[k]; });
    if (req.query.withCount) return res.json(counts);
    res.json(Object.keys(counts));
}));
app.get('/api/admin/questions', STAFF, wrap(async (req, res) => {
    const { data } = await supabase.from('questions').select('*').order('id', { ascending: true });
    const akG = aksesGuru(req);
    res.json((data || []).filter(q => guruBolehExam(akG, q.exam_id)));
}));
app.post('/api/admin/add-soal-bulk', STAFF, wrap(async (req, res) => {
    const akG = aksesGuru(req);
    const qs = (req.body.questions || []).filter(q => q && q.exam_id && guruBolehExam(akG, q.exam_id) && (q.tanya || q.media_path || q.tipe === 'GFORM'));
    if (!qs.length) return res.json({ status: 'error', message: 'Tidak ada soal valid untuk disimpan.' });
    const { error } = await supabase.from('questions').insert(qs);
    clearQCache();
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', total: qs.length });
}));
app.put('/api/admin/update-soal', STAFF, wrap(async (req, res) => {
    const { id } = req.body;
    const akG = aksesGuru(req);
    if (akG !== null) {
        const { data: qrow } = await supabase.from('questions').select('exam_id').eq('id', id).maybeSingle();
        if (!qrow || !guruBolehExam(akG, qrow.exam_id)) return tolakMapel(res);
    }
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
        if (examId && !guruBolehExam(aksesGuru(req), examId)) return res.json({ status: 'error', message: 'Kode ujian ini bukan mapel yang Anda ampu.' });
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
        if (examId && !guruBolehExam(aksesGuru(req), examId)) return res.json({ status: 'error', message: 'Kode ujian ini bukan mapel yang Anda ampu.' });
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
// Kolom users.ruang (ruang ujian) & users.jk (jenis kelamin L/P) bersifat opsional:
// bila belum ada di database, data lain tetap tersimpan dan admin diberi peringatan.
let opsionalMatiSampai = 0;
const opsionalError = e => !!(e && /(ruang|\bjk\b)/i.test(e.message || '') && /(column|schema cache)/i.test(e.message || ''));
const tanpaOpsional = p => Array.isArray(p) ? p.map(({ ruang, jk, ...x }) => x) : (({ ruang, jk, ...x }) => x)(p);
const adaIsiOpsional = p => (Array.isArray(p) ? p : [p]).some(x => x && (String(x.ruang || '').trim() !== '' || String(x.jk || '').trim() !== ''));
async function tulisUser(run, payload) {
    if (Date.now() >= opsionalMatiSampai) {
        const r = await run(payload);
        if (!opsionalError(r.error)) return { error: r.error, ruangHilang: false };
        opsionalMatiSampai = Date.now() + 30000; // coba lagi 30 dtk kemudian (mis. setelah migrasi dijalankan)
    }
    const kosong = tanpaOpsional(payload);
    const r2 = (Array.isArray(kosong) ? kosong.length : Object.keys(kosong).length) ? await run(kosong) : { error: null };
    return { error: r2.error, ruangHilang: adaIsiOpsional(payload) };
}
const PESAN_RUANG = 'Kolom "ruang" / "jk" belum ada di database: jalankan file supabase-migration.sql di Supabase (SQL Editor), lalu simpan ulang data ruang dan jenis kelamin.';
const JK_L = new Set(['l', 'lk', 'laki', 'laki-laki', 'laki laki', 'lakilaki', 'm', 'male', 'pria']);
const JK_P = new Set(['p', 'pr', 'perempuan', 'f', 'female', 'wanita']);
const normJk = v => { const t = String(v || '').trim().toLowerCase(); return JK_L.has(t) ? 'L' : JK_P.has(t) ? 'P' : ''; };
const jkDari = row => { const v = row.jk !== undefined ? row.jk : (row.jenis_kelamin !== undefined ? row.jenis_kelamin : row.kelamin); return v === undefined ? undefined : normJk(v); };

app.post('/api/admin/add-user', ADMIN, wrap(async (req, res) => {
    const u = { name: String(req.body.name || '').trim(), username: String(req.body.username || '').trim(), password: String(req.body.password || '').trim(), role: String(req.body.role || 'siswa').toLowerCase(), kelas: String(req.body.kelas || '').trim(), mapel: String(req.body.mapel || '').trim(), ruang: String(req.body.ruang || '').trim(), jk: normJk(req.body.jk) };
    if (!u.name || !u.username || !u.password) return res.json({ status: 'error', message: 'Nama, username, dan password wajib diisi.' });
    const { data: ex } = await supabase.from('users').select('id').eq('username', u.username).maybeSingle();
    if (ex) return res.json({ status: 'error', message: `Username "${u.username}" sudah dipakai.` });
    const { error, ruangHilang } = await tulisUser(p => supabase.from('users').insert([p]), u);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', warning: ruangHilang ? PESAN_RUANG : null });
}));
app.put('/api/admin/update-user', ADMIN, wrap(async (req, res) => {
    const upd = { name: req.body.name, username: req.body.username, password: req.body.password, role: String(req.body.role || 'siswa').toLowerCase(), kelas: req.body.kelas || '', mapel: req.body.mapel || '', ruang: String(req.body.ruang || '').trim(), jk: normJk(req.body.jk) };
    const { error, ruangHilang } = await tulisUser(p => supabase.from('users').update(p).eq('username', req.body.old_username), upd);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', warning: ruangHilang ? PESAN_RUANG : null });
}));
// Simpan hasil pembagian ruang otomatis: groups = [{ ruang: 'R1', usernames: [...] }, ...]
app.post('/api/admin/set-ruang', ADMIN, wrap(async (req, res) => {
    const groups = Array.isArray(req.body.groups) ? req.body.groups : [];
    if (!groups.length) return res.json({ status: 'error', message: 'Data pembagian ruang kosong.' });
    let total = 0;
    for (const g of groups) {
        const ruang = String(g.ruang || '').trim().slice(0, 40);
        const names = (g.usernames || []).map(String).filter(Boolean);
        if (!ruang || !names.length) continue;
        for (let i = 0; i < names.length; i += 150) {
            const part = names.slice(i, i + 150);
            const r = await tulisUser(p => supabase.from('users').update(p).in('username', part).eq('role', 'siswa'), { ruang });
            if (r.ruangHilang) return res.json({ status: 'error', message: PESAN_RUANG });
            if (r.error) return res.json({ status: 'error', message: r.error.message });
            total += part.length;
        }
    }
    res.json({ status: 'success', total });
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
        ruang: row.ruang === undefined ? undefined : String(row.ruang || '').trim(), // undefined = file tidak punya kolom ruang → data ruang lama tidak ditimpa
        jk: jkDari(row),
    })).filter(r => r.username && r.password);
    if (!toProcess.length) return res.json({ status: 'error', message: 'Data tidak valid.' });
    const { data: existing } = await supabase.from('users').select('username');
    const existingSet = new Set((existing || []).map(u => u.username));
    const toInsert = toProcess.filter(u => !existingSet.has(u.username));
    const toUpdate = toProcess.filter(u => existingSet.has(u.username));
    let ruangHilang = false;
    if (toInsert.length) { const r = await tulisUser(p => supabase.from('users').insert(p), toInsert); if (r.error) return res.json({ status: 'error', message: r.error.message }); ruangHilang = ruangHilang || r.ruangHilang; }
    for (const u of toUpdate) { const r = await tulisUser(p => supabase.from('users').update(p).eq('username', u.username), { name: u.name, password: u.password, role: u.role, kelas: u.kelas, mapel: u.mapel, ruang: u.ruang, jk: u.jk }); ruangHilang = ruangHilang || r.ruangHilang; }
    res.json({ status: 'success', imported: toProcess.length, inserted: toInsert.length, updated: toUpdate.length, warning: ruangHilang ? PESAN_RUANG : null });
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

// ============================================================
// JADWAL UJIAN & PENGAWAS RUANG (disimpan di tabel config, kunci 'jadwal_pengawas')
// Aturan yang dijaga server:
//  1. Maksimal 2 jadwal mapel per hari
//  2. Guru yang mapelnya diujikan pada hari itu tidak boleh mengawas (seluruh sesi hari itu)
//  3. Satu guru tidak boleh mengawas dua ruang pada jadwal yang sama
//  4. Tiap ruang memiliki N pengawas yang berbeda (N = pengaturan 'perRuang', 1–4, bawaan 2)
// ============================================================
const JP_KEY = 'jadwal_pengawas';
const JP_ALIAS = [['mtk','matematika','mat','math'],['ipa','ilmupengetahuanalam','sains'],['ips','ilmupengetahuansosial'],['bin','bind','bindo','bahasaindonesia','indo'],['bing','big','ing','bahasainggris','inggris'],['pkn','ppkn','pancasila','pendidikankewarganegaraan'],['pai','pabp','agamaislam','pendidikanagamaislam'],['pak','agamakristen','pendidikanagamakristen','pakris'],['inf','tik','informatika'],['sbk','sbdp','senibudaya','seni','senbud'],['pjok','pjkr','penjas','penjaskes','olahraga'],['prk','prakarya'],['mulok','muatanlokal']];
const subjekKode = c => { const m = alnumLow(c).match(/^[a-z]+/); if (!m) return ''; const g = JP_ALIAS.find(x => x.includes(m[0])); return g ? g[0] : m[0]; };
const subjekGuru = mapelStr => {
    const t = String(mapelStr || '').trim();
    if (!t || /^semua/i.test(t)) return [];
    return [...new Set(t.split(/[,;\n]/).map(subjekKode).filter(Boolean))];
};
async function getJP() {
    try {
        const { data: row } = await supabase.from('config').select('*').eq('key', JP_KEY).maybeSingle();
        const v = row && row.value ? JSON.parse(row.value) : null;
        if (v && Array.isArray(v.jadwal)) return { jadwal: v.jadwal, tugas: v.tugas && typeof v.tugas === 'object' ? v.tugas : {}, perRuang: jpPerRuang(v.perRuang) };
    } catch (e) { /* belum ada */ }
    return { jadwal: [], tugas: {}, perRuang: 2 };
}
const jpPerRuang = v => Math.min(4, Math.max(1, parseInt(v) || 2));
function bersihJP(b) {
    const perRuang = jpPerRuang(b.perRuang);
    const mentah = Array.isArray(b.jadwal) ? b.jadwal : [];
    const jam = v => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v).padStart(5, '0') : '';
    const jadwal = mentah.map(j => ({
        id: String(j.id || '').slice(0, 40), tanggal: String(j.tanggal || '').slice(0, 10), sesi: parseInt(j.sesi) || 0,
        mulai: jam(j.mulai), selesai: jam(j.selesai),
        paket: (Array.isArray(j.paket) ? j.paket : []).map(p => String(p).trim().slice(0, 80)).filter(Boolean).slice(0, 40),
    }));
    const ids = new Set();
    for (const j of jadwal) {
        if (!j.id || ids.has(j.id)) return { error: 'Data jadwal tidak valid (ID kosong/ganda).' };
        ids.add(j.id);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(j.tanggal)) return { error: 'Tanggal jadwal tidak valid.' };
        if (j.sesi !== 1 && j.sesi !== 2) return { error: 'Sesi harus 1 atau 2.' };
        if (!j.paket.length) return { error: `Jadwal ${j.tanggal} sesi ${j.sesi} belum memiliki mata pelajaran.` };
    }
    const tugas = {};
    jadwal.forEach(j => {
        const src = (b.tugas && typeof b.tugas === 'object') ? b.tugas[j.id] : null;
        if (!src || typeof src !== 'object') return;
        const out = {};
        Object.keys(src).slice(0, 300).forEach(r => {
            const ruang = String(r).trim().slice(0, 40);
            if (ruang) out[ruang] = (Array.isArray(src[r]) ? src[r] : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, perRuang);
        });
        tugas[j.id] = out;
    });
    return { jadwal, tugas, perRuang };
}
function validasiJP(jp, gurus) {
    const err = [], warn = [];
    const guruMap = new Map(gurus.map(g => [g.username, g]));
    const perHari = {};
    jp.jadwal.forEach(j => { (perHari[j.tanggal] = perHari[j.tanggal] || []).push(j); });
    Object.entries(perHari).forEach(([tgl, arr]) => {
        if (arr.length > 2) err.push(`Tanggal ${tgl}: maksimal 2 jadwal mapel per hari (saat ini ${arr.length}).`);
        const sesi = arr.map(a => a.sesi);
        if (new Set(sesi).size !== sesi.length) err.push(`Tanggal ${tgl}: nomor sesi ganda.`);
    });
    jp.jadwal.forEach(j => {
        const label = `${j.tanggal} sesi ${j.sesi}`;
        const subjekHari = new Set((perHari[j.tanggal] || []).flatMap(x => x.paket.map(subjekKode)));
        const dipakai = new Map();
        let kurang = 0;
        Object.entries(jp.tugas[j.id] || {}).forEach(([ruang, list]) => {
            if (list.length > jp.perRuang) err.push(`${label} · ${ruang}: maksimal ${jp.perRuang} pengawas per ruang.`);
            if (new Set(list).size !== list.length) err.push(`${label} · ${ruang}: pengawas yang sama dipilih dua kali.`);
            list.forEach(u => {
                const g = guruMap.get(u);
                if (!g) { err.push(`${label} · ${ruang}: "${u}" bukan akun guru.`); return; }
                if (subjekGuru(g.mapel).some(s => subjekHari.has(s))) err.push(`${label} · ${ruang}: ${g.name} tidak boleh mengawas karena mapelnya diujikan pada hari itu.`);
                if (dipakai.has(u) && dipakai.get(u) !== ruang) err.push(`${label}: ${g.name} mengawas dua ruang (${dipakai.get(u)} dan ${ruang}).`);
                dipakai.set(u, ruang);
            });
            if (list.length < jp.perRuang) kurang++;
        });
        if (kurang) warn.push(`${label}: ${kurang} ruang belum memiliki ${jp.perRuang} pengawas.`);
    });
    return { err: [...new Set(err)], warn };
}
app.get('/api/admin/jadwal-pengawas', ADMIN, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await getJP());
}));
app.put('/api/admin/jadwal-pengawas', ADMIN, wrap(async (req, res) => {
    const jp = bersihJP(req.body || {});
    if (jp.error) return res.json({ status: 'error', message: jp.error, errors: [jp.error] });
    const { data: gurus } = await supabase.from('users').select('username, name, mapel').eq('role', 'guru');
    const { err, warn } = validasiJP(jp, gurus || []);
    if (err.length) return res.json({ status: 'error', message: err[0], errors: err });
    const { error } = await supabase.from('config').upsert({ key: JP_KEY, value: JSON.stringify(jp) }, { onConflict: 'key' });
    if (error) return res.json({ status: 'error', message: error.message, errors: [error.message] });
    res.json({ status: 'success', warnings: warn });
}));

// ============================================================
// KIRIM HASIL UJIAN KE WA ORANG TUA (Fonnte). Tanpa migrasi SQL: data disimpan di tabel config.
//  wa_ortu = { username: "628..." }   wa_kkm = { def: 75, mapel: { mtk: 80 } }   wa_log = { "paket|username": {t, ok} }
// Token Fonnte dibaca dari environment variable FONNTE_TOKEN (tidak disimpan di kode/database).
// ============================================================
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || '';
const NAMA_MAPEL = { mtk: 'Matematika', bin: 'Bahasa Indonesia', bing: 'Bahasa Inggris', ipa: 'IPA', ips: 'IPS', pkn: 'PPKn', pai: 'Pendidikan Agama Islam', pak: 'Pendidikan Agama Kristen', inf: 'Informatika', sbk: 'Seni Budaya', pjok: 'PJOK', prk: 'Prakarya', mulok: 'Muatan Lokal' };
async function getCfg(key, def) {
    try { const { data: row } = await supabase.from('config').select('*').eq('key', key).maybeSingle(); if (row && row.value) return { ...def, ...JSON.parse(row.value) }; } catch (e) { /* belum ada */ }
    return def;
}
const setCfg = (key, val) => supabase.from('config').upsert({ key, value: JSON.stringify(val) }, { onConflict: 'key' });
function normWa(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
    return /^62\d{8,13}$/.test(d) ? d : null; // null = tidak valid
}
const kkmUntuk = (kkm, paket) => { const k = subjekKode(paket); const v = kkm.mapel && kkm.mapel[k] !== undefined ? kkm.mapel[k] : kkm.def; return Number.isFinite(+v) ? +v : 75; };
function susunPesanWa({ nama, kelas, paket, tanggal, nilai, kkm, sekolah }) {
    const mp = NAMA_MAPEL[subjekKode(paket)] || paket;
    const n = parseFloat(String(nilai).replace(',', '.'));
    const tuntas = Number.isFinite(n) && n >= kkm;
    const angka = Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : String(nilai);
    let t = `Yth. Orang tua/wali dari *${nama}*${kelas && kelas !== '-' ? ` (Kelas ${kelas})` : ''}.\n\nHasil ujian *${mp}*${tanggal ? ', ' + tanggal : ''}:\nNilai: *${angka}*\nStatus: *${tuntas ? 'TUNTAS' : 'BELUM TUNTAS (REMEDIAL)'}* (KKM ${kkm})\n\n`;
    t += tuntas ? 'Catatan: nilai ini bukan nilai rapor.' : 'Catatan: nilai ini bukan nilai rapor. Namun, siswa tetap wajib mengikuti remedial/perbaikan sampai tuntas. Informasi jadwal remedial akan disampaikan oleh sekolah.';
    return t + `\n\n— ${sekolah}`;
}
async function kirimFonnte(target, message) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    try {
        const r = await fetch('https://api.fonnte.com/send', { method: 'POST', headers: { Authorization: FONNTE_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ target, message, countryCode: '62' }).toString(), signal: ac.signal });
        const j = await r.json().catch(() => ({}));
        return j && j.status === true ? { ok: true } : { ok: false, reason: (j && (j.reason || j.message)) || 'Ditolak Fonnte' };
    } catch (e) { return { ok: false, reason: e.name === 'AbortError' ? 'Waktu habis' : e.message }; }
    finally { clearTimeout(to); }
}
app.get('/api/admin/wa-data', ADMIN, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const [nomor, kkm, log] = await Promise.all([getCfg('wa_ortu', {}), getCfg('wa_kkm', { def: 75, mapel: {} }), getCfg('wa_log', {})]);
    res.json({ nomor, kkm, log, fonnte: !!FONNTE_TOKEN });
}));
app.put('/api/admin/wa-nomor', ADMIN, wrap(async (req, res) => {
    const ubah = (req.body && typeof req.body.nomor === 'object' && req.body.nomor) || {};
    const nomor = await getCfg('wa_ortu', {}), salah = [];
    Object.keys(ubah).slice(0, 2000).forEach(u => {
        const v = String(ubah[u] || '').trim();
        if (!v) { delete nomor[u]; return; }
        const n = normWa(v);
        if (n === null) salah.push(u); else nomor[u] = n;
    });
    const { error } = await setCfg('wa_ortu', nomor);
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success', nomor, salah });
}));
app.put('/api/admin/wa-kkm', ADMIN, wrap(async (req, res) => {
    const b = req.body || {}, def = Math.min(100, Math.max(0, parseFloat(b.def)));
    if (!Number.isFinite(def)) return res.json({ status: 'error', message: 'KKM tidak valid' });
    const mapel = {};
    Object.entries(b.mapel || {}).forEach(([k, v]) => { const n = parseFloat(v); if (/^[a-z]+$/.test(k) && Number.isFinite(n)) mapel[k] = Math.min(100, Math.max(0, n)); });
    const { error } = await setCfg('wa_kkm', { def, mapel });
    if (error) return res.json({ status: 'error', message: error.message });
    res.json({ status: 'success' });
}));
// body: { mapel: <kode paket>, items: [username...], dryRun?, tes?: "08..." }
app.post('/api/admin/wa-kirim', ADMIN, wrap(async (req, res) => {
    const b = req.body || {}, paket = String(b.mapel || '').trim();
    if (!paket) return res.json({ status: 'error', message: 'Mapel belum dipilih' });
    const usernames = (Array.isArray(b.items) ? b.items : []).map(String).slice(0, 10);
    if (!usernames.length) return res.json({ status: 'error', message: 'Tidak ada siswa dipilih' });
    if (!b.dryRun && !FONNTE_TOKEN) return res.json({ status: 'error', message: 'FONNTE_TOKEN belum dipasang di Vercel (Settings → Environment Variables).' });
    const [nomor, kkm, log, sek, { data: users }, { data: results }] = await Promise.all([
        getCfg('wa_ortu', {}), getCfg('wa_kkm', { def: 75, mapel: {} }), getCfg('wa_log', {}), getSekolah(),
        supabase.from('users').select('username, name, kelas').in('username', usernames),
        supabase.from('results').select('student_name, mapel, nilai, kelas, tanggal').eq('mapel', paket),
    ]);
    const nilaiMap = new Map((results || []).map(r => [r.student_name, r]));
    const nilaiKkm = kkmUntuk(kkm, paket), hasil = [];
    for (const un of usernames) {
        const u = (users || []).find(x => x.username === un), r = u && nilaiMap.get(u.name);
        if (!u) { hasil.push({ username: un, ok: false, reason: 'Siswa tidak ditemukan' }); continue; }
        if (!r) { hasil.push({ username: un, ok: false, reason: 'Belum ada nilai' }); continue; }
        const target = b.tes ? normWa(b.tes) : nomor[un];
        if (!target) { hasil.push({ username: un, ok: false, reason: 'Nomor WA kosong/tidak valid' }); continue; }
        const pesan = susunPesanWa({ nama: u.name, kelas: (r.kelas && r.kelas !== '-') ? r.kelas : u.kelas, paket, tanggal: r.tanggal, nilai: r.nilai, kkm: nilaiKkm, sekolah: sek.nama_sekolah || 'Sekolah' });
        if (b.dryRun) { hasil.push({ username: un, ok: true, pesan, target }); continue; }
        const k = await kirimFonnte(target, pesan);
        if (!b.tes) log[`${paket}|${un}`] = { t: new Date().toISOString(), ok: k.ok, reason: k.ok ? '' : k.reason };
        hasil.push({ username: un, ok: k.ok, reason: k.reason || '' });
        await new Promise(r2 => setTimeout(r2, 1200));
    }
    if (!b.dryRun && !b.tes) await setCfg('wa_log', log);
    res.json({ status: 'success', hasil });
}));


app.get('/api/admin/soal-khusus', ADMIN, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    khususCache.until = 0; res.json(await getKhusus());
}));
app.put('/api/admin/soal-khusus', ADMIN, wrap(async (req, res) => {
    const b = req.body || {};
    const siswa = [...new Set((Array.isArray(b.siswa) ? b.siswa : []).map(x => String(x).trim()).filter(Boolean))].slice(0, 2000);
    const map = {};
    Object.entries(b.map && typeof b.map === 'object' ? b.map : {}).forEach(([k, v]) => { const a = String(k).trim().slice(0, 80), z = String(v || '').trim().slice(0, 80); if (a && z && a !== z) map[a] = z; });
    const { error } = await supabase.from('config').upsert({ key: 'soal_khusus', value: JSON.stringify({ siswa, map }) }, { onConflict: 'key' });
    if (error) return res.json({ status: 'error', message: error.message });
    khususCache.until = 0; clearQCache();
    res.json({ status: 'success' });
}));

module.exports = app;
