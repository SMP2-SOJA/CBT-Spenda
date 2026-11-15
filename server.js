const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const XLSX = require('xlsx');
const mammoth = require('mammoth');
const fs = require('fs');

const upload = multer({ dest: '/tmp' }); // Folder penyimpanan sementara Vercel
const supabaseUrl = 'https://uftiednbhdmexxlabhad.supabase.co';
const supabaseKey = 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// AKSES GURU MAPEL (guru hanya melihat mapel & kelas yang diampu)
// Format kolom users.mapel milik guru: "PAI" atau "MTK-7A,MTK-7B" atau "IPA" (pisahkan dengan koma)
//   PAI      → semua paket soal PAI (semua kelas)
//   MTK-7    → paket MTK untuk semua kelas 7
//   MTK-7A   → paket MTK khusus kelas 7A (data siswa kelas lain tidak tampil)
//   kosong / "Semua" → semua mapel
// ==========================================
const alnumLow = v => String(v || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
function normKelas(k) {
    let t = String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return t.replace(/^(viii|vii|ix)/, r => ({ viii: '8', vii: '7', ix: '9' })[r]);
}
function parseAksesGuru(mapelStr) {
    const raw = String(mapelStr || '').trim();
    if (!raw || /^semua/i.test(raw)) return null; // null = akses semua mapel
    return raw.split(/[,;\n]/).map(x => x.trim()).filter(Boolean).map(x => {
        const t = alnumLow(x);
        const m = t.match(/^([a-z]*?)(\d+)([a-z]?)$/);
        return { t, subject: m ? m[1] : t, grade: m ? m[2] : '', letter: m ? m[3] : '' };
    });
}
function tokenCocokExam(tk, examId) {
    const e = alnumLow(examId);
    if (!e || !tk.t) return false;
    if (e.includes(tk.t)) return true;
    // token berkelas (MTK-7A) juga berhak atas paket tingkat umum (MTK-7)
    if (tk.letter && tk.subject && e.includes(tk.subject)) {
        const segs = String(examId).split(/[^a-zA-Z0-9]+/);
        return segs.some(sg => sg === tk.grade);
    }
    return false;
}
function tokenCocokKelas(tk, kelas) {
    const k = normKelas(kelas);
    if (!k || k === '-') return true;           // kelas tidak diketahui → jangan disembunyikan
    if (tk.grade && tk.letter) return k === tk.grade + tk.letter;
    if (tk.grade) return k.startsWith(tk.grade);
    return true;
}
function guruBolehExam(akses, examId) {
    if (akses === null) return true;
    return akses.some(tk => tokenCocokExam(tk, examId));
}
function guruBolehRow(akses, examId, kelas) {
    if (akses === null) return true;
    return akses.some(tk => tokenCocokExam(tk, examId) && tokenCocokKelas(tk, kelas));
}
function guruBolehJadwal(akses, mapelStr) {
    if (akses === null) return true;
    return String(mapelStr || '').split(',').some(m => guruBolehExam(akses, m.trim()));
}

// Identitas pengguna panel admin dibaca dari header x-user / x-pass, lalu diverifikasi ke database
const actorCache = new Map();
async function getActor(req) {
    let u = req.get('x-user'), p = req.get('x-pass');
    if (!u || !p) return null;
    try { u = decodeURIComponent(u); p = decodeURIComponent(p); } catch (e) { return null; }
    const key = u + '\u0000' + p;
    const c = actorCache.get(key);
    if (c && Date.now() - c.t < 30000) return c.v;
    const { data } = await supabase.from('users').select('username, role, mapel, kelas').eq('username', u).eq('password', p).maybeSingle();
    actorCache.set(key, { t: Date.now(), v: data || null });
    if (actorCache.size > 500) actorCache.clear();
    return data || null;
}
const isGuru = req => !!(req.actor && String(req.actor.role).toLowerCase() === 'guru');
const aksesGuru = req => parseAksesGuru(req.actor && req.actor.mapel);

// Endpoint yang tidak boleh dipakai guru (khusus admin)
const ADMIN_ONLY = /^\/(users|add-user|update-user|delete-user|clear-users|import-users|add-schedule|update-schedule|delete-schedule|clear-schedules|clear-monitoring|clear-results|clear-questions|delete-exam|delete-question)(\/|$)/;
app.use('/api/admin', async (req, res, next) => {
    try { req.actor = await getActor(req); } catch (e) { req.actor = null; }
    if (isGuru(req) && ADMIN_ONLY.test(req.path)) {
        return res.status(403).json({ status: 'error', message: 'Fitur ini hanya untuk admin.' });
    }
    next();
});

// Jadwal baru boleh dibuka siswa setelah tanggal & jam mulai (zona WITA, UTC+8). Format tanggal: "YYYY-MM-DD|HH:MM"
function waktuMulaiJadwal(j) {
    const [tgl, jam] = String(j.tanggal || '').split('|');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl || '')) return null;
    const hm = /^\d{1,2}:\d{2}$/.test(jam || '') ? jam.padStart(5, '0') : '00:00';
    const t = new Date(`${tgl}T${hm}:00+08:00`);
    return isNaN(t.getTime()) ? null : t;
}
const jadwalSudahMulai = j => { const t = waktuMulaiJadwal(j); return !t || Date.now() >= t.getTime(); };
function infoMulai(j) { const [tgl, jam] = String(j.tanggal || '').split('|'); return `${tgl}${jam ? ' pukul ' + jam : ''} WITA`; }

// Kecocokan paket soal dengan kelas siswa (dipakai cek-pin & get-soal)
//   MTK-7A → hanya kelas 7A | MTK-7 → semua kelas 7 | tanpa angka → semua kelas
function kelasCocokan(examCode, studentKelas) {
    const e = examCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const s = studentKelas.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const sMatch = s.match(/(\d+)([a-z]?)/);
    if (!sMatch) return e.includes(s);
    const sGrade = sMatch[1];
    const sLetter = sMatch[2];
    if (sLetter && e.includes(sGrade + sLetter)) return true;
    const gradeOnlyRe = new RegExp(sGrade + '(?![a-z])');
    const hasClassLetter = new RegExp(sGrade + '[a-z]').test(e);
    if (gradeOnlyRe.test(e) && !hasClassLetter) return true;
    return false;
}

// ==========================================
// 0. JALUR DARURAT (PEMULIHAN ADMIN)
// ==========================================
app.get('/api/admin/darurat', async (req, res) => {
    const { error } = await supabase.from('users').upsert({ username: 'admin', password: '123', name: 'Administrator Utama', role: 'admin', kelas: 'Admin', mapel: 'Semua' }, { onConflict: 'username' });
    if (error) return res.send("Gagal memulihkan admin: " + error.message);
    res.send("<h1>BERHASIL!</h1><p>Akun admin telah dipulihkan. Silakan login Username: <b>admin</b> dan Password: <b>123</b></p>");
});

// ==========================================
// 1. OTENTIKASI & LOGIN
// ==========================================
app.post('/api/login', async (req, res) => { 
    try {
        const { username, password } = req.body; 
        const { data, error } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single(); 
        if (error || !data) return res.status(401).json({status: "error", message: "Username atau Password salah!"}); 
        res.json({status: "success", user: data}); 
    } catch (err) { res.status(500).json({status: "error", message: err.message}); }
});

// ==========================================
// 2. SISTEM SENSOR KELAS & CEK BLOKIR
// ==========================================
app.post('/api/siswa/cek-pin', async (req, res) => {
    try {
        const { pin, kelas, student_name } = req.body; 
        let { data, error } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif');
        if (error || !data || data.length === 0) return res.json({status: "error", message: "PIN Salah atau Ujian telah ditutup!"});
        const sudahMulai = data.filter(jadwalSudahMulai);
        if (sudahMulai.length === 0) return res.json({status: "error", message: `⏳ Ujian belum dimulai. Jadwal mulai: ${infoMulai(data[0])}.`});
        data = sudahMulai;
        
        let allMapels = [];
        data.forEach(d => { if(d.mapel) d.mapel.split(',').forEach(m => { if(m.trim()) allMapels.push(m.trim()); }); });

        // CEK APAKAH SISWA SEDANG DIBLOKIR ATAU SUDAH SELESAI
        if (student_name) {
            const { data: actData } = await supabase.from('activity').select('status').eq('student_name', student_name).in('exam_name', allMapels);
            if (actData && actData.length > 0) {
                const isBlocked  = actData.some(a => a.status && a.status.includes('Terkunci'));
                const isFinished = actData.some(a => a.status === 'Selesai');
                if (isBlocked) {
                    return res.json({status: "error", message: "🔒 Akun Anda masih terkunci karena pelanggaran. Hubungi guru/pengawas untuk membuka akses, lalu login kembali untuk melanjutkan ujian."});
                }
                if (isFinished) {
                    return res.json({status: "error", message: "✅ Anda sudah menyelesaikan ujian ini. Hasil telah tersimpan. Hubungi guru jika ada pertanyaan."});
                }
            }
        }

        if (!kelas || String(kelas).trim() === '') {
            const totalDurasi = data.reduce((sum, d) => sum + parseInt(d.durasi || 0), 0);
            return res.json({ status: "success", exam: { mapel: allMapels.join(', '), durasi: totalDurasi } });
        }

        // ── LOGIKA SENSOR KELAS (diperbaiki) ──
        // MTK-7A  → hanya kelas 7A
        // MTK-7B  → hanya kelas 7B
        // MTK-7   → semua kelas 7 (7A, 7B, 7C, ...)
        // IPA / UMUM → semua kelas (tidak ada angka tingkat)

        const cocokKelas = allMapels.filter(m => kelasCocokan(m, kelas));
        let mapelGabungan = '';

        if (cocokKelas.length > 0) {
            mapelGabungan = cocokKelas.join(', ');
        } else {
            // Jika tidak cocok, cek apakah soal bersifat umum (tidak ada angka tingkat)
            const isUmum = allMapels.every(m => !/\d/.test(m.replace(/[^a-zA-Z0-9]/g, '')));
            if (isUmum) {
                mapelGabungan = allMapels.join(', ');
            } else {
                return res.json({status: "error", message: `Akses ditolak! Paket soal ini tidak tersedia untuk kelas ${kelas}.`});
            }
        }

        const totalDurasi = data.reduce((sum, d) => sum + parseInt(d.durasi || 0), 0);
        res.json({ status: "success", exam: { mapel: mapelGabungan, durasi: totalDurasi } });
    } catch (err) { res.json({status: "error", message: "Gagal menyortir soal: " + err.message}); }
});

app.post('/api/siswa/get-soal', async (req, res) => { 
    try {
        const { exam_id, pin, kelas } = req.body; 
        if (!exam_id) return res.json({ questions: [] });
        const diminta = exam_id.split(',').map(m => m.trim()).filter(Boolean);

        // Soal HANYA boleh diambil dari paket yang sudah dijadwalkan admin (status Aktif, sesuai PIN)
        let q = supabase.from('schedules').select('mapel, tanggal').eq('status', 'Aktif');
        if (pin) q = q.eq('pin', String(pin));
        const { data: jadwal, error: errJ } = await q;
        if (errJ) throw errJ;
        const terjadwal = new Set();
        (jadwal || []).filter(jadwalSudahMulai).forEach(j => String(j.mapel || '').split(',').forEach(m => { if (m.trim()) terjadwal.add(m.trim()); }));

        let boleh = diminta.filter(m => terjadwal.has(m));
        // Paket tingkat/kelas lain tetap tertutup untuk siswa
        if (kelas && String(kelas).trim() !== '') {
            const cocok = boleh.filter(m => kelasCocokan(m, String(kelas)));
            const isUmum = boleh.every(m => !/\d/.test(m.replace(/[^a-zA-Z0-9]/g, '')));
            boleh = cocok.length > 0 ? cocok : (isUmum ? boleh : []);
        }
        if (boleh.length === 0) return res.json({ questions: [] });

        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .in('exam_id', boleh)
            .order('id', { ascending: true }); // ← Urutan sesuai import
        if (error) throw error;
        res.json({ questions: data || [] }); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 3. AKTIVITAS & REKAP (BYPASS SUPABASE)
// ==========================================
app.post('/api/siswa/ping', async (req, res) => { 
    // Cek status saat ini — jangan timpa status yang dilindungi
    const { data: cur } = await supabase
        .from('activity').select('status')
        .eq('student_name', req.body.student_name)
        .eq('exam_name', req.body.mapel)
        .maybeSingle();
    
    const curStatus = cur?.status || '';
    const isProtected = curStatus.includes('Terkunci') || curStatus === 'Selesai' || curStatus.includes('Curang') || curStatus.includes('Peringatan');
    if (isProtected) return res.json({status: "protected"});

    const lstText = new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')'; 
    const payload = { student_name: req.body.student_name, exam_name: req.body.mapel, status: 'Mengerjakan', score: req.body.live_score, last_seen: lstText };
    const { error } = await supabase.from('activity').upsert({ ...payload, kelas: req.body.kelas || '-' }, {onConflict: 'student_name,exam_name'}); 
    if (error) await supabase.from('activity').upsert(payload, {onConflict: 'student_name,exam_name'}); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/submit', async (req, res) => { 
    try {
        const tglDB = new Date().toLocaleDateString('id-ID') + '|' + (req.body.durasi || '-');
        const isCurang = req.body.is_curang === true || req.body.is_curang === 'true';

        // ── Cegah duplikasi record (Bug 2 & 3) ──
        // Jika sudah ada record & bukan force-curang, cek nilai lama
        // → selalu pakai nilai terbaru (siswa lanjut setelah dibuka guru)
        const { data: existing } = await supabase
            .from('results')
            .select('nilai')
            .eq('student_name', req.body.student_name)
            .eq('mapel', req.body.mapel)
            .maybeSingle();

        // Jika force-curang (submit paksa) tapi sudah ada record dengan nilai LEBIH TINGGI, skip
        if (isCurang && existing && existing.nilai >= req.body.nilai) {
            // Jangan timpa nilai yang sudah lebih tinggi saat force-submit curang
            return res.json({status: "success", skipped: true});
        }

        // Hapus record lama agar tidak ada duplikasi
        if (existing) {
            await supabase.from('results')
                .delete()
                .eq('student_name', req.body.student_name)
                .eq('mapel', req.body.mapel);
        }

        // Insert nilai baru
        const { error: insertErr } = await supabase.from('results').insert([{ 
            student_name: req.body.student_name, 
            mapel: req.body.mapel, 
            nilai: req.body.nilai, 
            benar: req.body.benar, 
            salah: req.body.salah, 
            detail_jawaban: req.body.detail_jawaban, 
            tanggal: tglDB 
        }]);

        if (insertErr) throw insertErr;

        // Update status aktivitas
        await supabase.from('activity').update({ 
            status: isCurang ? 'Curang (Terkunci)' : 'Selesai', 
            score: req.body.nilai, 
            last_seen: new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')' 
        }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);

        res.json({status: "success"});
    } catch(err) {
        // Return error yang jelas agar client bisa simpan ke pending (Bug 1)
        res.json({status: "error", message: "Gagal simpan: " + err.message});
    }
});

app.post('/api/siswa/flag-curang', async (req, res) => {
    const count = parseInt(req.body.count) || 1;
    // count >= 4 → status Terkunci (setelah 3 peringatan); < 4 → catat peringatan saja
    const statusText = count >= 4 ? 'Curang (Terkunci)' : `Mengerjakan (Peringatan ${count}x)`;
    await supabase.from('activity')
        .update({ status: statusText })
        .eq('student_name', req.body.student_name)
        .eq('exam_name', req.body.mapel);
    res.json({ status: 'success' });
});

// ==========================================
// 4. PANEL DASHBOARD 
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    const { count: cSiswa } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'siswa');
    const { count: cGuru } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'guru');
    res.json({total_siswa: cSiswa||0, total_guru: cGuru||0});
});

app.get('/api/admin/recent-activity', async (req, res) => { 
    const { data } = await supabase.from('activity').select('*').order('last_seen', {ascending: false}); 
    res.json(data || []); // Monitoring: semua guru boleh memantau; pembukaan akses dibatasi di reset-siswa
});
app.get('/api/admin/results', async (req, res) => { 
    const [{ data: results }, { data: activity }, { data: users }] = await Promise.all([
        supabase.from('results').select('*').order('id', { ascending: false }),
        supabase.from('activity').select('student_name, exam_name, kelas'),
        supabase.from('users').select('name, kelas').eq('role', 'siswa')
    ]);
    const actMap = {}, userMap = {};
    (activity || []).forEach(a => { actMap[`${a.student_name}|${a.exam_name}`] = a.kelas || '-'; });
    (users    || []).forEach(u => { if(u.name) userMap[u.name] = u.kelas || '-'; });
    const seen = new Set();
    const merged = (results || [])
        .map(r => {
            let kelas = (r.kelas && r.kelas !== '-') ? r.kelas
                      : (actMap[`${r.student_name}|${r.mapel}`] || '-');
            if (kelas === '-') kelas = userMap[r.student_name] || '-';
            return { ...r, kelas };
        })
        .filter(r => { const k = `${r.student_name}|${r.mapel}`; if(seen.has(k)) return false; seen.add(k); return true; });
    if (isGuru(req)) { const ak = aksesGuru(req); return res.json(merged.filter(r => guruBolehRow(ak, r.mapel, r.kelas))); }
    res.json(merged);
});

// Tentukan apakah kelas siswa cocok dengan mapel (logika sama dengan cek-pin)
function kelasMatchMapel(kelas, mapelCode) {
    if (!kelas || kelas === '-') return false;
    const m = mapelCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const k = kelas.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const km = k.match(/(\d+)([a-z]?)/);
    if (!km) return !(/\d/.test(m)); // kelas tanpa angka cocok jika mapel juga tanpa angka
    const grade = km[1], letter = km[2];
    // Mapel punya huruf kelas spesifik (misal "8b" di "mtk8b") → hanya cocok kelas yang sama
    if (new RegExp(grade + '[a-z]').test(m)) return m.includes(grade + letter);
    // Mapel hanya punya angka tingkat (misal "8" di "pkn8") → semua kelas tingkat itu
    if (new RegExp(grade + '(?![a-z])').test(m)) return true;
    return false;
}

// Roster: semua siswa yang SEHARUSNYA ikut ujian berdasarkan mapel
app.get('/api/admin/exam-roster', async (req, res) => {
    const { mapel } = req.query;
    if (!mapel) return res.json([]);
    if (isGuru(req) && !guruBolehExam(aksesGuru(req), mapel)) return res.json([]);
    try {
        const [{ data: usersData }, { data: actData }] = await Promise.all([
            supabase.from('users').select('name, kelas').eq('role', 'siswa'),
            supabase.from('activity').select('student_name, kelas').eq('exam_name', mapel)
        ]);
        const roster = new Map();
        // Ambil semua siswa yang kelasnya cocok dengan mapel
        (usersData || []).forEach(u => {
            if (u.name && kelasMatchMapel(u.kelas, mapel)) roster.set(u.name, u.kelas || '-');
        });
        // Tambah siswa dari activity yang mungkin tidak ada di tabel users
        const userMap = {};
        (usersData || []).forEach(u => { if(u.name) userMap[u.name] = u.kelas || '-'; });
        (actData || []).forEach(a => {
            if (!roster.has(a.student_name)) {
                const k = (a.kelas && a.kelas !== '-') ? a.kelas : (userMap[a.student_name] || '-');
                if (kelasMatchMapel(k, mapel)) roster.set(a.student_name, k);
            }
        });
        let hasil = [...roster.entries()].map(([name, kelas]) => ({ name, kelas }));
        if (isGuru(req)) { const ak = aksesGuru(req); hasil = hasil.filter(r => guruBolehRow(ak, mapel, r.kelas)); }
        res.json(hasil);
    } catch(e) { console.error(e); res.json([]); }
});

app.post('/api/admin/reset-siswa', async (req, res) => {
    if (isGuru(req) && !guruBolehExam(aksesGuru(req), req.body.mapel)) return res.status(403).json({ status: 'error', message: 'Bukan mapel yang Anda ampu.' });
    // Buka akses: ubah status kembali ke 'Mengerjakan' (bukan hapus)
    // Siswa bisa login ulang dan melanjutkan ujian dari local storage
    await supabase.from('activity')
        .update({ status: 'Mengerjakan' })
        .eq('student_name', req.body.student_name)
        .eq('exam_name', req.body.mapel);
    res.json({ status: 'success' });
});
app.delete('/api/admin/remove-activity/:id', async (req, res) => {
    if (isGuru(req)) {
        const { data: row } = await supabase.from('activity').select('exam_name, kelas').eq('id', req.params.id).maybeSingle();
        if (!row || !guruBolehRow(aksesGuru(req), row.exam_name, row.kelas)) return res.status(403).json({ status: 'error', message: 'Bukan mapel yang Anda ampu.' });
    }
    await supabase.from('activity').delete().eq('id', req.params.id); res.json({status: "success"}); 
});
app.delete('/api/admin/clear-monitoring', async (req, res) => { await supabase.from('activity').delete().neq('id', 0); res.json({status:"success"}); });
app.delete('/api/admin/clear-results', async (req, res) => { await supabase.from('results').delete().neq('id', 0); res.json({status:"success"}); });

// ==========================================
// 5. MANAJEMEN JADWAL UJIAN
// ==========================================
app.get('/api/admin/schedules', async (req, res) => { 
    const { data } = await supabase.from('schedules').select('*').order('id', {ascending: false}); 
    res.json(data || []); // PIN/token jadwal dapat dipantau semua guru (hanya baca; ubah jadwal khusus admin)
});
app.post('/api/admin/add-schedule', async (req, res) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    await supabase.from('schedules').insert([{ mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: req.body.durasi, pin, status: 'Aktif' }]);
    res.json({status: "success"});
});
app.put('/api/admin/update-schedule', async (req, res) => { await supabase.from('schedules').update({ mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: req.body.durasi, status: req.body.status }).eq('id', req.body.id); res.json({status: "success"}); });
app.delete('/api/admin/delete-schedule/:id', async (req, res) => { await supabase.from('schedules').delete().eq('id', req.params.id); res.json({status: "success"}); });
app.delete('/api/admin/clear-schedules', async (req, res) => { await supabase.from('schedules').delete().neq('id', 0); res.json({status: "success"}); });

// ==========================================
// 6. REPOSITORI BANK SOAL (DENGAN EXCEL & WORD)
// ==========================================
app.get('/api/admin/available-exams', async (req, res) => {
    const { data } = await supabase.from('questions').select('exam_id');
    let exams = [...new Set((data || []).map(q => q.exam_id))];
    if (isGuru(req)) { const ak = aksesGuru(req); exams = exams.filter(e => guruBolehExam(ak, e)); }
    res.json(exams);
});
app.get('/api/admin/questions', async (req, res) => { 
    const { data } = await supabase.from('questions').select('*').order('id', {ascending: true}); 
    let out = data || [];
    if (isGuru(req)) { const ak = aksesGuru(req); out = out.filter(q => guruBolehExam(ak, q.exam_id)); }
    res.json(out); 
});
app.post('/api/admin/add-soal-bulk', async (req, res) => { await supabase.from('questions').insert(req.body.questions); res.json({status: "success"}); });
app.delete('/api/admin/delete-question/:id', async (req, res) => { await supabase.from('questions').delete().eq('id', req.params.id); res.json({status: "success"}); });
app.put('/api/admin/update-soal', async (req, res) => {
    // Guru/Admin koreksi kunci atau konten soal
    const { id, kunci, tanya, opsi_json } = req.body;
    if (isGuru(req)) {
        const { data: qrow } = await supabase.from('questions').select('exam_id').eq('id', id).maybeSingle();
        if (!qrow || !guruBolehExam(aksesGuru(req), qrow.exam_id)) return res.status(403).json({ status: 'error', message: 'Bukan mapel yang Anda ampu.' });
    }
    const update = {};
    if (kunci !== undefined) update.kunci = kunci;
    if (tanya !== undefined) update.tanya = tanya;
    if (opsi_json !== undefined) update.opsi_json = opsi_json;
    const { error } = await supabase.from('questions').update(update).eq('id', id);
    if (error) return res.json({status:"error", message: error.message});
    res.json({status:"success"});
});
app.delete('/api/admin/delete-exam/:exam_id', async (req, res) => { await supabase.from('questions').delete().eq('exam_id', req.params.exam_id); res.json({status: "success"}); });
app.delete('/api/admin/clear-questions', async (req, res) => { await supabase.from('questions').delete().neq('id', 0); res.json({status: "success"}); });

app.post('/api/admin/upload-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.json({status: "error", message: "File kosong!"});
        const examId = (req.body.exam_id || '').trim();
        if (!examId) return res.json({status: "error", message: "Kode Ujian wajib diisi!"});

        const wb = XLSX.readFile(req.file.path);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        fs.unlinkSync(req.file.path);

        if (!rows.length) return res.json({status:"error", message:"File kosong atau format tidak dikenal."});

        // ── BS/TS kunci: "B,B,S" → "A,A,B" (B=Benar→A, S=Salah→B) ──
        const bsMap = {'B':'A','S':'B','BENAR':'A','SALAH':'B','T':'A','TS':'B','SESUAI':'A','TIDAK':'B'};

        const questions = rows.map(row => {
            const tipe  = String(row['Tipe']||row['tipe']||'PG').toUpperCase().trim();
            const tanya = String(row['Pertanyaan']||row['pertanyaan']||row['tanya']||'').trim();
            if (!tanya) return null;

            // Kumpulkan semua opsi non-kosong (A-G)
            const optCols = ['Opsi_A','Opsi_B','Opsi_C','Opsi_D','Opsi_E','Opsi_F','Opsi_G'];
            const opts = optCols.map(c => String(row[c]||'').trim()).filter(o=>o);
            const opsi_json = opts.join('|||');

            const kunciRaw = String(row['Kunci']||row['kunci']||'').trim();
            const skor     = parseFloat(row['Skor']||row['skor']||1) || 1;
            const gambar   = String(row['Link_Gambar']||row['link_gambar']||row['media_path']||'').trim();

            let kunci = kunciRaw;
            if (tipe === 'BS' || tipe === 'TS') {
                // "B,B,S" → "A,A,B"
                kunci = kunciRaw.split(',').map(k => bsMap[k.trim().toUpperCase()] || k.trim()).join(',');
            } else if (tipe === 'PG') {
                kunci = kunciRaw.toUpperCase().charAt(0);
            } else if (tipe === 'PGK' || tipe === 'SIFAT') {
                kunci = kunciRaw.toUpperCase().replace(/\s/g,'');
            }

            return { exam_id:examId, tipe, tanya, opsi_json, kunci, media_path:gambar, skor, gform_url:'' };
        }).filter(q => q !== null);

        if (!questions.length) return res.json({status:"error", message:"Tidak ada data soal valid di file."});

        const { error } = await supabase.from('questions').insert(questions);
        if (error) throw error;
        res.json({status:"success", message:`${questions.length} soal berhasil diimport dari Excel!`, total: questions.length});
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({status:"error", message:"Gagal memproses Excel: " + err.message});
    }
});

app.post('/api/admin/upload-word', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.json({status: "error", message: "File kosong!"});
        const examId   = (req.body.exam_id || '').trim();
        const filePath = req.file.path;

        // ================================================================
        // OMML-TO-TEXT CONVERTER (iteratif inside-out)
        // Mendukung: superscript, subscript, akar (√), pecahan, kurung
        // Guru tidak perlu ubah format — equation editor Word langsung dibaca
        // ================================================================
        function ommlToText(cellXml) {
            const SUP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵',
                         '6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','T':'ᵀ',
                         '-1':'⁻¹','-2':'⁻²','-3':'⁻³','-4':'⁻⁴',
                         '-5':'⁻⁵','-6':'⁻⁶','-7':'⁻⁷','-8':'⁻⁸','-9':'⁻⁹'};
            const SUB = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅',
                         '6':'₆','7':'₇','8':'₈','9':'₉','n':'ₙ','i':'ᵢ','x':'ₓ'};

            let s = cellXml;

            // Iterasi sampai tidak ada perubahan (maks 30x)
            for (let iter = 0; iter < 30; iter++) {
                const prev = s;

                // 1. Hapus semua tag properti/formatting (aman dibuang)
                const PR = ['sSupPr','sSubPr','radPr','fPr','dPr','naryPr',
                            'funcPr','rPr','ctrlPr','accPr','groupChrPr',
                            'borderBoxPr','barPr','eqArrPr','sSubSupPr',
                            'limLowPr','phant','oMathParaPr'];
                for (const p of PR) {
                    s = s.replace(new RegExp(`<m:${p}[^>]*>[\\s\\S]*?<\\/m:${p}>`, 'g'), '');
                    s = s.replace(new RegExp(`<m:${p}[^>]*\\/>`, 'g'), '');
                }
                s = s.replace(/<w:(?:rPr|pPr|tblPr|trPr|tcPr|sectPr)[^>]*>[\s\S]*?<\/w:(?:rPr|pPr|tblPr|trPr|tcPr|sectPr)>/g, '');

                // 2. Teks daun: m:t dan w:t → teks biasa
                s = s.replace(/<(?:m|w):t[^>]*>([^<]*)<\/(?:m|w):t>/g, '$1');

                // 3. m:r (run) yang hanya berisi teks → kontennya
                s = s.replace(/<m:r[^>]*>([^<]*)<\/m:r>/g, '$1');
                s = s.replace(/<w:r[^>]*>([^<]*)<\/w:r>/g, '$1');

                // 4. Bungkus konten elemen struktural dengan penanda sementara
                //    agar bisa diproses di langkah berikutnya tanpa konflik
                // \u0001 = m:e (base/element)
                s = s.replace(/<m:e[^>]*>([^<]*)<\/m:e>/g, '\u0001$1\u0001');
                // \u0004 = m:sup
                s = s.replace(/<m:sup[^>]*>([^<]*)<\/m:sup>/g, '\u0004$1\u0004');
                // \u0005 = m:sub
                s = s.replace(/<m:sub[^>]*>([^<]*)<\/m:sub>/g, '\u0005$1\u0005');
                // \u0002 = m:num
                s = s.replace(/<m:num[^>]*>([^<]*)<\/m:num>/g, '\u0002$1\u0002');
                // \u0003 = m:den
                s = s.replace(/<m:den[^>]*>([^<]*)<\/m:den>/g, '\u0003$1\u0003');
                // \u0006 = m:deg (degree of root)
                s = s.replace(/<m:deg[^>]*>([^<]*)<\/m:deg>/g, '\u0006$1\u0006');
                s = s.replace(/<m:deg[^>]*\/>/g, '\u0006\u0006'); // self-closing = akar kuadrat

                // 5. m:sSup → BASE² (superscript)
                s = s.replace(
                    /<m:sSup[^>]*>\s*\u0001([^\u0001]*)\u0001\s*\u0004([^\u0004]*)\u0004\s*<\/m:sSup>/g,
                    (_, base, exp) => {
                        const b = base.trim(), e = exp.trim();
                        return b + (SUP[e] || (e ? '^' + e : ''));
                    }
                );

                // 6. m:sSub → BASEₙ (subscript)
                s = s.replace(
                    /<m:sSub[^>]*>\s*\u0001([^\u0001]*)\u0001\s*\u0005([^\u0005]*)\u0005\s*<\/m:sSub>/g,
                    (_, base, sub) => {
                        const b = base.trim(), sb = sub.trim();
                        return b + (SUB[sb] || (sb ? '_' + sb : ''));
                    }
                );

                // 7. m:rad → √CONTENT atau N√CONTENT (akar pangkat)
                s = s.replace(
                    /<m:rad[^>]*>\s*\u0006([^\u0006]*)\u0006\s*\u0001([^\u0001]*)\u0001\s*<\/m:rad>/g,
                    (_, deg, content) => {
                        const d = deg.trim(), c = content.trim();
                        return (d ? d + '√' : '√') + c;
                    }
                );

                // 8. m:f → NUM/DEN (pecahan)
                s = s.replace(
                    /<m:f[^>]*>\s*\u0002([^\u0002]*)\u0002\s*\u0003([^\u0003]*)\u0003\s*<\/m:f>/g,
                    (_, num, den) => `${num.trim()}/${den.trim()}`
                );

                // 9. m:d → (CONTENT) (delimiter/kurung)
                s = s.replace(
                    /<m:d[^>]*>\s*\u0001([^\u0001]*)\u0001\s*<\/m:d>/g,
                    (_, c) => `(${c.trim()})`
                );

                // 10. Kembalikan penanda sementara yang belum terproses
                s = s.replace(/\u0001([^\u0001]*)\u0001/g, '$1');
                s = s.replace(/\u0002([^\u0002]*)\u0002/g, '$1');
                s = s.replace(/\u0003([^\u0003]*)\u0003/g, '$1');
                s = s.replace(/\u0004([^\u0004]*)\u0004/g, '$1');
                s = s.replace(/\u0005([^\u0005]*)\u0005/g, '$1');
                s = s.replace(/\u0006([^\u0006]*)\u0006/g, '$1');

                // 11. Bersihkan sisa tag OMML/OOXML yang hanya berisi teks
                s = s.replace(/<m:[a-zA-Z]+[^>]*>([^<]*)<\/m:[a-zA-Z]+>/g, '$1');
                s = s.replace(/<w:[a-zA-Z]+[^>]*>([^<]*)<\/w:[a-zA-Z]+>/g, '$1');

                if (s === prev) break;
            }

            // Bersihkan sisa tag XML dan normalkan spasi
            return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // ── Baca word/document.xml menggunakan JSZip (dependensi mammoth) ──
        let xmlRows = null;
        try {
            const JSZip = require('jszip');
            const buf   = fs.readFileSync(filePath);
            const zip   = await JSZip.loadAsync(buf);
            const xmlFile = zip.file('word/document.xml');
            if (xmlFile) {
                const xml = await xmlFile.async('string');

                // Ekstrak baris tabel (w:tr) dan sel (w:tc)
                // Gunakan split manual agar aman dari nested table
                const rows = [];
                let pos = 0;
                while (pos < xml.length) {
                    const trStart = xml.indexOf('<w:tr', pos);
                    if (trStart === -1) break;
                    const trEnd = xml.indexOf('</w:tr>', trStart);
                    if (trEnd === -1) break;
                    const trXml = xml.slice(trStart, trEnd + 7);

                    const cells = [];
                    let tPos = 0;
                    while (tPos < trXml.length) {
                        const tcStart = trXml.indexOf('<w:tc', tPos);
                        if (tcStart === -1) break;
                        const tcEnd = trXml.indexOf('</w:tc>', tcStart);
                        if (tcEnd === -1) break;
                        const tcXml = trXml.slice(tcStart, tcEnd + 7);
                        cells.push(ommlToText(tcXml));
                        tPos = tcEnd + 7;
                    }
                    if (cells.length > 0) rows.push(cells);
                    pos = trEnd + 7;
                }
                if (rows.length > 0) xmlRows = rows;
            }
        } catch(e) { /* JSZip tidak tersedia — lanjut ke fallback */ }

        // ── Fallback: mammoth HTML (jika JSZip tidak ada) ──
        if (!xmlRows) {
            const mResult = await mammoth.convertToHtml({path: filePath});
            const html    = mResult.value;
            const tableM  = html.match(/<table[\s\S]*?>([\s\S]*?)<\/table>/i);
            if (!tableM) {
                const raw = await mammoth.extractRawText({path: filePath});
                fs.existsSync(filePath) && fs.unlinkSync(filePath);
                return res.json({status: "no_table", text_mentah: raw.value});
            }
            const trRaw = tableM[1].match(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi) || [];
            xmlRows = trRaw.map(tr =>
                (tr.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []).map(tc =>
                    tc.replace(/<img[^>]*>/gi,'').replace(/<[^>]+>/g,'')
                      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim()
                )
            ).filter(r => r.some(c => c));
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (!xmlRows || xmlRows.length < 2)
            return res.json({status: "error", message: "Tabel tidak ditemukan atau kosong."});

        // ── Peta kolom dari header ──
        const headers = xmlRows[0].map(h => h.toLowerCase().replace(/\s+/g,'_'));
        const col  = n => headers.indexOf(n);
        const idxMap = {
            tipe:col('tipe'), tanya:col('pertanyaan'), gambar:col('link_gambar'),
            a:col('opsi_a'), b:col('opsi_b'), c:col('opsi_c'),
            d:col('opsi_d'), e:col('opsi_e'),
            kunci:col('kunci'), skor:col('skor'),
        };
        if (idxMap.tanya < 0)
            return res.json({status:"error", message:"Kolom 'Pertanyaan' tidak ditemukan di header tabel."});

        const getC = (row, i) => i >= 0 && i < row.length ? (row[i]||'').trim() : '';
        const questions = [];

        for (let r = 1; r < xmlRows.length; r++) {
            const row  = xmlRows[r];
            const tipe = (getC(row, idxMap.tipe)||'PG').toUpperCase();
            const tanya = getC(row, idxMap.tanya).replace(/\s+/g,' ').trim();
            if (!tanya || tanya.toLowerCase() === 'pertanyaan') continue;

            const opsiA=getC(row,idxMap.a), opsiB=getC(row,idxMap.b),
                  opsiC=getC(row,idxMap.c), opsiD=getC(row,idxMap.d), opsiE=getC(row,idxMap.e);
            const kunci  = getC(row, idxMap.kunci).toUpperCase();
            const skor   = parseFloat((getC(row,idxMap.skor)||'1').replace(',','.')) || 1;
            const gambar = getC(row, idxMap.gambar);

            let opsi_json = '', kunciFinal = kunci;
            if (tipe === 'PG' || tipe === 'PGK') {
                opsi_json = [opsiA,opsiB,opsiC,opsiD,opsiE].filter(o=>o).join('|||');
            } else if (tipe === 'BS') {
                const opts = [opsiA,opsiB,opsiC].filter(o=>o);
                opsi_json  = opts.length ? opts.join('|||') : 'B|||S';
                const bsMap = {B:'A',S:'B',BENAR:'A',SALAH:'B'};
                kunciFinal  = kunci.split(',').map(k=>bsMap[k.trim()]||k).join('-');
            }

            questions.push({exam_id:examId, tipe, tanya, opsi_json,
                            kunci:kunciFinal, media_path:gambar, skor, gform_url:''});
        }

        res.json({status:"success", questions, total:questions.length});

    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({status:"error", message:"Gagal memproses Word: " + err.message});
    }
});


// ==========================================
// 7. MANAJEMEN PENGGUNA 
// ==========================================
app.get('/api/admin/users', async (req, res) => { const { data } = await supabase.from('users').select('*').order('id', {ascending: false}); res.json(data || []); });
app.post('/api/admin/add-user', async (req, res) => { await supabase.from('users').insert([req.body]); res.json({status: "success"}); });
app.put('/api/admin/update-user', async (req, res) => { await supabase.from('users').update({ name: req.body.name, username: req.body.username, password: req.body.password, role: req.body.role, kelas: req.body.kelas, mapel: req.body.mapel }).eq('username', req.body.old_username); res.json({status: "success"}); });
app.delete('/api/admin/delete-user/:username', async (req, res) => { await supabase.from('users').delete().eq('username', req.params.username); res.json({status: "success"}); });
app.delete('/api/admin/clear-users', async (req, res) => { try { await supabase.from('users').delete().neq('role', 'admin'); res.json({status: "success"}); } catch(err) { res.json({status: "error"}); } });

// ==========================================
// 8. IMPORT USER MASAL
// ==========================================
app.post('/api/admin/import-users', async (req, res) => {
    try {
        const { data } = req.body;
        if(!data || !data.length) return res.json({status: "error", message: "Data kosong"});

        const toProcess = data.map(row => ({
            username: String(row.username || '').trim(),
            name: String(row.nama || row.name || '').trim(),
            password: String(row.password || row.pass || '').trim(),
            role: '',
            kelas: String(row.kelas || '').trim(),
            mapel: String(row.mapel || row.mapel_kelas || row.mapelkelas || '').trim(),
            _role: String(row.role || '').toLowerCase().trim()
        })).map(r => { r.role = r._role || (r.mapel && !r.kelas ? 'guru' : 'siswa'); delete r._role; if (r.role === 'guru') r.kelas = ''; return r; }).filter(r => r.username && r.password);

        if(toProcess.length === 0) return res.json({status: "error", message: "Data tidak valid."});

        const { data: existingUsers } = await supabase.from('users').select('username');
        const existingUsernames = new Set((existingUsers || []).map(u => u.username));
        const toInsert = []; const toUpdate = [];

        toProcess.forEach(user => {
            if (existingUsernames.has(user.username)) toUpdate.push(user);
            else toInsert.push(user);
        });

        if (toInsert.length > 0) await supabase.from('users').insert(toInsert);
        if (toUpdate.length > 0) {
            for (const user of toUpdate) {
                await supabase.from('users').update({ name: user.name, password: user.password, role: user.role, kelas: user.kelas, mapel: user.mapel }).eq('username', user.username);
            }
        }
        res.json({status: "success", imported: toProcess.length});
    } catch (err) { res.json({status: "error", message: err.message}); }
});

module.exports = app;