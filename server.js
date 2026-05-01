const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const mammoth = require('mammoth'); 
const { createClient } = require('@supabase/supabase-js');
const path = require('path'); 

const supabaseUrl = 'https://uftiednbhdmexxlabhad.supabase.co';
const supabaseKey = 'sb_publishable_TAEkdHBM3n5nY-I4bm-zaA_C5y9sEwH';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
const upload = multer({ dest: '/tmp' });

function isAuthorizedMapel(reqMapelStr, examName) {
    if (!reqMapelStr || reqMapelStr.trim() === '') return true; 
    if (!examName) return false;
    const allowed = reqMapelStr.split(',').map(m => m.trim().toLowerCase());
    const exName = examName.trim().toLowerCase();
    return allowed.some(m => exName.includes(m) || m.includes(exName));
}

app.post('/api/login', async (req, res) => { const { username, password } = req.body; const { data } = await supabase.from('users').select('*').eq('username', username).eq('password', password).single(); if (data) res.json({ status: "success", user: data }); else res.status(401).json({ status: "error", message: "Username/Password Salah!" }); });
app.get('/api/admin/config', async (req, res) => { const { data } = await supabase.from('config').select('*'); res.json(data || []); });
app.post('/api/admin/update-config', async (req, res) => { await supabase.from('config').update({ value: req.body.app_name }).eq('key', 'app_name'); res.json({status:"success"}); });
app.get('/api/admin/questions', async (req, res) => { let { data } = await supabase.from('questions').select('*').order('id', { ascending: false }); if (req.query.role === 'guru') data = (data || []).filter(q => isAuthorizedMapel(req.query.mapel, q.exam_id)); res.json(data || []); });
app.get('/api/admin/available-exams', async (req, res) => { let { data } = await supabase.from('questions').select('exam_id'); let exams = [...new Set((data || []).map(r => r.exam_id))]; if (req.query.role === 'guru') exams = exams.filter(e => isAuthorizedMapel(req.query.mapel, e)); res.json(exams); });

app.delete('/api/admin/delete-soal/:id', async (req, res) => { const { data: soal } = await supabase.from('questions').select('exam_id').eq('id', req.params.id).single(); if (soal) { await supabase.from('questions').delete().eq('id', req.params.id); const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam_id', soal.exam_id); if (count === 0) await supabase.from('schedules').delete().eq('mapel', soal.exam_id); res.json({status: "success"}); } else { res.json({status: "error"}); } });

app.delete('/api/admin/clear-questions', async (req, res) => { await supabase.from('questions').delete().neq('id', 0); res.json({status: "success"}); });
app.delete('/api/admin/clear-schedules', async (req, res) => { await supabase.from('schedules').delete().neq('id', 0); res.json({status: "success"}); });
app.delete('/api/admin/clear-results', async (req, res) => { await supabase.from('results').delete().neq('id', 0); await supabase.from('activity').delete().neq('id', 0); res.json({status: "success"}); });
app.delete('/api/admin/clear-users', async (req, res) => { await supabase.from('users').delete().neq('role', 'admin').neq('role', 'Admin'); res.json({status: "success"}); });
app.delete('/api/admin/clear-monitoring', async (req, res) => { await supabase.from('activity').delete().neq('id', 0); res.json({status: "success"}); });

app.delete('/api/admin/delete-user/:username', async (req, res) => { await supabase.from('users').delete().eq('username', req.params.username); res.json({status: "success"}); });
app.put('/api/admin/update-user', async (req, res) => { const { old_username, name, username, password, role, kelas, mapel } = req.body; await supabase.from('users').update({ name, username, password, role, kelas, mapel }).eq('username', old_username); res.json({status: "success"}); });

app.post('/api/admin/add-user', async (req, res) => { 
    const { name, username, password, role, kelas, mapel } = req.body; 
    await supabase.from('users').insert([{ name, username, password, role: role || 'siswa', kelas: kelas || '', mapel: mapel || '' }]); 
    res.json({status: "success"}); 
});

app.post('/api/admin/add-soal-bulk', async (req, res) => { const { questions } = req.body; if (!questions || questions.length === 0) return res.status(400).json({status: "error"}); const { error } = await supabase.from('questions').insert(questions); if(error) return res.status(500).json({status: "error", message: error.message}); res.json({ status: "success" }); });

app.post('/api/admin/import-soal', upload.single('file_excel'), async (req, res) => { try { const exam_id = req.body.exam_id; if(!exam_id) return res.status(400).json({status: "error", message: "KODE UJIAN harus diisi!"}); const workbook = XLSX.readFile(req.file.path); const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); let insertData = data.map(row => { let opsi = [row.Opsi_A, row.Opsi_B, row.Opsi_C, row.Opsi_D, row.Opsi_E].filter(Boolean).map(String); return { exam_id: exam_id, tipe: (row.Tipe || 'PG').toUpperCase(), tanya: row.Pertanyaan || '', opsi_json: opsi.join('|||'), kunci: row.Kunci ? String(row.Kunci).trim() : '', gform_url: row.Link_Gambar || '', skor: row.Skor || 1 }; }); if(insertData.length > 0) { const { error } = await supabase.from('questions').insert(insertData); if(error) throw error; } res.json({ status: "success", message: `${insertData.length} Soal berhasil di-import!` }); } catch(e) { res.status(500).json({status: "error", message: "Gagal memproses Excel. Pastikan kolom Skor sudah ada di Supabase."}); } });

// PERBAIKAN MESIN EKSTRAK WORD (Pengecualian tag sup, sub, b, i)
app.post('/api/admin/import-word', upload.single('file_word'), async (req, res) => { 
    try { 
        const exam_id = req.body.exam_id; 
        if(!exam_id) return res.status(400).json({status: "error", message: "KODE UJIAN harus diisi!"}); 
        
        const result = await mammoth.convertToHtml({path: req.file.path}); 
        const rows = result.value.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi); 
        if (!rows) return res.status(400).json({status: "error", message: "Tabel tidak ditemukan!"}); 
        
        let insertData = []; 
        for(let i = 0; i < rows.length; i++) { 
            const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi); 
            if (cells && cells.length >= 5) { 
                // Regex baru: Menghapus semua tag HTML KECUALI superscript, subscript, bold, italic, underline
                const textCells = cells.map(c => c.replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(?!(?:sup|sub|b|i|u|strong|em)\b)[^>]+>/gi, '').trim()); 
                
                let jenisAngka = textCells[1] ? textCells[1].replace(/[^0-9]/g, '') : ""; 
                if (!['1','2','3','4','5','6','9'].includes(jenisAngka)) continue; 
                
                let tipe = 'PG'; 
                if (jenisAngka === '2') tipe = 'PGK'; 
                else if (jenisAngka === '3') tipe = 'JODOH'; 
                else if (jenisAngka === '4') tipe = 'ISIAN'; 
                else if (jenisAngka === '5') tipe = 'ESAI'; 
                else if (jenisAngka === '9') tipe = 'TS'; 
                else if (jenisAngka === '6') tipe = 'SIFAT'; 
                
                const tanya = textCells[3] || ""; 
                const fileSoal = textCells[4] || ""; 
                let opsi = []; 
                for(let j=5; j<=9; j++) { if(textCells[j] && textCells[j].trim() !== '') opsi.push(textCells[j].trim()); } 
                const kunci = textCells[10] || ""; 
                
                if (tanya !== '') insertData.push({ exam_id, tipe, tanya, opsi_json: opsi.join('|||'), kunci: kunci.trim().toUpperCase(), gform_url: fileSoal, skor: 1 }); 
            } 
        } 
        if(insertData.length > 0) { 
            await supabase.from('questions').insert(insertData); 
            res.json({status: 'success', message: `${insertData.length} Soal Bimasoft berhasil diekstrak!`}); 
        } else { 
            res.status(400).json({status: 'error', message: '0 Soal diekstrak.'}); 
        } 
    } catch (e) { 
        res.status(500).json({status: 'error', message: 'Gagal ekstrak.'}); 
    } 
});

app.post('/api/admin/add-schedule', async (req, res) => { const pin = Math.floor(100000 + Math.random() * 900000).toString(); await supabase.from('schedules').insert([{ mapel: req.body.mapel, tanggal: req.body.tanggal, durasi: req.body.durasi, pin, status: 'Aktif' }]); res.json({ status: "success", pin }); });
app.get('/api/admin/schedules', async (req, res) => { let { data } = await supabase.from('schedules').select('*').order('id', { ascending: false }); if (req.query.role === 'guru') data = (data || []).filter(s => isAuthorizedMapel(req.query.mapel, s.mapel)); res.json(data || []); });

app.get('/api/admin/stats', async (req, res) => { const stats = { total_siswa: 0, sedang_kerja: 0, selesai: 0, curang: 0 }; const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).ilike('role', 'siswa'); stats.total_siswa = count || 0; let { data: acts } = await supabase.from('activity').select('*'); if (req.query.role === 'guru') acts = (acts || []).filter(a => isAuthorizedMapel(req.query.mapel, a.exam_name)); (acts || []).forEach(a => { if (a.status === 'Mengerjakan') stats.sedang_kerja++; else if (a.status === 'Selesai') stats.selesai++; else if (a.status && a.status.includes('Curang')) stats.curang++; }); res.json(stats); });

app.get('/api/admin/recent-activity', async (req, res) => { 
    let { data: acts } = await supabase.from('activity').select('*').order('last_seen', { ascending: false }); 
    let { data: users } = await supabase.from('users').select('name, kelas');
    let actsWithKelas = (acts || []).map(a => { let u = (users || []).find(x => x.name === a.student_name); return { ...a, kelas: u ? u.kelas : '-' }; });
    if (req.query.role === 'guru') actsWithKelas = actsWithKelas.filter(a => isAuthorizedMapel(req.query.mapel, a.exam_name)); 
    res.json(actsWithKelas); 
});

app.post('/api/admin/reset-siswa', async (req, res) => {
    const { student_name, mapel } = req.body;
    await supabase.from('results').delete().eq('student_name', student_name).eq('mapel', mapel);
    await supabase.from('activity').update({ status: 'Mengerjakan', last_seen: new Date().toLocaleTimeString('id-ID') }).eq('student_name', student_name).eq('exam_name', mapel);
    res.json({status: "success"});
});

app.get('/api/admin/users', async (req, res) => { const { data } = await supabase.from('users').select('*').neq('role', 'admin').neq('role', 'Admin').order('id', {ascending: false}); res.json(data || []); });
app.post('/api/admin/import-users', upload.single('file_excel'), async (req, res) => { try { const workbook = XLSX.readFile(req.file.path); const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); let insertData = excelData.map(row => ({ name: row.Nama, username: row.Username, password: row.Password, role: row.Role || 'siswa', kelas: row.Kelas, mapel: row.Mapel || '' })); if(insertData.length > 0) await supabase.from('users').insert(insertData); res.json({ status: "success" }); } catch(e) { res.status(500).json({status: "error"}); } });

app.get('/api/admin/results', async (req, res) => { 
    let { data: results } = await supabase.from('results').select('*').order('id', { ascending: false }); 
    let { data: users } = await supabase.from('users').select('name, kelas');
    let resultsWithKelas = (results || []).map(r => { let u = (users || []).find(x => x.name === r.student_name); return { ...r, kelas: u ? u.kelas : '-' }; });
    if (req.query.role === 'guru') resultsWithKelas = resultsWithKelas.filter(r => isAuthorizedMapel(req.query.mapel, r.mapel)); 
    res.json(resultsWithKelas); 
});

app.post('/api/siswa/cek-pin', async (req, res) => { 
    const { data: row } = await supabase.from('schedules').select('*').eq('pin', req.body.pin).eq('status', 'Aktif').single(); 
    if(row) { 
        let scheduleDate = row.tanggal; let scheduleTime = null;
        if(row.tanggal && row.tanggal.includes('|')) { let parts = row.tanggal.split('|'); scheduleDate = parts[0]; scheduleTime = parts[1]; }
        if (scheduleDate && scheduleDate !== req.body.client_date) return res.status(403).json({status: "error", message: "Ujian tidak dijadwalkan pada hari ini!"});
        if (scheduleTime && req.body.client_time < scheduleTime) return res.status(403).json({status: "error", message: `Ujian belum dimulai! (Jadwal: ${scheduleTime})`});

        const { data: existingActs } = await supabase.from('activity').select('*').eq('student_name', req.body.student_name).eq('exam_name', row.mapel);
        if (existingActs && existingActs.length > 0) {
            const act = existingActs[0];
            if (act.status && act.status.includes('Terkunci')) return res.status(403).json({status: "error", message: "Akses Terkunci! Laporkan ke Guru Mapel untuk dibuka kembali."});
            else if (act.status === 'Selesai') return res.status(403).json({status: "error", message: "Anda sudah menyelesaikan ujian ini."});
            await supabase.from('activity').update({ status: 'Mengerjakan', last_seen: new Date().toLocaleTimeString('id-ID') }).eq('id', act.id);
        } else {
            await supabase.from('activity').insert([{ student_name: req.body.student_name, exam_name: row.mapel, status: 'Mengerjakan', last_seen: new Date().toLocaleTimeString('id-ID') }]); 
        }
        res.json({status: "success", exam: row}); 
    } else { 
        res.status(404).json({status: "error", message: "PIN Salah atau Ujian belum aktif!"}); 
    } 
});

app.post('/api/siswa/get-soal', async (req, res) => { const { data } = await supabase.from('questions').select('id, tipe, tanya, opsi_json, kunci, media_path, gform_url, skor').eq('exam_id', req.body.exam_id).order('id', {ascending: true}); res.json({status: "success", questions: data || []}); });

app.post('/api/siswa/ping', async (req, res) => {
    await supabase.from('activity').update({ last_seen: new Date().toLocaleTimeString('id-ID'), score: req.body.durasi }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel).eq('status', 'Mengerjakan');
    res.json({status: "success"});
});

app.post('/api/siswa/submit', async (req, res) => { 
    const tglDB = new Date().toLocaleDateString('id-ID') + '|' + (req.body.durasi || '-');
    await supabase.from('results').insert([{ student_name: req.body.student_name, mapel: req.body.mapel, nilai: req.body.nilai, benar: req.body.benar, salah: req.body.salah, detail_jawaban: req.body.detail_jawaban, tanggal: tglDB }]); 
    await supabase.from('activity').update({ status: req.body.is_curang ? 'Curang (Terkunci)' : 'Selesai', score: req.body.nilai, last_seen: new Date().toLocaleTimeString('id-ID') + ' (' + (req.body.durasi || '-') + ')' }).eq('student_name', req.body.student_name).eq('exam_name', req.body.mapel); 
    res.json({status: "success"}); 
});

app.post('/api/siswa/flag-curang', async (req, res) => { 
    const { student_name, mapel, count } = req.body;
    let finalStatus = count >= 3 ? 'Curang (Terkunci)' : `Curang (${count}x Peringatan)`;
    await supabase.from('activity').update({ status: finalStatus, last_seen: new Date().toLocaleTimeString('id-ID') }).eq('student_name', student_name).eq('exam_name', mapel); 
    res.json({status: "success"}); 
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
module.exports = app;