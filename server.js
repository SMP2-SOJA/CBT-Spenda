const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const mammoth = require('mammoth'); 
const { createClient } = require('@supabase/supabase-js');

// ==========================================
// KONFIGURASI SUPABASE (CBT SMPN 2 SOYO JAYA)
// ==========================================
const supabaseUrl = 'https://uftiednbhdmexxlabhad.supabase.co';
const supabaseKey = 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// PERBAIKAN VERCEL (MENGGUNAKAN FOLDER /tmp)
// ==========================================
const upload = multer({ dest: '/tmp' });

// Filter Akses Guru
function isAuthorizedMapel(reqMapelStr, examName) {
    if (!reqMapelStr) return false;
    const guruMapels = reqMapelStr.split(',').map(m => m.trim().toUpperCase());
    return guruMapels.includes(examName.trim().toUpperCase());
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single();
    if (data) res.json({ status: "success", user: data });
    else res.status(401).json({ status: "error", message: "Username atau Password Salah!" });
});

app.get('/api/admin/config', async (req, res) => {
    const { data } = await supabase.from('config').select('*');
    res.json(data || []);
});

app.post('/api/admin/update-config', async (req, res) => {
    await supabase.from('config').update({ value: req.body.app_name }).eq('key', 'app_name');
    res.json({status:"success"});
});

app.get('/api/admin/questions', async (req, res) => {
    let { data } = await supabase.from('questions').select('*').order('id', { ascending: false });
    if (req.query.role === 'guru') data = (data || []).filter(q => isAuthorizedMapel(req.query.mapel, q.exam_id));
    res.json(data || []);
});

app.get('/api/admin/available-exams', async (req, res) => {
    let { data } = await supabase.from('questions').select('exam_id');
    let exams = [...new Set((data || []).map(r => r.exam_id))];
    if (req.query.role === 'guru') exams = exams.filter(e => isAuthorizedMapel(req.query.mapel, e));
    res.json(exams);
});

app.delete('/api/admin/delete-soal/:id', async (req, res) => {
    const { data: soal } = await supabase.from('questions').select('exam_id').eq('id', req.params.id).single();
    if (soal) {
        const examId = soal.exam_id;
        await supabase.from('questions').delete().eq('id', req.params.id);
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam_id', examId);
        if (count === 0) await supabase.from('schedules').delete().eq('mapel', examId);
        res.json({status: "success"});
    } else {
        res.json({status: "error", message: "Soal tidak ditemui"});
    }
});

// SIMPAN SOAL BERUNTUN SEKALIGUS (BULK INSERT)
app.post('/api/admin/add-soal-bulk', async (req, res) => {
    const { questions } = req.body;
    if (!questions || questions.length === 0) return res.status(400).json({status: "error", message: "Data kosong"});

    const { data, error } = await supabase.from('questions').insert(questions);
    if (error) return res.status(500).json({status: "error", message: error.message});
    res.json({ status: "success" });
});

// Import Word (Memakai path /tmp dari Multer)
app.post('/api/admin/import-word', upload.single('file_word'), async (req, res) => {
    try {
        const exam_id = req.body.exam_id;
        if(!exam_id) return res.status(400).json({status: "error", message: "KODE UJIAN harus diisi!"});
        const result = await mammoth.convertToHtml({path: req.file.path});
        const rows = result.value.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
        if (!rows || rows.length < 2) return res.status(400).json({status: "error", message: "Tabel tidak ditemui di Word."});
        
        let insertData = [];
        for(let i = 1; i < rows.length; i++) {
            const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
            if (cells && cells.length >= 2) {
                const textCells = cells.map(c => c.replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim());
                const tipe = (textCells[0] || 'PG').toUpperCase(); const tanya = textCells[1] || '';
                let opsi = [textCells[2], textCells[3], textCells[4], textCells[5]].filter(Boolean);
                if (tanya !== '') insertData.push({ exam_id, tipe, tanya, opsi_json: opsi.join(','), kunci: textCells[6] || '' });
            }
        }
        if(insertData.length > 0) await supabase.from('questions').insert(insertData);
        res.json({status: 'success', message: `${insertData.length} Soal berjaya diekstrak dari Jadual Word!`});
    } catch (e) { res.status(500).json({status: 'error', message: 'Gagal memproses fail Word.'}); }
});

// Import Excel (Memakai path /tmp dari Multer)
app.post('/api/admin/import-soal', upload.single('file_excel'), async (req, res) => {
    try {
        const exam_id = req.body.exam_id;
        if(!exam_id) return res.status(400).json({status: "error", message: "KODE UJIAN harus diisi!"});
        const workbook = XLSX.readFile(req.file.path);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        let insertData = data.map(row => {
            let opsi = [row.Opsi_A, row.Opsi_B, row.Opsi_C, row.Opsi_D, row.Opsi_E].filter(Boolean).map(String);
            return { exam_id, tipe: (row.Tipe || 'PG').toUpperCase(), tanya: row.Pertanyaan || '', opsi_json: opsi.join(','), kunci: row.Kunci ? String(row.Kunci).trim() : '' };
        });
        
        if(insertData.length > 0) await supabase.from('questions').insert(insertData);
        res.json({ status: "success", message: `${insertData.length} Soal CBT berjaya di-generate!` });
    } catch(e) { res.status(500).json({status: "error", message: "Gagal membaca Excel"}); }
});

app.post('/api/admin/add-schedule', async (req, res) => {
    const { mapel, tanggal, durasi } = req.body;
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from('schedules').insert([{ mapel, tanggal, durasi, pin, status: 'Aktif' }]);
    res.json({ status: "success", pin: pin });
});

app.get('/api/admin/schedules', async (req, res) => {
    let { data } = await supabase.from('schedules').select('*').order('id', { ascending: false });
    if (req.query.role === 'guru') data = (data || []).filter(s => isAuthorizedMapel(req.query.mapel, s.mapel));
    res.json(data || []);
});

app.delete('/api/admin/clear-schedules', async (req, res) => {
    await supabase.from('schedules').delete().neq('id', 0); 
    res.json({status: "success"});
});

app.delete('/api/admin/clear-results', async (req, res) => {
    await supabase.from('results').delete().neq('id', 0);
    await supabase.from('activity').delete().neq('id', 0);
    res.json({status: "success"});
});

app.get('/api/admin/stats', async (req, res) => {
    const stats = { total_siswa: 0, sedang_kerja: 0, selesai: 0, curang: 0 };
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).ilike('role', 'siswa');
    stats.total_siswa = count || 0;

    let { data: acts } = await supabase.from('activity').select('*');
    if (req.query.role === 'guru') acts = (acts || []).filter(a => isAuthorizedMapel(req.query.mapel, a.exam_name));
    
    (acts || []).forEach(a => {
        if (a.status === 'Mengerjakan') stats.sedang_kerja++;
        else if (a.status === 'Selesai') stats.selesai++;
        else if (a.status === 'Curang') stats.curang++;
    });
    res.json(stats);
});

app.get('/api/admin/recent-activity', async (req, res) => {
    let { data } = await supabase.from('activity').select('*').order('id', { ascending: false });
    if (req.query.role === 'guru') data = (data || []).filter(a => isAuthorizedMapel(req.query.mapel, a.exam_name));
    res.json((data || []).slice(0, 20));
});

app.get('/api/admin/users', async (req, res) => {
    const { data } = await supabase.from('users').select('*').neq('role', 'admin').neq('role', 'Admin');
    res.json(data || []);
});

app.post('/api/admin/import-users', upload.single('file_excel'), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path); const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let insertData = excelData.map(row => ({
            name: row.Nama, username: row.Username, password: row.Password, role: row.Role || 'siswa', kelas: row.Kelas, mapel: row.Mapel || ''
        }));
        if(insertData.length > 0) await supabase.from('users').insert(insertData);
        res.json({ status: "success", message: `${insertData.length} Peserta berjaya diimport!` });
    } catch(e) { res.status(500).json({status: "error", message: "Gagal membaca Excel"}); }
});

app.get('/api/admin/results', async (req, res) => {
    let { data } = await supabase.from('results').select('*').order('id', { ascending: false });
    if (req.query.role === 'guru') data = (data || []).filter(r => isAuthorizedMapel(req.query.mapel, r.mapel));
    res.json(data || []);
});

app.post('/api/siswa/cek-pin', async (req, res) => {
    const { pin, student_name } = req.body;
    const { data: row } = await supabase.from('schedules').select('*').eq('pin', pin).eq('status', 'Aktif').single();
    if(row) {
        const time = new Date().toLocaleTimeString('id-ID'); 
        await supabase.from('activity').insert([{ student_name, exam_name: row.mapel, status: 'Mengerjakan', last_seen: time }]);
        res.json({status: "success", exam: row});
    } else { 
        res.status(404).json({status: "error", message: "PIN Tidak Sah atau Ujian Belum Aktif!"}); 
    }
});

app.post('/api/siswa/get-soal', async (req, res) => {
    const { data } = await supabase.from('questions').select('id, tipe, tanya, opsi_json, kunci, media_path, gform_url').eq('exam_id', req.body.exam_id);
    res.json({status: "success", questions: data || []});
});

app.post('/api/siswa/submit', async (req, res) => {
    const { student_name, mapel, nilai, benar, salah, detail_jawaban, is_curang } = req.body; 
    const time = new Date().toLocaleTimeString('id-ID'); 
    
    await supabase.from('results').insert([{ student_name, mapel, nilai, benar, salah, detail_jawaban, tanggal: new Date().toLocaleDateString('id-ID') }]); 
    
    const finalStatus = is_curang ? 'Curang' : 'Selesai';
    await supabase.from('activity').update({ status: finalStatus, score: nilai, last_seen: time }).eq('student_name', student_name).eq('exam_name', mapel).eq('status', 'Mengerjakan'); 
    
    res.json({status: "success"});
});

app.post('/api/siswa/flag-curang', async (req, res) => {
    const { student_name, mapel } = req.body;
    await supabase.from('activity').update({ status: 'Curang', last_seen: new Date().toLocaleTimeString('id-ID') }).eq('student_name', student_name).eq('exam_name', mapel); 
    res.json({status: "success"});
});

// ==========================================
// EXPORT UNTUK VERCEL (WAJIB)
// ==========================================
// --- TAMBAHKAN KODE INI ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// -------------------------

// EXPORT UNTUK VERCEL (WAJIB)
module.exports = app;