const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const XLSX = require('xlsx');
const mammoth = require('mammoth');
const fs = require('fs');

// ================================================================
// LISENSI & IDENTITAS PEMBELI
// Kode ini dihasilkan otomatis untuk setiap pembeli.
// Menghapus bagian ini melanggar ketentuan lisensi.
// ================================================================
const _lic = {
  c: Buffer.from('U1BFTkRBLURJR0ktMjAyNg==','base64').toString(),
  b: Buffer.from('UEVNIEJFTUJFTEK=','base64').toString(),
  v: '2026.1',
  _: () => { const d=new Date(); return [d.getFullYear(),d.getMonth()+1].join('.'); }
};
const _chk = () => _lic.c + ' | ' + _lic.b + ' | v' + _lic.v;

// ================================================================
// DATA DEMO (in-memory, tidak menyentuh database asli)
// ================================================================
const DEMO_USER = { id:0, username:'demo', name:'Demo Sekolah', role:'admin', kelas:'', mapel:'', _isDemo:true };
const DEMO_DATA = {
  users: [
    {id:1,username:'siswa01',name:'Andi Pratama',role:'siswa',kelas:'7A',mapel:''},
    {id:2,username:'siswa02',name:'Budi Santoso',role:'siswa',kelas:'7A',mapel:''},
    {id:3,username:'siswa03',name:'Citra Dewi',role:'siswa',kelas:'7B',mapel:''},
    {id:4,username:'guru01',name:'Pak Budi (MTK)',role:'guru',kelas:'',mapel:'MTK'},
  ],
  questions: [
    {id:1,exam_id:'MTK-7A-DEMO',tipe:'PG',tanya:'Berapakah hasil dari 5 × 8?',opsi_json:'30|||35|||40|||45',kunci:'C',skor:2},
    {id:2,exam_id:'MTK-7A-DEMO',tipe:'PG',tanya:'Ibukota Indonesia adalah...',opsi_json:'Bandung|||Jakarta|||Surabaya|||Medan',kunci:'B',skor:1},
    {id:3,exam_id:'MTK-7A-DEMO',tipe:'ISIAN',tanya:'Hasil dari 12 + 8 = ...',opsi_json:'',kunci:'20',skor:2},
  ],
  schedules: [
    {id:1,mapel:'MTK-7A-DEMO',pin:'1234',tanggal:'2026-05-26|08:00',durasi:60,status:'Aktif',kelas:'7A'},
  ],
  activity: [
    {id:1,student_name:'Andi Pratama',exam_name:'MTK-7A-DEMO',kelas:'7A',status:'Mengerjakan',score:40,last_seen:'08:15:22 (35 mnt)'},
    {id:2,student_name:'Budi Santoso',exam_name:'MTK-7A-DEMO',kelas:'7A',status:'Selesai',score:80,last_seen:'08:55:10 (55 mnt)'},
    {id:3,student_name:'Citra Dewi',exam_name:'MTK-7A-DEMO',kelas:'7B',status:'Curang (1x)',score:30,last_seen:'08:20:05 (20 mnt)'},
  ],
  results: [
    {id:1,student_name:'Budi Santoso',mapel:'MTK-7A-DEMO',kelas:'7A',nilai:80,benar:4,salah:1,detail_jawaban:'[]',tanggal:'26/5/2026|55 mnt'},
    {id:2,student_name:'Citra Dewi',mapel:'MTK-7A-DEMO',kelas:'7B',nilai:40,benar:2,salah:3,detail_jawaban:'[]',tanggal:'26/5/2026|20 mnt'},
  ],
  exams: ['MTK-7A-DEMO'],
};

const upload = multer({ dest: '/tmp' }); // Folder penyimpanan sementara Vercel
const supabaseUrl = 'https://uftiednbhdmexxlabhad.supabase.co';
const supabaseKey = 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware: copyright header di setiap response
app.use((req, res, next) => {
    res.setHeader('X-App-License', _chk());
    res.setHeader('X-Powered-By', 'SPENDA-DIGI-CBT');
    next();
});

// =======================================
// DEMO MODE ENDPOINTS (memisah dari DB asli)
// =======================================
app.get('/api/demo/data', (req, res) => res.json(DEMO_DATA));
app.get('/api/demo/ping', (req, res) => res.json({status:'ok', mode:'DEMO', license: _chk()}));

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
        // DEMO MODE: kredensial khusus, tidak menyentuh DB asli
        if (username === 'demo' && password === 'demo123') {
            return res.json({status: "success", user: DEMO_USER});
        }
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
        const { data, error } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif');
        if (error || !data || data.length === 0) return res.json({status: "error", message: "PIN Salah atau Ujian telah ditutup!"});
        
        let allMapels = [];
        data.forEach(d => { if(d.mapel) d.mapel.split(',').forEach(m => { if(m.trim()) allMapels.push(m.trim()); }); });

        // CEK APAKAH SISWA SEDANG DIBLOKIR
        if (student_name) {
            const { data: actData } = await supabase.from('activity').select('status').eq('student_name', student_name).in('exam_name', allMapels);
            if (actData && actData.length > 0) {
                const isBlocked = actData.some(a => a.status && a.status.includes('Curang'));
                if (isBlocked) {
                    return res.json({status: "error", message: "Akses Ditolak! Layar Anda terkunci karena pelanggaran. Lapor ke pengawas untuk Buka Akses."});
                }
            }
        }

        if (!kelas || String(kelas).trim() === '') {
            const totalDurasi = data.reduce((sum, d) => sum + parseInt(d.durasi || 0), 0);
            return res.json({ status: "success", exam: { mapel: allMapels.join(', '), durasi: totalDurasi } });
        }

        // LOGIKA KETAT SENSOR KELAS SMP
        const cleanKelas = String(kelas).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let cocokKelas = allMapels.filter(m => m.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(cleanKelas));

        let mapelGabungan = "";
        if (cocokKelas.length > 0) {
            mapelGabungan = cocokKelas.join(', ');
        } else {
            const isUmum = allMapels.every(m => !/(7|8|9|vii|viii|ix)/i.test(m.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()));
            if (isUmum) {
                mapelGabungan = allMapels.join(', ');
            } else {
                return res.json({status: "error", message: `Akses ditolak! Paket soal untuk kelas ${kelas} tidak tersedia pada PIN ini.`});
            }
        }

        const totalDurasi = data.reduce((sum, d) => sum + parseInt(d.durasi || 0), 0);
        res.json({ status: "success", exam: { mapel: mapelGabungan, durasi: totalDurasi } });
    } catch (err) { res.json({status: "error", message: "Gagal menyortir soal: " + err.message}); }
});

app.post('/api/siswa/get-soal', async (req, res) => { 
    try {
        const { exam_id } = req.body; 
        if (!exam_id) return res.json({ questions: [] });
        const mapelArray = exam_id.split(',').map(m => m.trim());
        const { data, error } = await supabase.from('questions').select('*').in('exam_id', mapelArray); 
        if (error) throw error;
        res.json({ questions: data || [] }); 
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 3. AKTIVITAS & REKAP (BYPASS SUPABASE)
// ==========================================
app.post('/api/siswa/ping', async (req, res) => { 
    const lstText = new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')'; 
    const payload = { student_name: req.body.student_name, exam_name: req.body.mapel, status: 'Mengerjakan', score: req.body.live_score, last_seen: lstText };
    const { error } = await supabase.from('activity').upsert({ ...payload, kelas: req.body.kelas || '-' }, {onConflict: 'student_name,exam_name'}); 
    if (error) await supabase.from('activity').upsert(payload, {onConflict: 'student_name,exam_name'}); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/submit', async (req, res) => { 
    const tglDB = new Date().toLocaleDateString('id-ID') + '|' + (req.body.durasi || '-');
    await supabase.from('results').insert([{ student_name: req.body.student_name, mapel: req.body.mapel, nilai: req.body.nilai, benar: req.body.benar, salah: req.body.salah, detail_jawaban: req.body.detail_jawaban, tanggal: tglDB }]); 
    await supabase.from('activity').update({ status: 'Selesai', score: req.body.nilai, last_seen: new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')' }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/flag-curang', async (req, res) => { 
    const statusText = req.body.count >= 3 ? `Curang (Terkunci)` : `Curang (${req.body.count}x)`;
    await supabase.from('activity').update({ status: statusText }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel); 
    res.json({status: "success"}); 
});

// ==========================================
// 4. PANEL DASHBOARD 
// ==========================================
app.get('/api/admin/stats', async (req, res) => {
    const { count: cSiswa } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'siswa');
    const { count: cGuru } = await supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'guru');
    res.json({total_siswa: cSiswa||0, total_guru: cGuru||0});
});

app.get('/api/admin/recent-activity', async (req, res) => { const { data } = await supabase.from('activity').select('*').order('last_seen', {ascending: false}); res.json(data || []); });
app.get('/api/admin/results', async (req, res) => { const { data } = await supabase.from('results').select('*').order('id', {ascending: false}); res.json(data || []); });

app.post('/api/admin/reset-siswa', async (req, res) => {
    await supabase.from('activity').delete().eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel);
    res.json({status: "success"});
});
app.delete('/api/admin/remove-activity/:id', async (req, res) => { await supabase.from('activity').delete().eq('id', req.params.id); res.json({status: "success"}); });
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
// 6. REPOSITORI BANK SOAL (DENGAN EXCEL & WORD)
// ==========================================
app.get('/api/admin/available-exams', async (req, res) => {
    const { data } = await supabase.from('questions').select('exam_id');
    const exams = [...new Set((data || []).map(q => q.exam_id))];
    res.json(exams);
});
app.get('/api/admin/questions', async (req, res) => { const { data } = await supabase.from('questions').select('*').order('id', {ascending: true}); res.json(data || []); });
app.post('/api/admin/add-soal-bulk', async (req, res) => { await supabase.from('questions').insert(req.body.questions); res.json({status: "success"}); });
app.delete('/api/admin/delete-question/:id', async (req, res) => { await supabase.from('questions').delete().eq('id', req.params.id); res.json({status: "success"}); });
app.delete('/api/admin/delete-exam/:exam_id', async (req, res) => { await supabase.from('questions').delete().eq('exam_id', req.params.exam_id); res.json({status: "success"}); });
app.delete('/api/admin/clear-questions', async (req, res) => { await supabase.from('questions').delete().neq('id', 0); res.json({status: "success"}); });

app.post('/api/admin/upload-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.json({status: "error", message: "File kosong!"});
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        const { error } = await supabase.from('questions').insert(data);
        if (error) throw error;
        fs.unlinkSync(req.file.path);
        res.json({status: "success", message: "Soal Excel berhasil digenerate!"});
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({status: "error", message: "Gagal memproses Excel: " + err.message});
    }
});

app.post('/api/admin/upload-word', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.json({status: "error", message: "File kosong!"});
        const result = await mammoth.extractRawText({path: req.file.path});
        const text = result.value;
        fs.unlinkSync(req.file.path);
        res.json({status: "success", text_mentah: text});
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({status: "error", message: "Gagal memproses Word: " + err.message});
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
            role: String(row.role || 'siswa').toLowerCase().trim(),
            kelas: String(row.kelas || '').trim(),
            mapel: String(row.mapel || '').trim()
        })).filter(r => r.username && r.password);

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