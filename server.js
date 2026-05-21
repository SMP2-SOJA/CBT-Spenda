const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uftiednbhdmexxlabhad.supabase.co';
const supabaseKey = 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// 1. OTENTIKASI & LOGIN
// ==========================================
app.post('/api/login', async (req, res) => { 
    const { username, password } = req.body; 
    const { data } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single(); 
    if (!data) return res.status(401).json({status: "error", message: "Username atau Password salah!"}); 
    res.json({status: "success", user: data}); 
});

// ==========================================
// 2. SISTEM MULTI-MAPEL DENGAN SENSOR KELAS (1 PIN BEDA SOAL GURU)
// ==========================================
app.post('/api/siswa/cek-pin', async (req, res) => {
    const { pin, kelas } = req.body; // Sekarang menerima data kelas dari siswa yang login
    const { data, error } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif');
    
    if (error || !data || data.length === 0) {
        return res.json({status: "error", message: "PIN Salah atau Ujian telah ditutup!"});
    }
    
    // 1. Kumpulkan semua kode bank soal yang ada di dalam PIN jadwal ini
    let allMapels = [];
    data.forEach(d => {
        if(d.mapel) {
            d.mapel.split(',').forEach(m => {
                if(m.trim()) allMapels.push(m.trim());
            });
        }
    });

    // 2. SENSOR KELAS OTOMATIS (Mencocokkan nama paket soal dengan kelas siswa)
    // Misal kelas siswa "7A", dibersihkan jadi "7a"
    const cleanKelas = String(kelas || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    let cocokKelas = allMapels.filter(m => {
        // Misal kode bank soal "MTK-7A" atau "MTK7A-GURUA", dibersihkan jadi "mtk7a" atau "mtk7agurua"
        const cleanM = m.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanM.includes(cleanKelas); // Apakah nama bank soal mengandung tulisan kelas siswa?
    });

    // 3. Penentuan Akhir Paket Soal
    // Jika ditemukan paket soal yang spesifik sesuai kelas siswa, kunci paket itu saja.
    // Jika tidak ditemukan (misal ujian umum gabungan satu angkatan), berikan seluruh mapel di PIN tersebut (Fallback).
    const mapelGabungan = cocokKelas.length > 0 ? cocokKelas.join(', ') : allMapels.join(', ');
    const totalDurasi = data.reduce((sum, d) => sum + parseInt(d.durasi || 0), 0);
    
    res.json({ status: "success", exam: { mapel: mapelGabungan, durasi: totalDurasi } });
});

// ==========================================
// 3. AKTIVITAS & REKAP SUBMIT NILAI
// ==========================================
app.post('/api/siswa/ping', async (req, res) => { 
    const lstText = new Date().toLocaleTimeString('id-ID') + ' (' + req.body.durasi + ')'; 
    await supabase.from('activity').upsert({ student_name: req.body.student_name, exam_name: req.body.mapel, status: 'Mengerjakan', score: req.body.live_score, last_seen: lstText, kelas: req.body.kelas || '-' }, {onConflict: 'student_name,exam_name'}); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/submit', async (req, res) => { 
    const tglDB = new Date().toLocaleDateString('id-ID') + '|' + (req.body.durasi || '-');
    await supabase.from('results').insert([{ student_name: req.body.student_name, mapel: req.body.mapel, nilai: req.body.nilai, benar: req.body.benar, salah: req.body.salah, detail_jawaban: req.body.detail_jawaban, tanggal: tglDB }]); 
    await supabase.from('activity').update({ status: req.body.is_curang ? 'Curang (Terkunci)' : 'Selesai', score: req.body.nilai, last_seen: new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')' }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/flag-curang', async (req, res) => { 
    await supabase.from('activity').update({ status: `Curang (${req.body.count}x)` }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel); 
    res.json({status: "success"}); 
});

// ==========================================
// 4. PANEL DASHBOARD MONITORING & STATISTIK
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    const { count: cSiswa } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'siswa');
    const { count: cGuru } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'guru');
    res.json({total_siswa: cSiswa||0, total_guru: cGuru||0});
});

app.get('/api/admin/recent-activity', async (req, res) => { const { data } = await supabase.from('activity').select('*').order('last_seen', {ascending: false}); res.json(data); });
app.get('/api/admin/results', async (req, res) => { const { data } = await supabase.from('results').select('*').order('id', {ascending: false}); res.json(data); });
app.delete('/api/admin/clear-monitoring', async (req, res) => { await supabase.from('activity').delete().neq('id', 0); res.json({status:"success"}); });
app.delete('/api/admin/clear-results', async (req, res) => { await supabase.from('results').delete().neq('id', 0); res.json({status:"success"}); });

// ==========================================
// 5. MANAJEMEN JADWAL UJIAN
// ==========================================
app.get('/api/admin/schedules', async (req, res) => { const { data } = await supabase.from('schedules').select('*').order('id', {ascending: false}); res.json(data); });
app.post('/api/admin/add-schedule', async (req, res) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    await supabase.from('schedules').insert([{ mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: req.body.durasi, pin, status: 'Aktif' }]);
    res.json({status: "success"});
});
app.put('/api/admin/update-schedule', async (req, res) => { await supabase.from('schedules').update({ mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: req.body.durasi, status: req.body.status }).eq('id', req.body.id); res.json({status: "success"}); });
app.delete('/api/admin/delete-schedule/:id', async (req, res) => { await supabase.from('schedules').delete().eq('id', req.params.id); res.json({status: "success"}); });
app.delete('/api/admin/clear-schedules', async (req, res) => { await supabase.from('schedules').delete().neq('id', 0); res.json({status: "success"}); });

// ==========================================
// 6. REPOSITORI BANK SOAL
// ==========================================
app.get('/api/admin/available-exams', async (req, res) => {
    const { data } = await supabase.from('questions').select('exam_id');
    const exams = [...new Set(data.map(q => q.exam_id))];
    res.json(exams);
});
app.get('/api/admin/questions', async (req, res) => { const { data } = await supabase.from('questions').select('*').order('id', {ascending: true}); res.json(data); });
app.post('/api/admin/add-soal-bulk', async (req, res) => { await supabase.from('questions').insert(req.body.questions); res.json({status: "success"}); });
app.delete('/api/admin/delete-question/:id', async (req, res) => { await supabase.from('questions').delete().eq('id', req.params.id); res.json({status: "success"}); });
app.delete('/api/admin/delete-exam/:exam_id', async (req, res) => { await supabase.from('questions').delete().eq('exam_id', req.params.exam_id); res.json({status: "success"}); });
app.delete('/api/admin/clear-questions', async (req, res) => { await supabase.from('questions').delete().neq('id', 0); res.json({status: "success"}); });

// ==========================================
// 7. MANAJEMEN AKUN PENGGUNA MANUAl
// ==========================================
app.get('/api/admin/users', async (req, res) => { const { data } = await supabase.from('users').select('*').order('id', {ascending: false}); res.json(data); });
app.post('/api/admin/add-user', async (req, res) => { await supabase.from('users').insert([req.body]); res.json({status: "success"}); });
app.put('/api/admin/update-user', async (req, res) => { await supabase.from('users').update({ name: req.body.name, username: req.body.username, password: req.body.password, role: req.body.role, kelas: req.body.kelas, mapel: req.body.mapel }).eq('username', req.body.old_username); res.json({status: "success"}); });
app.delete('/api/admin/delete-user/:username', async (req, res) => { await supabase.from('users').delete().eq('username', req.params.username); res.json({status: "success"}); });
app.delete('/api/admin/clear-users', async (req, res) => { await supabase.from('users').delete().neq('id', 0); res.json({status: "success"}); });

// ==========================================
// 8. ENGINE IMPORT USER MASAL (CRASH-PROOF & ANTI CONFLICT)
// ==========================================
app.post('/api/admin/import-users', async (req, res) => {
    try {
        const { data } = req.body;
        if(!data || !data.length) return res.json({status: "error", message: "Data kosong dari klien"});

        // Pemetaan data mentah hasil pembacaan file Excel ke format tabel database
        const toProcess = data.map(row => ({
            username: String(row.username || '').trim(),
            name: String(row.nama || row.name || '').trim(),
            password: String(row.password || row.pass || '').trim(),
            role: String(row.role || 'siswa').toLowerCase().trim(),
            kelas: String(row.kelas || '').trim(),
            mapel: String(row.mapel || '').trim()
        })).filter(r => r.username && r.password);

        if(toProcess.length === 0) return res.json({status: "error", message: "Data tidak valid, pastikan kolom Username dan Password terisi."});

        // Tarik data semua akun yang sudah ada saat ini untuk dicocokkan demi menghindari error ganda
        const { data: existingUsers, error: fetchErr } = await supabase.from('users').select('username');
        if (fetchErr) throw new Error("Gagal membaca status database: " + fetchErr.message);
        
        const existingUsernames = new Set(existingUsers.map(u => u.username));
        
        const toInsert = [];
        const toUpdate = [];

        // Pemisahan otomatis: Akun baru dimasukkan ke Insert, akun lama dimasukkan ke Update
        toProcess.forEach(user => {
            if (existingUsernames.has(user.username)) {
                toUpdate.push(user);
            } else {
                toInsert.push(user);
            }
        });

        // Eksekusi penambahan massal untuk akun baru
        if (toInsert.length > 0) {
            const { error: insErr } = await supabase.from('users').insert(toInsert);
            if (insErr) throw new Error("Gagal menyimpan akun baru: " + insErr.message);
        }

        // Eksekusi pembaruan satu per satu untuk menjaga integritas data akun lama
        if (toUpdate.length > 0) {
            for (const user of toUpdate) {
                await supabase.from('users').update({
                    name: user.name,
                    password: user.password,
                    role: user.role,
                    kelas: user.kelas,
                    mapel: user.mapel
                }).eq('username', user.username);
            }
        }

        res.json({status: "success", imported: toProcess.length});

    } catch (err) {
        console.error("CRASH IMPORT SERVER:", err);
        res.json({status: "error", message: err.message || JSON.stringify(err)});
    }
});

module.exports = app;