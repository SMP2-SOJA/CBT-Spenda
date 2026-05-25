// CBT APP ENGINE - Copyright (c) | @spenda-digi
// ================================================================
// SPENDA-DIGI-CBT v2026.1 | Copyright 2026 | All Rights Reserved
// Hak Cipta Dilindungi — Dilarang menjual ulang tanpa izin tertulis
// ID: U1BFTkRBLURJR0k=
// ================================================================
const API = "/api";
const _SIG = atob('U1BFTkRBLURJR0ktQ0JULTIwMjY='); // DO NOT REMOVE
let activeUser = null; 
let _isDemoMode = false;
let currentExam = null; 
let examTimerInterval = null;
let cbtQuestions = []; 
let cbtAnswers = []; 
let cbtCurrentIndex = 0; 
let curangCount = 0;
let isExamActive = false; 
let allActivityData = [];
window.allResultsData = []; 
window.filteredResultsData = []; 
window.allSchedulesData = [];
let publicInterval;
let publicActivityData = [];

function formatMath(text) {
    if (typeof text !== 'string') return text;
    // ^(...) eksplisit — bebas isi dalam kurung
    // ^x / ^2 / ^ab   — maks 2 karakter, harus diikuti non-alfanumerik atau akhir string
    // Pembatasan ini mencegah "3x^2 -5x + 7 dengan" menelan sisa kalimat jadi superscript
    return text
        .replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>')
        .replace(/\^([a-zA-Z0-9]{1,2})(?=[^a-zA-Z0-9]|$)/g, '<sup>$1</sup>')
        .replace(/_\(([^)]*)\)/g, '<sub>$1</sub>')
        .replace(/_([a-zA-Z0-9]{1,2})(?=[^a-zA-Z0-9]|$)/g, '<sub>$1</sub>');
}

function getAuthParams() { return !activeUser ? "" : `?role=${encodeURIComponent(activeUser.role)}&mapel=${encodeURIComponent(activeUser.mapel || '')}`; }
function toggleAdminSidebar() { document.getElementById('admin-sidebar').classList.toggle('-translate-x-full'); document.getElementById('admin-overlay').classList.toggle('hidden'); }
function toggleCbtNav() { document.getElementById('cbt-nav-panel').classList.toggle('translate-x-full'); document.getElementById('cbt-nav-overlay').classList.toggle('hidden'); }
function togglePass(inputId, iconId) { const passInput = document.getElementById(inputId); const icon = document.getElementById(iconId); if(passInput.type === 'password') { passInput.type = 'text'; icon.classList.replace('fa-eye-slash', 'fa-eye'); } else { passInput.type = 'password'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } }

document.addEventListener('keyup', (e) => { if (isExamActive && (e.key === 'PrintScreen' || e.keyCode === 44)) { navigator.clipboard.writeText(''); Swal.fire('Akses Dilarang!', 'Screenshot terdeteksi!', 'warning'); } });
document.addEventListener('keydown', function(e) { if(isExamActive && (e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); } });
document.addEventListener('fullscreenchange', () => { if (isExamActive && !document.fullscreenElement) { deteksiKecurangan(); } });

function deteksiKecurangan() {
    if (!isExamActive || !navigator.onLine) return;
    curangCount++; 
    fetch(API + '/siswa/flag-curang', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, count: curangCount}) });
    if (curangCount >= 3) { isExamActive = false; Swal.fire({title: 'UJIAN DIBATALKAN!', text: 'Layar ujian otomatis dikunci!', icon: 'error', allowOutsideClick: false}).then(() => { submitUjian(false, true); }); } 
    else { Swal.fire('PERINGATAN!', `Dilarang meminimalkan layar/membuka tab lain! (${curangCount}/3)`, 'warning'); }
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === 'hidden') { deteksiKecurangan(); } });
window.addEventListener("blur", () => { deteksiKecurangan(); });
window.addEventListener('offline', () => { const el = document.getElementById('network-status'); if(el) { el.innerText = 'OFFLINE'; el.classList.replace('bg-emerald-500', 'bg-red-500'); } });
window.addEventListener('online', () => { const el = document.getElementById('network-status'); if(el) { el.innerText = 'ONLINE'; el.classList.replace('bg-red-500', 'bg-emerald-500'); } checkPendingSubmit(); });

async function prosesLogin() {
    const user = document.getElementById('login-user').value; const pass = document.getElementById('login-pass').value;
    if(!user || !pass) return Swal.fire('Oops', 'Wajib diisi!', 'warning'); Swal.fire({ title: 'Otentikasi...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(API + '/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass}) }); const data = await res.json();
        if (data.status === "success") {
            activeUser = data.user; Swal.close(); document.getElementById('view-login').classList.add('hidden');
            if (activeUser.role.toLowerCase() === 'siswa') { document.getElementById('view-siswa-token').classList.remove('hidden'); document.getElementById('nama-siswa-welcome').innerText = activeUser.name; checkPendingSubmit(false); } 
            else { document.getElementById('view-admin').classList.remove('hidden'); if (activeUser.role.toLowerCase() === 'guru') { document.getElementById('menu-users').classList.add('hidden'); document.getElementById('menu-jadwal').classList.add('hidden'); document.getElementById('menu-banksoal').classList.add('hidden'); document.getElementById('role-badge').classList.remove('hidden'); document.getElementById('role-badge').innerText = `GURU: ${activeUser.mapel || 'Semua Mapel'}`; } loadMaster(); showPage('dashboard'); }
        } else Swal.fire('Gagal', data.message, 'error');
    } catch (e) { Swal.fire('Error', 'Server mati.', 'error'); }
}


// ================================================================
// DEMO MODE FUNCTIONS
// ================================================================
function masukDemo() {
    _isDemoMode = true;
    activeUser = { id: 0, username: 'demo', name: 'Demo Sekolah', role: 'admin', kelas: '', mapel: '', _isDemo: true };
    document.getElementById('demo-banner').classList.remove('hidden');
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-admin').classList.remove('hidden');
    document.getElementById('role-badge').innerText = 'DEMO MODE';
    document.getElementById('user-name-display').innerText = 'Demo Sekolah';
    // Inject demo data
    window.allActivityData = [
        {id:1,student_name:'Andi Pratama',exam_name:'MTK-7A-DEMO',kelas:'7A',status:'Mengerjakan',score:40,last_seen:'08:15:22 (35 mnt)'},
        {id:2,student_name:'Budi Santoso',exam_name:'MTK-7A-DEMO',kelas:'7A',status:'Selesai',score:80,last_seen:'08:55:10 (55 mnt)'},
        {id:3,student_name:'Citra Dewi',exam_name:'MTK-7A-DEMO',kelas:'7B',status:'Curang (1x)',score:30,last_seen:'08:20:05 (20 mnt)'},
    ];
    window.allResultsData = [
        {id:1,student_name:'Budi Santoso',mapel:'MTK-7A-DEMO',kelas:'7A',nilai:80,benar:4,salah:1,detail_jawaban:'[]',tanggal:'26/5/2026|55 mnt'},
        {id:2,student_name:'Citra Dewi',mapel:'MTK-7A-DEMO',kelas:'7B',nilai:40,benar:2,salah:3,detail_jawaban:'[]',tanggal:'26/5/2026|20 mnt'},
    ];
    window.filteredResultsData = window.allResultsData;
    window.allSchedulesData = [
        {id:1,mapel:'MTK-7A-DEMO',pin:'1234',tanggal:'2026-05-26|08:00',durasi:60,status:'Aktif',kelas:'7A'},
    ];
    showPage('dashboard');
    renderActivityTable();
    Swal.fire({ icon:'info', title:'Mode Demo Aktif', 
        html:'<p class="text-sm">Anda sedang menggunakan <b>data contoh</b>.<br>Semua fitur bisa dicoba. Perubahan <b>tidak tersimpan</b> ke database asli.</p>',
        confirmButtonColor:'#D97706', confirmButtonText:'Mengerti, Lanjutkan!' });
}

function keluarDemo() {
    _isDemoMode = false;
    activeUser = null;
    document.getElementById('demo-banner').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
    window.allActivityData = [];
    window.allResultsData = [];
    window.filteredResultsData = [];
}

// Override fetch untuk demo mode — semua write operation jadi no-op
const _origFetch = window.fetch;
window.fetch = async function(url, opts) {
    if (!_isDemoMode) return _origFetch(url, opts);
    const method = (opts && opts.method || 'GET').toUpperCase();
    // Read endpoints: return demo data
    if (method === 'GET') {
        if (url.includes('/admin/users')) return new Response(JSON.stringify([
            {id:1,username:'siswa01',name:'Andi Pratama',role:'siswa',kelas:'7A',mapel:''},
            {id:2,username:'guru01',name:'Pak Budi',role:'guru',kelas:'',mapel:'MTK'},
        ]), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/questions')) return new Response(JSON.stringify([
            {id:1,exam_id:'MTK-7A-DEMO',tipe:'PG',tanya:'Berapakah 5 × 8?',opsi_json:'30|||35|||40|||45',kunci:'C',skor:2},
            {id:2,exam_id:'MTK-7A-DEMO',tipe:'ISIAN',tanya:'Hasil 12 + 8 = ...',opsi_json:'',kunci:'20',skor:2},
        ]), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/available-exams')) return new Response(JSON.stringify(['MTK-7A-DEMO']), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/schedules')) return new Response(JSON.stringify([
            {id:1,mapel:'MTK-7A-DEMO',pin:'1234',tanggal:'2026-05-26|08:00',durasi:60,status:'Aktif',kelas:'7A'},
        ]), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/results')) return new Response(JSON.stringify(window.allResultsData||[]), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/recent-activity')) return new Response(JSON.stringify(window.allActivityData||[]), {status:200,headers:{'Content-Type':'application/json'}});
        if (url.includes('/admin/stats')) return new Response(JSON.stringify({total_siswa:30,total_guru:5}), {status:200,headers:{'Content-Type':'application/json'}});
    }
    // All write operations: return success without hitting DB
    return new Response(JSON.stringify({status:'success', _demo:true}), {status:200,headers:{'Content-Type':'application/json'}});
};


function logout() { location.reload(); }
function saveToLocal() { if(currentExam && activeUser) localStorage.setItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`, JSON.stringify(cbtAnswers)); }

function loadFromLocal() { 
    if(currentExam && activeUser) { 
        const saved = localStorage.getItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); 
        if(saved) {
            try {
                let parsed = JSON.parse(saved);
                if(parsed.length === cbtQuestions.length) { cbtAnswers = parsed; } 
                else { localStorage.removeItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); }
            } catch(e) { localStorage.removeItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); }
        } 
    } 
}

async function mulaiUjian() {
    const pin = document.getElementById('input-pin').value; 
    if(!pin) return Swal.fire('Error', 'PIN Wajib diisi!', 'warning'); 
    Swal.fire({ title: 'Menyiapkan lembar soal...', didOpen: () => Swal.showLoading() });
    
    try {
        const clientDate = new Date().toLocaleDateString('en-CA'); 
        const clientTime = new Date().toTimeString().substring(0,5); 
        
        const res = await fetch(API + '/siswa/cek-pin', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ pin: pin, student_name: activeUser.name, kelas: activeUser.kelas || '', client_date: clientDate, client_time: clientTime }) 
        }); 
        
        const data = await res.json();
        if(data.status === "success") {
            currentExam = data.exam; 
            const resSoal = await fetch(API + '/siswa/get-soal', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({exam_id: currentExam.mapel}) }); 
            const dataSoal = await resSoal.json();
            if(!dataSoal.questions || dataSoal.questions.length === 0) return Swal.fire('Oops', 'Paket soal khusus untuk kelas Anda belum diatur atau tidak ditemukan di PIN ini!', 'error');
            
            document.getElementById('view-siswa-token').classList.add('hidden'); 
            document.getElementById('view-siswa-ujian').classList.remove('hidden');
            document.getElementById('ujian-mapel-title').innerText = currentExam.mapel; 
            document.getElementById('ujian-nama-siswa').innerText = activeUser.name;
            
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
            
            cbtQuestions = dataSoal.questions; 
            cbtAnswers = new Array(cbtQuestions.length).fill(null).map(() => ({ ans: '' })); 
            cbtCurrentIndex = 0;
            
            let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; 
            localStorage.setItem(startTimeKey, Date.now()); 
            
            loadFromLocal(); startTimer(currentExam.durasi || 60); renderCbtGrid(); showCbtQuestion(0); curangCount = 0; isExamActive = true; 
            
            fetch(API + '/siswa/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, durasi: `0m 0s | 0/${cbtQuestions.length} Soal`, live_score: 0, kelas: activeUser.kelas || '-'}) }).catch(e=>console.log(e));

            Swal.close();
        } else { Swal.fire('Gagal', data.message, 'error'); }
    } catch(e) { Swal.fire('Sistem Error', 'Terputus dari server. Pastikan jaringan lancar.', 'error'); }
}

function startTimer(durationMinutes) {
    const timeKey = `cbt_time_${currentExam.mapel}_${activeUser.username}`; let endTime = localStorage.getItem(timeKey);
    if(!endTime) { endTime = Date.now() + (durationMinutes * 60 * 1000); localStorage.setItem(timeKey, endTime); }
    const timerDisplay = document.getElementById('exam-countdown');
    examTimerInterval = setInterval(() => {
        let timeRemaining = Math.floor((parseInt(endTime) - Date.now()) / 1000);
        if (timeRemaining <= 0) { clearInterval(examTimerInterval); timerDisplay.innerText = "00:00:00"; submitUjian(false); return; }
        let h = Math.floor(timeRemaining / 3600); let m = Math.floor((timeRemaining % 3600) / 60); let s = timeRemaining % 60;
        timerDisplay.innerText = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }, 1000);
}

function getLiveScore() {
    if(!cbtQuestions || cbtQuestions.length === 0) return 0;
    if(cbtQuestions[0].tipe === 'GFORM') return 'G-Form';
    let totalSkorMaksimal = 0; let totalSkorDiperoleh = 0;
    cbtQuestions.forEach((q, index) => {
        let ans = cbtAnswers[index]?.ans || ""; let bobot = q.skor ? parseFloat(q.skor) : 1; 
        if (q.kunci && q.kunci.trim() === '') {} 
        else if (q.tipe === 'PG') { totalSkorMaksimal += bobot; let kBersih = (q.kunci || "").replace(/\s/g, '').toLowerCase(); let aBersih = (ans || "").replace(/\s/g, '').toLowerCase(); if(aBersih && aBersih === kBersih) { totalSkorDiperoleh += bobot; } } 
        else if (q.tipe === 'PGK') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); if(kArr.length > 0) { let betul = 0; aArr.forEach(a => { if(kArr.includes(a)) betul++; }); if(betul === kArr.length && aArr.length === kArr.length) { totalSkorDiperoleh += bobot; } else if(betul > 0) { totalSkorDiperoleh += (betul / kArr.length) * bobot; } } } 
        else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toUpperCase().split(',').filter(x=>x); if ((q.tipe === 'BS' || q.tipe === 'TS') && kArr.some(k => k === 'S')) { kArr = kArr.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k)); } let aArr = (ans||"").replace(/\s/g, '').toUpperCase().split(','); let correct = 0; for(let j=0; j<kArr.length; j++) { if(aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== "") { correct++; } } if(correct === kArr.length && kArr.length > 0) { totalSkorDiperoleh += bobot; } else if (correct > 0) { totalSkorDiperoleh += (correct / kArr.length) * bobot; } }
        else if (q.tipe === 'JODOH') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let correct = 0; kArr.forEach(k => { if(aArr.includes(k)) correct++; }); if(correct === kArr.length && kArr.length > 0) { totalSkorDiperoleh += bobot; } else if (correct > 0) { totalSkorDiperoleh += (correct / kArr.length) * bobot; } }
        else if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') { let kWords = (q.kunci || "").toLowerCase().match(/[a-z0-9]+/gi) || []; let aWords = (ans || "").toLowerCase().match(/[a-z0-9]+/gi) || []; if (kWords.length > 0) { totalSkorMaksimal += bobot; let match = 0; let aUnique = [...new Set(aWords)]; kWords.forEach(kw => { if(aUnique.includes(kw)) match++; }); if(match === kWords.length) { totalSkorDiperoleh += bobot; } else if(match > 0) { totalSkorDiperoleh += (match / kWords.length) * bobot; } } }
    });
    return totalSkorMaksimal > 0 ? Math.round((totalSkorDiperoleh / totalSkorMaksimal) * 100) : 0;
}

setInterval(() => {
    if (isExamActive && navigator.onLine) {
        let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; let start = localStorage.getItem(startTimeKey);
        let dMins = 0, dSecs = 0; if (start) { let diffMs = Date.now() - parseInt(start); dMins = Math.floor(diffMs / 60000); dSecs = Math.floor((diffMs % 60000) / 1000); }
        let terjawab = 0; let totalSoal = cbtQuestions.length;
        for(let i=0; i<totalSoal; i++){ let a = cbtAnswers[i]?.ans || ""; let q = cbtQuestions[i]; if(a === "") continue; if((q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') && a.indexOf('-') !== -1) continue; if(q.tipe === 'JODOH' && a.split(',').length < (q.kunci||"").split(',').length) continue; terjawab++; }
        let durasiTeks = `${dMins}m ${dSecs}s | ${terjawab}/${totalSoal} Soal`; let lScore = getLiveScore(); 
        
        fetch(API + '/siswa/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, durasi: durasiTeks, live_score: lScore, kelas: activeUser.kelas || '-'}) }).catch(e=>console.log(e)); 
    }
}, 15000);

function renderCbtGrid() {
    let html = "";
    for(let i = 0; i < cbtQuestions.length; i++) {
        let statusClass = "bg-white text-slate-600 border-slate-300"; let isAnswered = false;
        if (cbtAnswers[i].ans !== "") { if (cbtQuestions[i].tipe === 'BS' || cbtQuestions[i].tipe === 'TS' || cbtQuestions[i].tipe === 'SIFAT') { isAnswered = cbtAnswers[i].ans.indexOf('-') === -1; } else if(cbtQuestions[i].tipe === 'JODOH') { let h = (cbtQuestions[i].kunci||"").split(',').length; isAnswered = cbtAnswers[i].ans.split(',').length >= h; } else { isAnswered = true; } }
        if(isAnswered) statusClass = "bg-blue-600 text-white border-blue-700 shadow-md"; 
        let activeRing = (i === cbtCurrentIndex) ? "ring-4 ring-blue-300 scale-105" : "";
        html += `<button onclick="showCbtQuestion(${i}); if(window.innerWidth < 768) toggleCbtNav();" class="w-full aspect-square flex items-center justify-center rounded-lg font-black text-xs md:text-sm border-2 transition transform active:scale-95 ${statusClass} ${activeRing}">${i+1}</button>`;
    } document.getElementById('cbt-grid').innerHTML = html;
}

function showCbtQuestion(index) {
    cbtCurrentIndex = index; const q = cbtQuestions[index]; const savedAns = cbtAnswers[index].ans || "";
    document.getElementById('cbt-no-soal').innerText = index + 1; document.getElementById('cbt-tipe-soal').innerText = q.tipe;
    const divMedia = document.getElementById('cbt-media-area'); const divTanya = document.getElementById('cbt-tanya'); const divOpsi = document.getElementById('cbt-opsi-area');
    divMedia.innerHTML = ""; divTanya.innerHTML = ""; divOpsi.innerHTML = "";
    let imgUrl = q.gform_url; let fallbackUrl = '';
    if(imgUrl && imgUrl.includes('drive.google.com')) { let idMatch = imgUrl.match(/[?&]id=([^&]+)/) || imgUrl.match(/\/d\/([^\/]+)/); if(idMatch && idMatch[1]) { imgUrl = `https://lh3.googleusercontent.com/d/${idMatch[1]}=s1200`; fallbackUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`; } }
    if (imgUrl && q.tipe !== 'GFORM' && imgUrl.startsWith('http')) { divMedia.innerHTML = `<img src="${imgUrl}" ${fallbackUrl ? `onerror="if(this.src !== '${fallbackUrl}') this.src='${fallbackUrl}';"` : ''} class="w-auto max-w-full h-auto max-h-[60vh] rounded-xl border shadow-sm mx-auto mb-3 md:mb-4 object-contain">`; }
    
    if(q.tipe === 'GFORM') { divOpsi.innerHTML = `<div class="gform-container"><iframe src="${q.tanya || q.gform_url}"></iframe></div>`; cbtSaveAnswer("COMPLETED"); 
    } else {
        let htmlOpsi = ""; let opsiArray = q.opsi_json ? q.opsi_json.split(/\|\|\|/).map(o=>o.trim()).filter(o=>o) : []; const abjad = ['A', 'B', 'C', 'D', 'E', 'F'];
        if (q.tipe === 'JODOH') {
            let lines = (q.tanya||"").split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(l => l); let premises = []; let mainTanya = []; lines.forEach(l => { if (/^\d+[\.\)]\s?/.test(l)) { premises.push(l); } else { mainTanya.push(l); } }); divTanya.innerHTML = formatMath(mainTanya.join('<br>')); 
            let totalPairs = q.kunci ? q.kunci.split(',').length : (premises.length || 4); let savedArr = savedAns ? savedAns.split(',') : [];
            htmlOpsi += `<div class="bg-blue-50 p-3 md:p-4 rounded-xl border border-blue-200 mt-2 mb-3 md:mb-4"><p class="text-[10px] md:text-xs font-bold text-blue-800 mb-2 md:mb-3"><i class="fa fa-mouse-pointer"></i> PILIH PASANGAN JAWABAN YANG TEPAT:</p><div class="space-y-2 md:space-y-3">`;
            for(let i=0; i<totalPairs; i++) { let currentSaved = savedArr[i] ? savedArr[i].replace(/[0-9]/g, '') : ''; let labelText = premises[i] ? premises[i] : `Pertanyaan/Pasangan Nomor ${i+1}`; htmlOpsi += `<div class="flex flex-col md:flex-row items-start md:items-center justify-between p-2 md:p-3 bg-white border border-blue-100 rounded-lg shadow-sm gap-2"><span class="font-bold text-slate-700 text-[10px] md:text-sm md:w-1/2 leading-snug">${formatMath(labelText)}</span><select class="jodoh-select p-2 md:p-3 border-2 border-emerald-300 rounded-lg text-[10px] md:text-sm font-bold text-emerald-800 bg-emerald-50 outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-1/2 cursor-pointer" onchange="cbtSaveJodoh(${totalPairs})"><option value="">- Silakan Pilih Jawaban -</option>`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx]; let isSel = (currentSaved === huruf) ? "selected" : ""; htmlOpsi += `<option value="${huruf}" ${isSel}>${formatMath(val)}</option>`; }); htmlOpsi += `</select></div>`; } htmlOpsi += `</div></div>`;
        } else {
            divTanya.innerHTML = formatMath(q.tanya || "");
            if (q.tipe === 'PG') { htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = (savedAns === huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-2 md:p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-blue-300"><input type="radio" name="cbt_ans" value="${huruf}" ${isChecked} onchange="cbtSaveAnswer(this.value)" class="w-4 h-4 md:w-5 md:h-5 text-blue-600 mr-2 md:mr-3 accent-blue-600"><span class="font-black text-[10px] md:text-sm mr-2 md:mr-3 bg-slate-100 border border-slate-200 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full text-slate-600 shadow-sm">${huruf}</span><span class="text-xs md:text-sm font-medium text-slate-700 leading-snug">${formatMath(val)}</span></label>`; }); htmlOpsi += `</div>`; }
            else if (q.tipe === 'PGK') { let savedArr = savedAns ? savedAns.split(',') : []; htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = savedArr.includes(huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-2 md:p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-purple-300"><input type="checkbox" value="${huruf}" ${isChecked} onchange="cbtSaveCheckbox()" class="cbt-pgk-cb w-5 h-5 md:w-6 md:h-6 text-purple-600 mr-3 md:mr-4 rounded accent-purple-600 shadow-sm"><span class="text-xs md:text-sm font-medium text-slate-700 leading-snug">${formatMath(val)}</span></label>`; }); htmlOpsi += `</div>`; }
            else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') {
                let savedArr = savedAns ? savedAns.split(',') : []; let headers = []; if (q.tipe === 'BS') headers = ['Benar', 'Salah']; else if (q.tipe === 'TS') headers = ['Sesuai', 'Tidak Sesuai']; else if (q.tipe === 'SIFAT') headers = ['Sifat Komutatif', 'Sifat Asosiatif', 'Sifat Distributif'];
                let statements = opsiArray.length > 0 ? opsiArray : ['Pernyataan 1', 'Pernyataan 2'];
                htmlOpsi += `<div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm"><table class="w-full text-[10px] md:text-sm text-left"><thead class="bg-slate-100 text-slate-600"><tr><th class="p-3 md:p-4 border-b">Pernyataan</th>`;
                headers.forEach(h => htmlOpsi += `<th class="p-3 md:p-4 border-b text-center font-bold min-w-[60px] md:min-w-[80px] leading-tight text-[9px] md:text-xs">${formatMath(h)}</th>`); htmlOpsi += `</tr></thead><tbody class="divide-y divide-slate-100 bg-white">`;
                statements.forEach((val, idx) => { htmlOpsi += `<tr class="hover:bg-slate-50 transition"><td class="p-3 md:p-4 text-slate-700 font-medium whitespace-normal min-w-[150px] md:min-w-[200px] leading-snug">${formatMath(val)}</td>`; headers.forEach((h, hIdx) => { let huruf = abjad[hIdx]; let isChecked = savedArr[idx] === huruf ? 'checked' : ''; htmlOpsi += `<td class="p-3 md:p-4 text-center border-l"><input type="radio" name="matrix_${idx}" value="${huruf}" ${isChecked} onchange="cbtSaveMatrix(${statements.length})" class="w-4 h-4 md:w-5 md:h-5 accent-blue-600 cursor-pointer"></td>`; }); htmlOpsi += `</tr>`; }); htmlOpsi += `</tbody></table></div>`;
            }
            else if (q.tipe === 'ISIAN') { htmlOpsi += `<input type="text" onkeyup="cbtSaveAnswer(this.value)" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth', block:'center'}), 300)" value="${savedAns}" class="w-full p-3 md:p-4 border-2 rounded-xl text-xs md:text-sm font-bold bg-white focus:border-blue-500 outline-none" placeholder="Ketik jawaban Anda di sini...">`; }
            else if (q.tipe === 'ESAI') { htmlOpsi += `<textarea onkeyup="cbtSaveAnswer(this.value)" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth', block:'center'}), 300)" class="w-full p-3 md:p-4 border-2 rounded-xl h-24 md:h-32 text-xs md:text-sm bg-white focus:border-blue-500 outline-none" placeholder="Uraikan jawaban Anda di sini...">${savedAns}</textarea>`; }
        } divOpsi.innerHTML = htmlOpsi; 
    } renderCbtGrid();
}

function cbtSaveCheckbox() { let checked = []; document.querySelectorAll('.cbt-pgk-cb:checked').forEach(cb => checked.push(cb.value)); cbtSaveAnswer(checked.join(',')); }
function cbtSaveMatrix(length) { let arr = []; for(let i=0; i<length; i++) { let selected = document.querySelector(`input[name="matrix_${i}"]:checked`); arr.push(selected ? selected.value : '-'); } cbtSaveAnswer(arr.join(',')); }
function cbtSaveJodoh(totalPairs) { let arr = []; let selects = document.querySelectorAll('.jodoh-select'); selects.forEach((sel, idx) => { if(sel.value) arr.push(`${idx+1}${sel.value}`); }); cbtSaveAnswer(arr.join(',')); }
function cbtSaveAnswer(val) { cbtAnswers[cbtCurrentIndex].ans = val; saveToLocal(); renderCbtGrid(); }
function cbtNext() { if(cbtCurrentIndex < cbtQuestions.length - 1) { showCbtQuestion(cbtCurrentIndex + 1); } else { let kosong = cbtQuestions.filter((q, i) => { let a = cbtAnswers[i].ans; if(q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') return a === "" || a.indexOf('-') !== -1; if(q.tipe === 'JODOH') { let h = (q.kunci||"").split(',').length; return a.split(',').length < h; } return a === ""; }).length; if(kosong > 0) { Swal.fire('Peringatan!', `Ada <b class="text-red-500">${kosong} soal</b> belum dijawab!`, 'warning'); } else { Swal.fire('Selesai!', 'Semua soal dijawab. Silakan kumpulkan.', 'success'); } } }
function cbtPrev() { if(cbtCurrentIndex > 0) showCbtQuestion(cbtCurrentIndex - 1); }

async function checkPendingSubmit(showFeedback = false) {
    if(!activeUser) return; const pendingData = localStorage.getItem(`pending_submit_${activeUser.username}`);
    if(pendingData) {
        document.getElementById('offline-pending-alert').classList.remove('hidden');
        if(navigator.onLine) {
            if(showFeedback) Swal.fire({title:'Menyinkronkan...', didOpen: ()=>Swal.showLoading()});
            try {
                const payload = JSON.parse(pendingData); await fetch(API + '/siswa/submit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                localStorage.removeItem(`pending_submit_${activeUser.username}`); document.getElementById('offline-pending-alert').classList.add('hidden'); localStorage.removeItem(`cbt_ans_${payload.mapel}_${activeUser.username}`); localStorage.removeItem(`cbt_time_${payload.mapel}_${activeUser.username}`);
                Swal.fire('Berhasil!', 'Jawaban sinkron otomatis.', 'success').then(() => location.reload());
            } catch(e) { if(showFeedback) Swal.fire('Gagal', 'Koneksi belum stabil.', 'error'); }
        }
    }
}

function colorizeAnswer(jawab, kunci, tipe) {
    if (!jawab || jawab === '-') return '-'; if (jawab === kunci) return `<span style="color:#2563eb; font-weight:bold;">${formatMath(jawab)}</span>`; 
    let jArr = jawab.split(/, | \| /); let kArr = (kunci||"").split(/, | \| /);
    if (jArr.length > 1 && ['BS', 'TS', 'SIFAT', 'JODOH', 'PGK', 'ISIAN', 'ESAI'].includes(tipe)) {
        let res = []; jArr.forEach((j) => { if (kArr.includes(j)) res.push(`<span style="color:#2563eb; font-weight:bold;">${formatMath(j)}</span>`); else res.push(`<span style="color:#dc2626; font-weight:bold;">${formatMath(j)}</span>`); }); return res.join('<br>');
    } return `<span style="color:#dc2626; font-weight:bold;">${formatMath(jawab)}</span>`; 
}

function getFullAnswerText(q, rawAnswer) {
    if(!rawAnswer || rawAnswer === '-') return '-'; let opsiArray = q.opsi_json ? q.opsi_json.split(/\|\|\|/).map(o=>o.trim()).filter(o=>o) : []; const abjad = ['A', 'B', 'C', 'D', 'E', 'F'];
    if(q.tipe === 'PG') { let idx = abjad.indexOf(rawAnswer); return idx !== -1 && opsiArray[idx] ? `${rawAnswer}. ${opsiArray[idx]}` : rawAnswer; }
    if(q.tipe === 'PGK') { let ansArr = rawAnswer.split(','); let texts = []; ansArr.forEach(a => { let idx = abjad.indexOf(a); if(idx !== -1 && opsiArray[idx]) texts.push(`${a}. ${opsiArray[idx]}`); else texts.push(a); }); return texts.join(', '); }
    if(q.tipe === 'JODOH') { let ansArr = rawAnswer.split(','); let texts = []; ansArr.forEach(a => { let num = a.replace(/[a-zA-Z]/g, ''); let letPart = a.replace(/[0-9]/g, ''); let idx = abjad.indexOf(letPart); if(idx !== -1 && opsiArray[idx]) texts.push(`No.${num} -> ${opsiArray[idx]}`); else texts.push(a); }); return texts.join(' | '); }
    if(q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { 
        let hd = []; if (q.tipe === 'BS') headers = ['Benar', 'Salah']; else if (q.tipe === 'TS') hd = ['Sesuai', 'Tidak Sesuai']; else if (q.tipe === 'SIFAT') hd = ['Sifat Komutatif', 'Sifat Asosiatif', 'Sifat Distributif'];
        let ansArr = rawAnswer.split(','); let tx = []; ansArr.forEach((a, i) => { let idx = abjad.indexOf(a); if (q.tipe === 'BS' || q.tipe === 'TS') { if(a === 'B' && hd.length === 2 && idx === 1) {} else if(a === 'B' && !['A','B','C','D'].includes(a)) { idx = 0; } else if(a === 'S' && !['A','B','C','D'].includes(a)) { idx = 1; } } if(idx !== -1 && hd[idx]) tx.push(`No.${i+1}:${hd[idx]}`); else tx.push(`No.${i+1}:-`); }); return tx.join(', '); 
    } return rawAnswer;
}

async function submitUjian(showConfirm = true, isForceCurang = false) {
    let benar = 0; let salah = 0; let detail = []; let isGformOnly = cbtQuestions.length > 0 && cbtQuestions[0].tipe === 'GFORM'; let nilaiAkhir = 0; let totalSkorMaksimal = 0; let totalSkorDiperoleh = 0;
    if(!isGformOnly) {
        cbtQuestions.forEach((q, index) => {
            let ans = cbtAnswers[index].ans; let status = 'Salah'; let bobot = q.skor ? parseFloat(q.skor) : 1; let poin = 0;
            if (q.kunci && q.kunci.trim() === '') { status = 'Menunggu Koreksi'; poin = 0; }
            else if (q.tipe === 'PG') { totalSkorMaksimal += bobot; let kBersih = (q.kunci || "").replace(/\s/g, '').toLowerCase(); let aBersih = (ans || "").replace(/\s/g, '').toLowerCase(); if(aBersih && aBersih === kBersih) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else { salah++; } } 
            else if (q.tipe === 'PGK') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); if(kArr.length > 0) { let betul = 0; aArr.forEach(a => { if(kArr.includes(a)) betul++; }); if(betul === kArr.length && aArr.length === kArr.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if(betul > 0) { status = `Sebagian Benar (${betul}/${kArr.length})`; poin = (betul / kArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else { salah++; } } else { salah++; } } 
            else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toUpperCase().split(',').filter(x=>x); if ((q.tipe === 'BS' || q.tipe === 'TS') && kArr.some(k => k === 'S')) { kArr = kArr.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k)); } let aArr = (ans||"").replace(/\s/g, '').toUpperCase().split(','); let cor = 0; for(let j=0; j<kArr.length; j++) { if(aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== "") { cor++; } } if(cor === kArr.length && kArr.length > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if (cor > 0) { status = `Sebagian Benar (${cor}/${kArr.length})`; poin = (cor / kArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else { salah++; } }
            else if (q.tipe === 'JODOH') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); let cor = 0; kArr.forEach(k => { if(aArr.includes(k)) cor++; }); if(cor === kArr.length && kArr.length > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if (cor > 0) { status = `Sebagian Benar (${cor}/${kArr.length})`; poin = (cor / kArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else { salah++; } }
            else if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') { let kWords = (q.kunci || "").toLowerCase().match(/[a-z0-9]+/gi) || []; let aWords = (ans || "").toLowerCase().match(/[a-z0-9]+/gi) || []; if (kWords.length > 0) { totalSkorMaksimal += bobot; let mWord = 0; let aUnique = [...new Set(aWords)]; kWords.forEach(kw => { if(aUnique.includes(kw)) mWord++; }); if(mWord === kWords.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if(mWord > 0) { status = `Sebagian Benar (${mWord}/${kWords.length})`; poin = (mWord / kWords.length) * bobot; totalSkorDiperoleh += poin; benar++; } else { salah++; } } else { status = 'Menunggu Koreksi'; poin = 0; } }
            poin = Math.round(poin * 100) / 100; detail.push({ no: index+1, tipe: q.tipe, tanya: q.tanya, jawab: getFullAnswerText(q, ans), kunci: getFullAnswerText(q, q.kunci), status: status, poin: poin });
        }); nilaiAkhir = totalSkorMaksimal > 0 ? Math.round((totalSkorDiperoleh / totalSkorMaksimal) * 100) : 0;
    } else { nilaiAkhir = 'Cek G-Form'; }

    let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; let start = localStorage.getItem(startTimeKey); let durasiText = '-';
    if (start) { 
        let diffMs = Date.now() - parseInt(start); let dMins = Math.floor(diffMs / 60000); let dSecs = Math.floor((diffMs % 60000) / 1000); 
        let terjawab = 0; for(let i=0; i<cbtQuestions.length; i++){ let a = cbtAnswers[i]?.ans || ""; let q = cbtQuestions[i]; if(a === "") continue; if((q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') && a.indexOf('-') !== -1) continue; if(q.tipe === 'JODOH' && a.split(',').length < (q.kunci||"").split(',').length) continue; terjawab++; }
        durasiText = `${dMins}m ${dSecs}s | ${terjawab}/${cbtQuestions.length} Soal`; 
    }
    const payload = { student_name: activeUser.name, mapel: currentExam.mapel, nilai: nilaiAkhir, benar: benar, salah: salah, detail_jawaban: JSON.stringify(detail), is_curang: isForceCurang, durasi: durasiText };

    const sendLogic = async () => {
        clearInterval(examTimerInterval); isExamActive = false;
        if(!navigator.onLine) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); Swal.fire('Offline', 'Disimpan Lokal.', 'warning'); return; }
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
            await fetch(API + '/siswa/submit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(document.exitFullscreen) document.exitFullscreen(); 
            if(!isForceCurang) { localStorage.removeItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); localStorage.removeItem(`cbt_time_${currentExam.mapel}_${activeUser.username}`); localStorage.removeItem(startTimeKey); }
            Swal.fire('Selesai!', isGformOnly ? 'Terkirim.' : `Nilai Anda: ${nilaiAkhir}`, 'success').then(() => location.reload());
        } catch(e) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); Swal.fire('Error Server', 'Disimpan di HP.', 'warning'); }
    };

    if (showConfirm && !isForceCurang) {
        let kosong = cbtQuestions.filter((q, i) => { let a = cbtAnswers[i].ans; if(q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') return a === "" || a.indexOf('-') !== -1; if(q.tipe === 'JODOH') { return a.split(',').length < (q.kunci||"").split(',').length; } return a === ""; }).length;
        let text = isGformOnly ? "Pastikan sudah Submit G-Form!" : (kosong > 0 ? `<b class='text-red-500'>${kosong} soal</b> belum dijawab! Yakin?` : "Kirim sekarang?");
        Swal.fire({ title: 'Kumpulkan Ujian?', html: text, icon: 'warning', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Ya!' }).then((r) => { if(r.isConfirmed) sendLogic(); });
    } else sendLogic();
}

// ADMIN DASHBOARD
function showPage(p) { document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden')); document.getElementById('page-'+p).classList.remove('hidden'); if(window.innerWidth < 768) { document.getElementById('admin-sidebar').classList.add('-translate-x-full'); document.getElementById('admin-overlay').classList.add('hidden'); } if(p === 'dashboard') loadStats(); if(p === 'jadwal') loadJadwal(); if(p === 'nilai') loadNilai(); if(p === 'banksoal') loadBankSoal(); if(p === 'users') loadUsers(); }

async function showPublicScore() { document.getElementById('view-login').classList.add('hidden'); document.getElementById('view-public-score').classList.remove('hidden'); document.getElementById('view-public-score').classList.add('flex'); await loadPublicData(); publicInterval = setInterval(loadPublicData, 5000); }
async function loadPublicData() { try { const res = await fetch(API + '/admin/recent-activity'); publicActivityData = await res.json(); if(document.getElementById('pub-filter-kelas').options.length === 1) { let kelasSet = new Set(); let mapelSet = new Set(); (publicActivityData || []).forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); }); const fKelas = document.getElementById('pub-filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); }); const fMapel = document.getElementById('pub-filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); }); } renderPublicTable(); } catch(e) { console.log("Gagal load score"); } }
function renderPublicTable() { const selKelas = document.getElementById('pub-filter-kelas').value; const selMapel = document.getElementById('pub-filter-mapel').value; let filtered = (publicActivityData || []).filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); }); filtered.sort((a,b) => (parseFloat(String(b.score).split('|')[0])||0) - (parseFloat(String(a.score).split('|')[0])||0)); document.getElementById('public-table-body').innerHTML = filtered.map(a => { let badge = a.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : (a.status.includes('Curang') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'); let skorMentah = a.score !== null && a.score !== undefined ? String(a.score) : '-'; let nilaiTampil = skorMentah.includes('|') ? skorMentah.split('|')[0].trim() : skorMentah; return `<tr class="hover:bg-slate-50"><td class="p-2 md:p-3 font-bold text-slate-800">${a.student_name}</td><td class="p-2 md:p-3 font-medium text-slate-600">${a.kelas||'-'} <br><span class="text-[9px]">${a.exam_name}</span></td><td class="p-2 md:p-3 text-center"><span class="px-2 py-1 rounded text-[9px] font-bold ${badge}">${a.status}</span></td><td class="p-2 md:p-3 text-center font-black text-sm text-blue-600">${nilaiTampil}</td></tr>`; }).join('') || `<tr><td colspan="4" class="text-center p-4 text-slate-400">Belum ada aktivitas.</td></tr>`; }
function keluarPublic() { clearInterval(publicInterval); document.getElementById('view-public-score').classList.add('hidden'); document.getElementById('view-public-score').classList.remove('flex'); document.getElementById('view-login').classList.remove('hidden'); }

async function loadStats() { 
    if(!activeUser || activeUser.role === 'siswa') return; 
    const resStats = await fetch(API + '/admin/stats'); const dataStats = await resStats.json(); 
    document.getElementById('stat-siswa').innerText = dataStats.total_siswa; document.getElementById('stat-guru').innerText = dataStats.total_guru; 
    
    const resSch = await fetch(API + '/admin/schedules' + getAuthParams()); const schedules = await resSch.json(); 
    document.getElementById('dashboard-tokens').innerHTML = (schedules || []).map(s => `<div class="bg-gradient-to-r from-blue-600 to-blue-800 p-3 md:p-4 rounded-xl shadow-md text-white flex justify-between items-center border border-blue-500"><div><p class="text-[8px] md:text-[10px] font-bold opacity-80 uppercase">${s.mapel}</p><h2 class="text-base md:text-xl font-black tracking-widest">${s.pin}</h2></div><i class="fa fa-key text-xl opacity-50"></i></div>`).join('');

    const resA = await fetch(API + '/admin/recent-activity'); allActivityData = await resA.json(); 
    if(document.getElementById('filter-kelas').options.length === 1) {
        let kelasSet = new Set(); let mapelSet = new Set();
        (allActivityData || []).forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); });
        const fKelas = document.getElementById('filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); });
        const fMapel = document.getElementById('filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); });
    } renderActivityTable();
}

async function resetSiswa(nama, mapel) { Swal.fire({ title: 'Buka Akses?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Buka!' }).then(async (r) => { if (r.isConfirmed) { await fetch(API + '/admin/reset-siswa', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: nama, mapel: mapel}) }); loadStats(); } }); }
async function usirHantu(id) { await fetch(API + '/admin/remove-activity/' + id, { method: 'DELETE' }); loadStats(); }

// -----------------------------------------------------
// PERBAIKAN 1: PENCEGAHAN RENDER KOSONG PADA DASHBOARD
// -----------------------------------------------------
function renderActivityTable() {
    let scrollPositions = []; document.querySelectorAll('.scroll-saver').forEach(el => scrollPositions.push(el.scrollTop));
    const selKelas = document.getElementById('filter-kelas').value; const selMapel = document.getElementById('filter-mapel').value;
    
    // BUKAN return diam-diam, tapi gambar kerangka kosong jika tidak ada data dari server
    if (!allActivityData || allActivityData.length === 0) {
        document.getElementById('monitor-container').innerHTML = `<div class="text-center p-8 text-slate-400 font-bold bg-white rounded-xl border border-dashed"><i class="fa fa-folder-open text-3xl mb-2"></i><br>Belum ada aktivitas siswa saat ini.</div>`;
        return;
    }

    let filtered = (allActivityData || []).filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); });
    
    let blocked = filtered.filter(a => a.status && a.status.includes('Curang'));
    let finished = filtered.filter(a => a.status === 'Selesai');
    let working = filtered.filter(a => a.status === 'Mengerjakan' || (!a.status.includes('Curang') && a.status !== 'Selesai'));

    document.getElementById('stat-kerja').innerText = working.length; document.getElementById('stat-selesai').innerText = finished.length; document.getElementById('stat-curang').innerText = blocked.length;
    working.sort((a,b) => (parseFloat(String(b.score).split('|')[0])||0) - (parseFloat(String(a.score).split('|')[0])||0));
    finished.sort((a,b) => (parseFloat(String(b.score).split('|')[0])||0) - (parseFloat(String(a.score).split('|')[0])||0));

    let html = '';
    const renderTableGroup = (title, icon, titleColorClass, dataArray, rowColorClass, textClass, badgeClass, isWorking) => {
        if(dataArray.length === 0) return '';
        let rows = dataArray.map(a => {
            let aksiBtn = '';
            if(a.status && a.status.includes('Curang')) { 
                let berhakBuka = false; if (activeUser.role.toLowerCase() === 'admin') { berhakBuka = true; } else if (activeUser.mapel) { let allowed = activeUser.mapel.split(',').map(m => m.trim().toLowerCase()); let exName = (a.exam_name || '').trim().toLowerCase(); berhakBuka = allowed.some(m => exName.includes(m) || m.includes(exName)); }
                if(berhakBuka) { aksiBtn = `<br><button onclick="resetSiswa('${a.student_name.replace(/'/g, "\\'")}', '${a.exam_name.replace(/'/g, "\\'")}')" class="mt-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[8px] shadow cursor-pointer"><i class="fa fa-unlock"></i> Buka Akses</button>`; } else { aksiBtn = `<br><span class="mt-1 inline-block bg-slate-200 text-slate-500 px-2 py-1 rounded text-[8px]"><i class="fa fa-lock"></i> Lock</span>`; }
            }
            let skorMentah = a.score !== null && a.score !== undefined ? String(a.score) : '-'; let nilaiTampil = skorMentah.includes('|') ? skorMentah.split('|')[0].trim() : skorMentah;
            let skorTampil = (isWorking && a.status === 'Mengerjakan' && a.score) ? `<span class="text-blue-600 font-bold"><i class="fa fa-chart-line"></i> Live: ${nilaiTampil}</span>` : ((isWorking && a.status === 'Mengerjakan') ? `-` : nilaiTampil);
            let durasiFinal = '-'; let jamUpdate = a.last_seen || '-';
            if (a.last_seen && a.last_seen.includes('(')) { let parts = a.last_seen.split(' ('); jamUpdate = parts[0]; let dText = parts[1].replace(')', ''); if(dText.includes('|')) { let subParts = dText.split('|'); durasiFinal = `<span class="font-bold text-slate-700"><i class="fa fa-clock text-slate-400 mr-1"></i> ${subParts[0].trim()}</span><br><span class="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mt-1 inline-block"><i class="fa fa-tasks"></i> Progress: ${subParts[1].trim()}</span>`; } else { durasiFinal = `<span class="font-bold text-slate-700"><i class="fa fa-clock text-slate-400 mr-1"></i> ${dText}</span>`; } } else if (a.status === 'Mengerjakan') { durasiFinal = `<span class="font-bold text-orange-500"><i class="fa fa-clock fa-spin mr-1"></i> Baru mulai</span>`; }
            let hantuBtn = (isWorking && activeUser && activeUser.role.toLowerCase() === 'admin') ? `<button onclick="usirHantu(${a.id})" class="ml-2 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white px-2 py-1 rounded shadow-sm text-[8px]"><i class="fa fa-times"></i></button>` : '';

            return `<tr class="hover:bg-slate-50 border-b border-slate-100 ${rowColorClass}"><td class="p-2 md:p-3 font-bold ${textClass}">${a.student_name} ${hantuBtn} ${aksiBtn}<br><span class="text-[8px] md:text-[9px] text-slate-400">Kelas: ${a.kelas||'-'}</span></td><td class="p-2 md:p-3 font-medium">${a.exam_name}</td><td class="p-2 md:p-3"><span class="px-2 py-1 rounded-full text-[9px] md:text-[10px] font-bold ${badgeClass}">${a.status}</span></td><td class="p-2 md:p-3 font-black text-sm">${skorTampil}</td><td class="p-2 md:p-3">${durasiFinal}</td><td class="p-2 md:p-3 text-[9px] md:text-[10px] text-slate-500">${jamUpdate}</td></tr>`;
        }).join('');
        return `<div class="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white mb-4"><div class="p-2 md:p-3 text-[10px] md:text-xs font-black uppercase tracking-widest ${titleColorClass}"><i class="fa ${icon} mr-1"></i> ${title} <span class="float-right bg-white/80 px-2 py-0.5 rounded-full shadow-sm text-[9px] text-slate-700">${dataArray.length} Siswa</span></div><div class="overflow-x-auto"><div class="max-h-[40vh] overflow-y-auto scroll-saver"><table class="w-full text-left text-[10px] md:text-xs"><thead class="text-[8px] md:text-[9px] text-slate-500 uppercase sticky top-0 z-10 shadow-sm"><tr><th class="p-2 md:p-3 bg-slate-100">Nama Siswa / Aksi</th><th class="p-2 md:p-3 bg-slate-100">Ujian</th><th class="p-2 md:p-3 bg-slate-100">Status</th><th class="p-2 md:p-3 bg-slate-100">Skor</th><th class="p-2 md:p-3 bg-slate-100">Durasi / Progress</th><th class="p-2 md:p-3 bg-slate-100">Jam Update</th></tr></thead><tbody class="divide-y divide-slate-100 bg-white">${rows}</tbody></table></div></div></div>`;
    };

    html += renderTableGroup('Siswa Diblokir (Curang)', 'fa-ban', 'bg-red-50 text-red-600 border-b border-red-200', blocked, 'bg-red-50/30', 'text-red-700', 'bg-red-500 text-white animate-pulse', false);
    html += renderTableGroup('Sedang Mengerjakan (Live)', 'fa-spinner fa-spin', 'bg-blue-50 text-blue-600 border-b border-blue-200', working, '', 'text-slate-800', 'bg-blue-100 text-blue-700', true);
    html += renderTableGroup('Selesai Ujian (Final)', 'fa-check-circle', 'bg-emerald-50 text-emerald-600 border-b border-emerald-200', finished, '', 'text-slate-800', 'bg-emerald-100 text-emerald-700', false);
    document.getElementById('monitor-container').innerHTML = html || `<div class="text-center p-8 text-slate-400 font-bold bg-white rounded-xl border border-dashed">Belum ada aktivitas.</div>`; 
    document.querySelectorAll('.scroll-saver').forEach((el, index) => { if(scrollPositions[index]) el.scrollTop = scrollPositions[index]; });
}

function getKkmStorage() { try { return JSON.parse(localStorage.getItem('cbt_kkm_mapel') || '{}'); } catch(e) { return {}; } }
function handleMapelNilaiChange() { const selMapel = document.getElementById('filter-mapel-nilai').value; const kkmMap = getKkmStorage(); const inputKkm = document.getElementById('input-kkm-nilai'); if(selMapel && kkmMap[selMapel]) { inputKkm.value = kkmMap[selMapel]; } else { inputKkm.value = ''; } renderNilaiTable(); }
function updateKkmMapel(val) { const selMapel = document.getElementById('filter-mapel-nilai').value; if(!selMapel) { Swal.fire('Perhatian', 'Pilih Mapel dulu pada filter.', 'info'); document.getElementById('input-kkm-nilai').value = ''; return; } const kkmMap = getKkmStorage(); if(val && parseFloat(val) > 0) { kkmMap[selMapel] = parseFloat(val); } else { delete kkmMap[selMapel]; } localStorage.setItem('cbt_kkm_mapel', JSON.stringify(kkmMap)); renderNilaiTable(); }

async function loadNilai() { 
    const res = await fetch(API + '/admin/results' + getAuthParams()); const data = await res.json(); window.allResultsData = data || []; 
    if(document.getElementById('filter-kelas-nilai').options.length === 1) { 
        let kelasSet = new Set(); let mapelSet = new Set(); window.allResultsData.forEach(r => { if(r.kelas && r.kelas !== '-') kelasSet.add(r.kelas); if(r.mapel) mapelSet.add(r.mapel); }); 
        const fKelas = document.getElementById('filter-kelas-nilai'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); }); 
        const fMapel = document.getElementById('filter-mapel-nilai'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); }); 
    } renderNilaiTable(); 
}

function renderNilaiTable() { 
    const selKelas = document.getElementById('filter-kelas-nilai').value; const selMapel = document.getElementById('filter-mapel-nilai').value; const kkmMap = getKkmStorage();
    window.filteredResultsData = window.allResultsData.filter(r => { return (selKelas === "" || r.kelas === selKelas) && (selMapel === "" || r.mapel === selMapel); }); 
    
    document.getElementById('nilai-body').innerHTML = window.filteredResultsData.map(n => {
        let kkmLimit = 0; if(selMapel) { kkmLimit = kkmMap[selMapel] || 0; } else { for(let mKey in kkmMap) { if(n.mapel && n.mapel.includes(mKey)) { kkmLimit = kkmMap[mKey]; break; } } }
        let statusKetuntasan = '<span class="text-slate-400 font-medium italic">Belum di-set</span>';
        if (kkmLimit > 0) { statusKetuntasan = n.nilai >= kkmLimit ? '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black">TUNTAS</span>' : '<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-black">REMEDIAL</span>'; }
        return `<tr class="hover:bg-slate-50 transition border-b border-slate-100"><td class="p-3 font-semibold whitespace-normal min-w-[120px] md:min-w-[150px] leading-snug text-slate-800">${n.student_name} <br><span class="text-[9px] text-slate-400 font-medium">Kelas: ${n.kelas||'-'}</span></td><td class="p-3 text-slate-700 font-medium">${n.mapel}</td><td class="p-3 text-xs text-slate-500 font-medium">${(n.tanggal || '').includes('|') ? n.tanggal.split('|')[1] : '-'}</td><td class="p-3 text-center text-blue-600 font-bold">${n.benar || 0} B / ${n.salah || 0} S</td><td class="p-3 text-center font-black text-sm md:text-base text-blue-600">${n.nilai}</td><td class="p-3 text-center">${statusKetuntasan}</td><td class="p-3 text-center"><button onclick='lihatDetail(${JSON.stringify(n.detail_jawaban || "[]").replace(/'/g, "'")})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm"><i class="fa fa-eye mr-1"></i> Detail</button></td></tr>`;
    }).join(''); 
}

function exportExcelDetail() {
    if(window.filteredResultsData.length === 0) return Swal.fire('Kosong', 'Tidak ada data.', 'info');
    const kkmMap = getKkmStorage(); const selMapel = document.getElementById('filter-mapel-nilai').value;
    const dataToExport = window.filteredResultsData.map(n => {
        let kkmLimit = 0; if(selMapel) { kkmLimit = kkmMap[selMapel] || 0; } else { for(let mKey in kkmMap) { if(n.mapel && n.mapel.includes(mKey)) { kkmLimit = kkmMap[mKey]; break; } } }
        let isTuntas = 'Belum di-set KKM'; if (kkmLimit > 0) { isTuntas = n.nilai >= kkmLimit ? 'Tuntas' : 'Remedial'; }
        return { "Nama Siswa": n.student_name, "Kelas": n.kelas || '-', "Mata Pelajaran": n.mapel, "Waktu Selesai": (n.tanggal || '').includes('|') ? n.tanggal.split('|')[1] : '-', "Jawaban Benar": n.benar, "Jawaban Salah": n.salah, "Nilai Akhir": n.nilai, "Status KKM": isTuntas };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Hasil_Nilai"); XLSX.writeFile(wb, `Hasil_Ujian_CBT_Spenda.xlsx`);
}

function lihatDetail(detailJson) { let details = []; try { details = JSON.parse(detailJson); } catch(e) { details = []; } if(details.length === 0) return Swal.fire('Info', 'Bentuk GForm', 'info'); let html = details.map(d => { let coloredJawab = colorizeAnswer(d.jawab, d.kunci, d.tipe); let statusColor = d.status.includes('Benar') ? 'bg-emerald-100 text-emerald-700' : (d.status==='Salah' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'); return `<div class="bg-white p-3 md:p-4 rounded-xl border shadow-sm"><div class="flex justify-between items-start mb-2"><span class="font-bold text-slate-700 text-[10px] md:text-sm">Soal No. ${d.no}</span><span class="px-2 py-1 text-[9px] md:text-[10px] font-bold rounded-full ${statusColor}">${d.status} (Skor: ${d.poin})</span></div><div class="text-[10px] md:text-sm text-slate-600 mb-3 whitespace-pre-line leading-relaxed">${formatMath(d.tanya)}</div><div class="flex gap-2 md:gap-4 text-[9px] md:text-xs bg-slate-50 p-2 md:p-3 rounded-lg border border-slate-100"><div class="flex-1"><span class="text-slate-400 block mb-1">Jawaban Siswa:</span><span class="leading-relaxed">${coloredJawab}</span></div><div class="flex-1 border-l pl-2 md:pl-4"><span class="text-slate-400 block mb-1">Kunci Jawaban:</span><strong class="text-emerald-600 leading-relaxed">${formatMath((d.kunci||'-').replace(/, | \\ /g, '<br>'))}</strong></div></div></div>` }).join(''); document.getElementById('detail-content').innerHTML = html; document.getElementById('modal-detail').classList.remove('hidden'); applyMathRendering(); }

async function loadMaster() { document.getElementById('app-name-display').innerText = 'SMP Negeri 2 Soyo Jaya'; }

async function loadJadwal() { 
    const res = await fetch(API + '/admin/schedules' + getAuthParams()); const data = await res.json(); window.allSchedulesData = data || []; 
    document.getElementById('list-jadwal').innerHTML = window.allSchedulesData.map(j => { let tglJamArr = j.tanggal ? j.tanggal.split('|') : []; let tglTampil = tglJamArr[0] || j.tanggal; let jamTampil = tglJamArr[1] ? ` • Jam ${tglJamArr[1]}` : ''; let statusBadge = j.status === 'Aktif' ? '<span class="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[8px] font-bold">Aktif</span>' : '<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[8px] font-bold">Ditutup</span>'; return `<div class="bg-white p-3 md:p-4 rounded-xl border border-l-4 border-blue-500 shadow-sm flex justify-between items-center relative"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><h4 class="font-bold text-[10px] md:text-sm text-blue-900">${j.mapel}</h4> ${statusBadge}</div><p class="text-[8px] md:text-[10px] text-slate-400"><i class="fa fa-calendar-alt"></i> ${tglTampil}${jamTampil} • <i class="fa fa-clock"></i> ${j.durasi} Menit</p></div><div class="text-center px-3 md:px-4 border-l border-slate-100"><p class="text-[7px] md:text-[8px] font-bold text-slate-400">PIN UJIAN</p><p class="text-base md:text-lg font-black text-blue-600 font-mono tracking-widest">${j.pin}</p></div><div class="flex flex-col gap-1.5 pl-2 border-l border-slate-100"><button onclick="editJadwal(${j.id})" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1.5 rounded transition shadow-sm text-[10px] md:text-xs"><i class="fa fa-edit"></i></button><button onclick="hapusJadwal(${j.id})" class="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2 py-1.5 rounded transition shadow-sm text-[10px] md:text-xs"><i class="fa fa-trash"></i></button></div></div>`; }).join(''); 
    
    const resExams = await fetch(API + '/admin/available-exams' + getAuthParams()); const exams = await resExams.json(); 
    const containerMapel = document.getElementById('j_mapel_container');
    if(containerMapel) { containerMapel.innerHTML = (exams || []).map(e => `<label class="flex items-center space-x-2 cursor-pointer p-1 hover:bg-slate-200 rounded transition"><input type="checkbox" name="j_mapel_cb" value="${e}" class="w-4 h-4 text-blue-600 rounded accent-blue-600"><span class="font-semibold text-slate-700">${e}</span></label>`).join('') || '<span class="text-slate-400 italic">Belum ada paket bank soal</span>'; }
}

async function saveJadwal() { const checkedBoxes = Array.from(document.querySelectorAll('input[name="j_mapel_cb"]:checked')).map(cb => cb.value); if (checkedBoxes.length === 0) return Swal.fire('Oops', 'Centang minimal 1 Mata Pelajaran!', 'warning'); const mapel = checkedBoxes.join(', '); const tgl = document.getElementById('j_tgl').value; const jam = document.getElementById('j_jam').value; const durasi = document.getElementById('j_durasi').value; if(!tgl || !jam || !durasi) return Swal.fire('Oops', 'Lengkapi seluruh field!', 'warning'); await fetch(API + '/admin/add-schedule', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mapel, tanggal: `${tgl}|${jam}`, durasi }) }); loadJadwal(); }
function editJadwal(id) { const j = window.allSchedulesData.find(x => x.id === id); if(!j) return; let tglJamArr = j.tanggal ? j.tanggal.split('|') : []; let tgl = tglJamArr[0] || ''; let jam = tglJamArr[1] || ''; Swal.fire({ title: 'Edit Jadwal', html: `<div class="space-y-3 text-left"><div><label class="text-[10px] md:text-xs font-bold text-slate-500">Mapel / Kode Soal</label><input id=\"e_j_mapel\" class=\"w-full p-2 border rounded bg-slate-100 font-bold\" value=\"${j.mapel}\" readonly></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Tanggal Mulai</label><input type=\"date\" id=\"e_j_tgl\" class=\"w-full p-2 border rounded\" value=\"${tgl}\"></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Jam Mulai</label><input type=\"time\" id=\"e_j_jam\" class=\"w-full p-2 border rounded\" value=\"${jam}\"></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Durasi</label><input type=\"number\" id=\"e_j_durasi\" class=\"w-full p-2 border rounded font-bold\" value=\"${j.durasi}\"></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Status</label><select id=\"e_j_status\" class=\"w-full p-2 border rounded font-bold text-blue-700\"><option value=\"Aktif\" ${j.status==='Aktif'?'selected':''}>Aktif</option><option value=\"Ditutup\" ${j.status!=='Aktif'?'selected':''}>Ditutup</option></select></div></div>`, showCancelButton: true, preConfirm: () => { return { id: j.id, mapel: document.getElementById('e_j_mapel').value, tanggal: document.getElementById('e_j_tgl').value + '|' + document.getElementById('e_j_jam').value, durasi: document.getElementById('e_j_durasi').value, status: document.getElementById('e_j_status').value } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/update-schedule', {method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadJadwal(); } }); }

async function loadBankSoal() { const res = await fetch(API + '/admin/questions' + getAuthParams()); const data = await res.json(); if (!data || data.length === 0) { document.getElementById('banksoal-container').innerHTML = '<div class="text-center p-8 bg-white border rounded-xl">Belum ada soal.</div>'; return; } const groups = {}; data.forEach(q => { if(!groups[q.exam_id]) groups[q.exam_id] = []; groups[q.exam_id].push(q); }); let html = ''; for (const [examId, questions] of Object.entries(groups)) { let tableRows = questions.map(q => { let det = q.tipe === 'GFORM' ? `Link G-Form: ${q.tanya || q.gform_url}` : (q.tanya ? formatMath(q.tanya).substring(0,80)+'...' : '-'); det += `<br><span class="text-[10px] text-emerald-600 font-bold p-1 bg-emerald-50 rounded">KUNCI: ${formatMath(q.kunci) || '-'}</span>`; return `<tr class="hover:bg-slate-50 border-b"><td class="p-2 w-20"><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black">${q.tipe}</span></td><td class="p-2 text-xs">${det}</td><td class="p-2 text-right w-24"><button onclick="hapusSoal(${q.id})" class="text-red-500 border p-2 rounded-lg"><i class="fa fa-trash"></i></button></td></tr>`; }).join(''); html += `<div class="mb-3 bg-white border rounded-xl overflow-hidden"><div class="p-3 bg-slate-50 font-bold text-slate-700 flex justify-between items-center"><button onclick="document.getElementById('soal-${examId}').classList.toggle('hidden')" class="flex-1 text-left"><i class="fa fa-folder-open text-blue-500 mr-2"></i> ${examId} (${questions.length} Soal)</button><button onclick="hapusPaketSoal('${examId.replace(/'/g, "\\'")}')" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs">Hapus</button></div><div id="soal-${examId}" class="hidden overflow-x-auto"><table class="w-full text-left text-xs"><tbody class="divide-y">${tableRows}</tbody></table></div></div>`; } document.getElementById('banksoal-container').innerHTML = html; }
let questionCount = 1;
function tambahBarisSoal() { questionCount++; const container = document.getElementById('bulk-questions-container'); const html = `<div class="question-item bg-slate-50 p-4 rounded-2xl border relative mt-4" data-no="${questionCount}"><div class="absolute -left-3 -top-3 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center font-black shadow-lg text-xs">${questionCount}</div><button onclick="this.parentElement.remove()" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs shadow-md"><i class="fa fa-times"></i></button><div class="grid grid-cols-1 gap-3"><div class="grid grid-cols-1 md:grid-cols-3 gap-2"><div><label class="text-[10px] font-bold text-slate-500">TIPE SOAL</label><select class="q-tipe w-full p-2 border rounded-lg text-xs outline-none"><option value="PG">1 - Pilihan Ganda Biasa</option><option value="PGK">2 - PG Kompleks (Centang)</option><option value="JODOH">3 - Menjodohkan</option><option value="ISIAN">4 - Isian Singkat</option><option value="ESAI">5 - Uraian (Esai)</option><option value="BS">7 - Benar/Salah</option><option value="TS">9 - TS (Tabel Sesuai)</option><option value="SIFAT">10 - SIFAT</option><option value="GFORM">8 - Link G-Form</option></select></div><div><label class="text-[10px] font-bold text-slate-500">KUNCI JAWABAN</label><input type="text" class="q-kunci w-full p-2 border rounded-lg text-xs"></div><div><label class="text-[10px] font-bold text-blue-600">SKOR BOBOT</label><input type="number" class="q-skor w-full p-2 border bg-blue-50 rounded-lg text-xs font-bold" value="1"></div></div><div><label class="text-[10px] font-bold text-blue-500">LINK DRIVE GAMBAR</label><input type="text" class="q-image w-full p-2 border rounded-lg text-xs"></div><div><label class="text-[10px] font-bold text-slate-500">PERTANYAAN</label><textarea class="q-tanya w-full p-2 border rounded-lg text-xs h-16"></textarea></div><div class="q-area-opsi"><label class="text-[10px] font-bold text-orange-600">OPSI (Pemisah |||)</label><input type="text" class="q-opsi w-full p-2 border rounded-lg text-xs"></div></div></div>`; container.insertAdjacentHTML('beforeend', html); }
async function simpanSoalBulk() { const kodeUjian = document.getElementById('s_judul_bulk').value; if(!kodeUjian) return; const items = document.querySelectorAll('.question-item'); let dataSoal = []; items.forEach(el => { dataSoal.push({ exam_id: kodeUjian, tipe: el.querySelector('.q-tipe').value, tanya: el.querySelector('.q-tanya').value, opsi_json: el.querySelector('.q-opsi').value, kunci: el.querySelector('.q-kunci').value.toUpperCase(), gform_url: el.querySelector('.q-image').value, skor: parseFloat(el.querySelector('.q-skor').value) || 1 }); }); await fetch(API + '/admin/add-soal-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: dataSoal }) }); location.reload(); }

async function loadUsers() { const res = await fetch(API + '/admin/users'); const data = await res.json(); document.getElementById('user-body').innerHTML = (data || []).map(u => `<tr><td class="p-2 font-medium">${u.name}</td><td>${u.username}</td><td>${u.kelas || u.mapel || '-'}</td><td>${u.role}</td><td class="text-right p-2"><button onclick='editUser(${JSON.stringify(u)})' class="bg-blue-100 text-blue-600 px-2 py-1 rounded mr-1">Edit</button><button onclick="hapusUser('${u.username}')" class="bg-red-100 text-red-600 px-2 py-1 rounded">Hapus</button></td></tr>`).join(''); }
function tambahUserManual() { Swal.fire({ title: 'Tambah User', html: `<div class="space-y-3 text-left"><div><label class="text-xs font-bold text-slate-500">Nama</label><input id="a_name" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Username</label><input id="a_user" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Password</label><input id="a_pass" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Role</label><select id="a_role" class="w-full p-2 border rounded"><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="admin">Admin</option></select></div><div><label class="text-xs font-bold text-slate-500">Kelas</label><input id="a_kelas" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Mapel</label><input id="a_mapel" class="w-full p-2 border rounded"></div></div>`, showCancelButton: true, preConfirm: () => { return { name: document.getElementById('a_name').value, username: document.getElementById('a_user').value, password: document.getElementById('a_pass').value, role: document.getElementById('a_role').value, kelas: document.getElementById('a_kelas').value, mapel: document.getElementById('a_mapel').value } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/add-user', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } }); }
function editUser(u) { Swal.fire({ title: 'Edit User', html: `<div class="space-y-3 text-left"><div><label class="text-xs font-bold text-slate-500">Nama</label><input id="e_name" class="w-full p-2 border rounded" value="${u.name}"></div><div><label class="text-xs font-bold text-slate-500">Username</label><input id="e_user" class="w-full p-2 border rounded" value="${u.username}"></div><div><label class="text-xs font-bold text-slate-500">Password</label><input id="e_pass" class="w-full p-2 border rounded" value="${u.password}"></div><div><label class="text-xs font-bold text-slate-500">Role</label><select id="e_role" class="w-full p-2 border rounded"><option value="siswa" ${u.role==='siswa'?'selected':''}>Siswa</option><option value="guru" ${u.role==='guru'?'selected':''}>Guru</option></select></div><div><label class="text-xs font-bold text-slate-500">Kelas</label><input id="e_kelas" class="w-full p-2 border rounded" value="${u.kelas||''}"></div><div><label class="text-xs font-bold text-slate-500">Mapel</label><input id="e_mapel" class="w-full p-2 border rounded" value="${u.mapel||''}"></div></div>`, showCancelButton: true, preConfirm: () => { return { old_username: u.username, name: document.getElementById('e_name').value, username: document.getElementById('e_user').value, password: document.getElementById('e_pass').value, role: u.role, kelas: u.role === 'siswa' ? document.getElementById('e_kelas').value : '', mapel: u.role === 'guru' ? document.getElementById('e_kelas').value : '' } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/update-user', {method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } }); }

async function hapusUser(usr) { await fetch(API+'/admin/delete-user/'+usr, {method:'DELETE'}); loadUsers(); }
async function hapusJadwal(id) { await fetch(API+'/admin/delete-schedule/'+id, {method:'DELETE'}); loadJadwal(); }
async function hapusPaketSoal(examId) { await fetch(API + '/admin/delete-exam/' + encodeURIComponent(examId), {method: 'DELETE'}); loadBankSoal(); loadJadwal(); }
async function hapusSoal(id) { await fetch(API + '/admin/delete-question/' + id, {method: 'DELETE'}); loadBankSoal(); }
async function clearMonitoring() { await fetch(API + '/admin/clear-monitoring', {method:'DELETE'}); loadStats(); }
async function clearResults() { await fetch(API + '/admin/clear-results', {method:'DELETE'}); loadNilai(); loadStats(); }
async function clearSchedules() { await fetch(API + '/admin/clear-schedules', {method:'DELETE'}); loadJadwal(); }
async function clearQuestions() { await fetch(API + '/admin/clear-questions', {method:'DELETE'}); loadBankSoal(); }
async function clearUsers() { await fetch(API + '/admin/clear-users', {method:'DELETE'}); loadUsers(); }

// -------------------------------------------------------------------
// 5. FITUR EKSTRAKSI SOAL EXCEL & WORD YANG DIKEMBALIKAN
// -------------------------------------------------------------------

async function importExcelSoal() {
    const kodeUjian = document.getElementById('ex_judul').value;
    const fileInput = document.getElementById('ex_file');
    const file = fileInput.files[0];

    if (!kodeUjian) return Swal.fire('Oops', 'Isi Kode Ujian dulu!', 'warning');
    if (!file) return Swal.fire('Oops', 'Pilih file Excel dulu!', 'warning');

    Swal.fire({ title: 'Membaca File...', didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

            let questions = [];
            rawData.forEach(row => {
                let cleanRow = {};
                for (let key in row) { cleanRow[key.trim().toLowerCase()] = String(row[key]).trim(); }

                let tanya = cleanRow['pertanyaan'] || cleanRow['soal'] || cleanRow['tanya'] || '';
                let tipe = cleanRow['tipe'] || cleanRow['jenis'] || cleanRow['type'] || 'PG';
                let opsi = cleanRow['opsi'] || cleanRow['pilihan'] || cleanRow['opsi_json'] || '';
                let kunci = cleanRow['kunci'] || cleanRow['jawaban'] || cleanRow['kunci_jawaban'] || '';
                let skor = parseFloat(cleanRow['skor'] || cleanRow['bobot']) || 1;
                let img = cleanRow['gambar'] || cleanRow['link'] || cleanRow['gform_url'] || '';

                if (tanya || img) {
                    questions.push({
                        exam_id: kodeUjian, tipe: tipe.toUpperCase(), tanya: tanya,
                        opsi_json: opsi, kunci: kunci.toUpperCase(), skor: skor, gform_url: img
                    });
                }
            });

            if (questions.length === 0) return Swal.fire('Gagal', 'Tidak ada soal ditemukan atau header kolom tidak sesuai.', 'error');

            Swal.fire({ title: 'Menyimpan Soal...', didOpen: () => Swal.showLoading() });
            const res = await fetch(API + '/admin/add-soal-bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions })
            });
            const result = await res.json();
            if (result.status === 'success') {
                Swal.fire('Sukses!', `${questions.length} Soal berhasil dimasukkan ke Bank Soal!`, 'success');
                loadBankSoal(); fileInput.value = ''; document.getElementById('ex_judul').value = '';
            } else { Swal.fire('Gagal', result.message, 'error'); }
        } catch (err) { Swal.fire('Error Lokal', err.message, 'error'); }
    };
    reader.readAsArrayBuffer(file);
}

function importWord() {
    const kodeUjian = document.getElementById('w_judul').value.trim();
    const fileInput = document.getElementById('w_file');
    const file      = fileInput.files[0];

    if (!kodeUjian) return Swal.fire('Oops', 'Isi Kode Ujian terlebih dahulu!', 'warning');
    if (!file)      return Swal.fire('Oops', 'Pilih file Word (.docx) terlebih dahulu!', 'warning');

    Swal.fire({ title: 'Mengekstrak & Memproses Soal...', didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = function(event) {
        if (typeof mammoth === 'undefined') {
            return Swal.fire('Error', 'Library ekstrak Word belum termuat. Pastikan koneksi internet stabil lalu refresh halaman.', 'error');
        }
        mammoth.extractRawText({ arrayBuffer: event.target.result })
            .then(function(result) {
                const rawText   = result.value;
                const questions = parseWordSoal(rawText, kodeUjian);

                if (questions.length === 0) {
                    return Swal.fire({
                        title: 'Gagal Parsing Otomatis',
                        html: `<p class="text-xs text-red-600 font-bold mb-3">
                                 Sistem tidak dapat mendeteksi soal secara otomatis.<br>
                                 Pastikan format file Word sesuai panduan di bawah ini:
                               </p>
                               <div class="text-left bg-slate-100 p-3 rounded text-[11px] font-mono mb-3 leading-loose">
                                 <b>1. Pertanyaan soal nomor 1?</b><br>
                                 A. Pilihan A<br>B. Pilihan B<br>C. Pilihan C<br>D. Pilihan D<br>
                                 <b class="text-emerald-700">Kunci: A</b><br><br>
                                 <b>2. Pertanyaan soal nomor 2?</b><br>
                                 A. ...<br><b class="text-emerald-700">Kunci: B</b>
                               </div>
                               <p class="text-[10px] text-slate-500 font-bold mb-1">Cuplikan teks yang diekstrak:</p>
                               <textarea class="w-full h-28 p-2 border rounded text-[10px] outline-none bg-white font-mono" readonly>${rawText.substring(0, 600)}</textarea>`,
                        width: '85%', confirmButtonColor: '#3085d6', confirmButtonText: 'Tutup'
                    });
                }

                Swal.fire({
                    title: `<span class="text-emerald-600">${questions.length} Soal Terdeteksi!</span>`,
                    html:  `<p class="text-xs text-slate-500 mb-3">
                              Pratinjau <b>${Math.min(questions.length, 3)}</b> soal pertama &mdash;
                              kode ujian: <b>${kodeUjian}</b>
                            </p>
                            <div class="text-left bg-slate-50 p-3 rounded-lg max-h-52 overflow-y-auto text-xs space-y-3 border">
                              ${questions.slice(0, 3).map((q, i) =>
                                  `<div class="border-b border-slate-200 pb-2">
                                     <span class="bg-blue-100 text-blue-700 font-bold text-[9px] px-2 py-0.5 rounded mr-1">${q.tipe}</span>
                                     <b>No.${i + 1}</b> ${q.tanya.substring(0, 100)}${q.tanya.length > 100 ? '&hellip;' : ''}<br>
                                     <span class="text-slate-400 text-[10px]">Opsi: ${q.opsi_json ? q.opsi_json.replace(/\|\|\|/g, ' | ').substring(0, 60) : '-'}</span><br>
                                     <span class="text-emerald-600 font-bold text-[10px]">Kunci: ${q.kunci || '-'}</span>
                                   </div>`
                              ).join('')}
                            </div>
                            <p class="text-[10px] text-slate-400 mt-2">Total <b>${questions.length}</b> soal akan disimpan ke bank soal.</p>`,
                    icon: 'question', width: '88%',
                    showCancelButton: true,
                    confirmButtonText : `Simpan ${questions.length} Soal Sekarang`,
                    cancelButtonText  : 'Batal',
                    confirmButtonColor: '#2563eb'
                }).then(async (confirm) => {
                    if (!confirm.isConfirmed) return;
                    Swal.fire({ title: 'Menyimpan ke Bank Soal...', didOpen: () => Swal.showLoading() });
                    try {
                        const res = await fetch(API + '/admin/add-soal-bulk', {
                            method : 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body   : JSON.stringify({ questions })
                        });
                        const data = await res.json();
                        if (data.status === 'success') {
                            Swal.fire('Sukses!', `${questions.length} soal berhasil disimpan ke Bank Soal dengan kode ujian "${kodeUjian}"!`, 'success');
                            loadBankSoal();
                            fileInput.value = '';
                            document.getElementById('w_judul').value = '';
                        } else {
                            Swal.fire('Gagal Menyimpan', data.message || 'Terjadi kesalahan pada server.', 'error');
                        }
                    } catch (err) {
                        Swal.fire('Error Koneksi', 'Gagal terhubung ke server: ' + err.message, 'error');
                    }
                });
            })
            .catch(function(err) {
                Swal.fire('Gagal Membaca File',
                    'Format tidak didukung. Pastikan berekstensi .docx (bukan .doc). Detail: ' + err.message, 'error');
            });
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// PARSER SOAL DARI TEKS WORD
// ============================================================
// Format yang didukung (umum digunakan guru Indonesia):
//
//   1. Pertanyaan?        <- nomor + titik/kurung
//   1) Pertanyaan?
//   A. Pilihan A          <- opsi A–E dengan titik/kurung
//   A) Pilihan A
//   Kunci: A              <- berbagai variasi penulisan kunci
//   Jawaban: A
//   Skor: 2               <- opsional, default 1
// ============================================================
function parseWordSoal(rawText, kodeUjian) {
    const lines = rawText
        .replace(/\uFEFF/g, '')
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const questions = [];

    // Nomor soal: "1." / "1)" / "1 ." — minimal 3 karakter teks sesudahnya
    const rSoal  = /^(\d{1,3})\s*[.)]\s+(.{3,})/;
    // Opsi jawaban: "A." / "A)" / "a." — huruf A–E
    const rOpsi  = /^([A-Ea-e])\s*[.)]\s+(.+)/;
    // Kunci jawaban — berbagai variasi guru
    const rKunci = /^(?:kunci\s*(?:jawaban)?|jawaban(?:\s*benar)?|jwb|ans(?:wer)?)\s*[:\-=]?\s*([A-Ea-e,\s]+)\s*$/i;
    // Skor opsional
    const rSkor  = /^(?:skor|bobot|nilai|poin|point)\s*[:\-=]\s*(\d+(?:[.,]\d+)?)\s*$/i;

    let soal  = null;
    let opsi  = [];
    let kunci = '';
    let skor  = 1;

    function flush() {
        if (!soal || !soal.tanya.trim()) return;
        const tipe = _detectTipe(opsi, kunci);
        questions.push({
            exam_id  : kodeUjian,
            tipe     : tipe,
            tanya    : soal.tanya.trim(),
            opsi_json: opsi.map(o => o.text).join('|||'),
            kunci    : kunci.trim().toUpperCase().replace(/\s+/g, ''),
            skor     : skor,
            gform_url: ''
        });
        soal = null; opsi = []; kunci = ''; skor = 1;
    }

    function _detectTipe(opsiArr, kunciStr) {
        if (opsiArr.length === 0) return 'ESAI';
        const kArr = kunciStr.replace(/\s/g, '').split(',').filter(k => k);
        if (kArr.length > 1) return 'PGK';
        if (opsiArr.length === 2) {
            const t = opsiArr.map(o => o.text.toLowerCase().trim());
            const bs = (t.some(x => x === 'benar' || x === 'b' || x === 'true')) &&
                       (t.some(x => x === 'salah' || x === 's' || x === 'false'));
            if (bs) return 'BS';
        }
        return 'PG';
    }

    for (let i = 0; i < lines.length; i++) {
        const line  = lines[i];
        const mSoal = line.match(rSoal);
        const mOpsi = line.match(rOpsi);
        const mKunci= line.match(rKunci);
        const mSkor = line.match(rSkor);

        if (mSoal) {
            flush();
            soal = { tanya: mSoal[2] };
        } else if (mKunci && soal) {
            kunci = mKunci[1];
        } else if (mOpsi && soal && !kunci) {
            opsi.push({ label: mOpsi[1].toUpperCase(), text: mOpsi[2].trim() });
        } else if (mSkor && soal) {
            skor = parseFloat(mSkor[1].replace(',', '.')) || 1;
        } else if (soal && opsi.length === 0 && !kunci && !mOpsi) {
            // Baris sambungan pertanyaan multi-baris
            soal.tanya += ' ' + line;
        }
    }
    flush();
    return questions;
}

// ===== IMPORT EXCEL/CSV FUNCTIONS UNTUK MANAJEMEN USER (JANGAN DIHAPUS) =====
function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    return lines.slice(1).map(line => {
        const values = []; let cur = ''; let inQ = false;
        for (let ch of line) {
            if (ch === '"') { inQ = !inQ; } 
            else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; } 
            else { cur += ch; }
        }
        values.push(cur.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/"/g, '').trim(); });
        return row;
    }).filter(r => Object.values(r).some(v => v));
}

function downloadTemplate(type) {
    let csv, filename;
    if (type === 'siswa') {
        csv = `username,nama,password,kelas\nsisswa001,Andi Putra,Password123,7A\nsisswa002,Budi Santoso,Password123,7A\nsisswa003,Citra Dewi,Password123,7B`;
        filename = 'TEMPLATE_SISWA.csv';
    } else {
        csv = `username,nama,password,mapel_kelas\nguru001,Pak Budi,Password123,"MTK-7A,MTK-7B"\nguru002,Bu Ani,Password123,"IPA-7A,IPA-8A"\nguru003,Pak Candra,Password123,"MTK-8A,IPA-8B"`;
        filename = 'TEMPLATE_GURU.csv';
    }
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

async function prosesImport(type) {
    const fileInput = document.getElementById('file-' + type);
    const previewEl = document.getElementById('preview-' + type);
    const file = fileInput ? fileInput.files[0] : null;
    if (!file) return Swal.fire('Pilih File Dulu', 'Pilih file CSV atau XLSX terlebih dahulu.', 'warning');

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let rawData = [];
            const name = file.name.toLowerCase();
            const content = event.target.result;

            if (name.endsWith('.csv')) {
                rawData = parseCSV(content);
            } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                if (typeof XLSX === 'undefined') return Swal.fire('Error', 'Library XLSX belum siap. Refresh halaman.', 'error');
                const wb = XLSX.read(new Uint8Array(content), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });
                rawData = rawData.map(row => { const r = {}; for(const [k,v] of Object.entries(row)) r[k.trim().toLowerCase()] = String(v).trim(); return r; });
            } else {
                return Swal.fire('Format Salah', 'Hanya .csv, .xlsx, atau .xls.', 'error');
            }

            const data = rawData.filter(r => (r.username || r.nis) && (r.nama || r.name) && r.password);
            if (data.length === 0) return Swal.fire('Data Kosong', 'Pastikan kolom username, nama, password ada dan terisi.', 'error');

            if (previewEl) {
                previewEl.className = 'text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2 mt-1';
                previewEl.innerHTML = `✓ File terbaca: <strong>${data.length} baris</strong>. Klik GENERATE untuk menyimpan.`;
            }

            const confirm = await Swal.fire({
                title: `Simpan ${data.length} ${type}?`,
                html: `<div style="text-align:left;font-size:12px"><p>File: <b>${file.name}</b></p><p>Data: <b>${data.length} baris</b></p><div style="margin-top:8px;background:#f5f5f5;padding:8px;border-radius:6px;font-family:monospace;font-size:11px">${JSON.stringify(data[0], null, 2)}</div></div>`,
                icon: 'question', showCancelButton: true,
                confirmButtonText: '✓ Ya, Simpan Sekarang', cancelButtonText: 'Batal', confirmButtonColor: '#059669'
            });
            if (!confirm.isConfirmed) return;

            Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
            const endpoint = type === 'siswa' ? '/api/admin/import-siswa' : '/api/admin/import-guru';
            const res = await fetch(API + endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({data}) });
            const result = await res.json();
            if (result.status === 'success') {
                fileInput.value = '';
                if (previewEl) { previewEl.className = 'text-[10px] text-slate-400 hidden'; }
                loadUsers();
                Swal.fire('Berhasil!', `${result.imported} ${type} berhasil disimpan.`, 'success');
            } else {
                Swal.fire('Gagal', result.message || 'Terjadi kesalahan.', 'error');
            }
        } catch(err) { Swal.fire('Error', err.message, 'error'); }
    };
    if (file.name.toLowerCase().endsWith('.csv')) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
}

setInterval(() => { if(activeUser && activeUser.role !== 'siswa' && !document.getElementById('page-dashboard').classList.contains('hidden')) loadStats(); }, 3000);