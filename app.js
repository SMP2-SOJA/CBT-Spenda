// CBT APP ENGINE - Copyright (c) | @spenda-digi
const API = "/api";
let activeUser = null; 
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
    return text.replace(/\^\((.*?)\)/g, '<sup>$1</sup>')
               .replace(/\^([a-zA-Z0-9]+)/g, '<sup>$1</sup>')
               .replace(/_\((.*?)\)/g, '<sub>$1</sub>')
               .replace(/_([a-zA-Z0-9]+)/g, '<sub>$1</sub>');
}

// LIVE PUBLIC SCORE PANEL
async function showPublicScore() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-public-score').classList.remove('hidden');
    document.getElementById('view-public-score').classList.add('flex');
    await loadPublicData();
    publicInterval = setInterval(loadPublicData, 5000);
}

function keluarPublic() {
    clearInterval(publicInterval);
    document.getElementById('view-public-score').classList.add('hidden');
    document.getElementById('view-public-score').classList.remove('flex');
    document.getElementById('view-login').classList.remove('hidden');
}

async function loadPublicData() {
    try {
        const res = await fetch(API + '/admin/recent-activity');
        publicActivityData = await res.json();
        
        if(document.getElementById('pub-filter-kelas').options.length === 1) {
            let kelasSet = new Set(); let mapelSet = new Set();
            publicActivityData.forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); });
            const fKelas = document.getElementById('pub-filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); });
            const fMapel = document.getElementById('pub-filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); });
        }
        renderPublicTable();
    } catch(e) { console.log("Gagal memuat live score publik"); }
}

function renderPublicTable() {
    const selKelas = document.getElementById('pub-filter-kelas').value; 
    const selMapel = document.getElementById('pub-filter-mapel').value;
    let filtered = publicActivityData.filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); });
    filtered.sort((a,b) => (parseFloat(String(b.score).split('|')[0])||0) - (parseFloat(String(a.score).split('|')[0])||0));

    let html = filtered.map(a => {
        let badge = a.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : (a.status.includes('Curang') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700');
        let skorMentah = a.score !== null && a.score !== undefined ? String(a.score) : '-';
        let nilaiTampil = skorMentah.includes('|') ? skorMentah.split('|')[0].trim() : skorMentah;

        return `<tr class="hover:bg-slate-50"><td class="p-2 md:p-3 font-bold text-slate-800">${a.student_name}</td><td class="p-2 md:p-3 font-medium text-slate-600">${a.kelas||'-'} <br><span class="text-[9px]">${a.exam_name}</span></td><td class="p-2 md:p-3 text-center"><span class="px-2 py-1 rounded text-[9px] font-bold ${badge}">${a.status}</span></td><td class="p-2 md:p-3 text-center font-black text-sm text-blue-600">${nilaiTampil}</td></tr>`;
    }).join('');

    document.getElementById('public-table-body').innerHTML = html || `<tr><td colspan="4" class="text-center p-4 text-slate-400">Belum ada data nilai langsung.</td></tr>`;
}

// INTERFACES CONTROLLER
function getAuthParams() { return !activeUser ? "" : `?role=${encodeURIComponent(activeUser.role)}&mapel=${encodeURIComponent(activeUser.mapel || '')}`; }
// Memperbaiki pemanggilan sidebar admin agar tidak error saat element tidak ada
function toggleAdminSidebar() { 
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('admin-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full'); 
        overlay.classList.toggle('hidden'); 
    }
}
function toggleCbtNav() { document.getElementById('cbt-nav-panel').classList.toggle('translate-x-full'); document.getElementById('cbt-nav-overlay').classList.toggle('hidden'); }
function togglePass(inputId, iconId) { const passInput = document.getElementById(inputId); const icon = document.getElementById(iconId); if(passInput.type === 'password') { passInput.type = 'text'; icon.classList.replace('fa-eye-slash', 'fa-eye'); } else { passInput.type = 'password'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } }

// ANTI CHEATING & LOCK SYSTEMS
document.addEventListener('keyup', (e) => { if (isExamActive && (e.key === 'PrintScreen' || e.keyCode === 44)) { navigator.clipboard.writeText(''); Swal.fire('Akses Dilarang!', 'Tangkapan layar tidak diizinkan!', 'warning'); } });
document.addEventListener('keydown', function(e) { if(isExamActive && (e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); } });
document.addEventListener('fullscreenchange', () => { if (isExamActive && !document.fullscreenElement) deteksiKecurangan(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === 'hidden') deteksiKecurangan(); });
window.addEventListener("blur", () => { deteksiKecurangan(); });

function deteksiKecurangan() {
    if (!isExamActive || !navigator.onLine) return;
    curangCount++; 
    fetch(API + '/siswa/flag-curang', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, count: curangCount}) });
    if (curangCount >= 3) { isExamActive = false; Swal.fire({title: 'UJIAN DIBATALKAN!', text: 'Anda terdeteksi keluar dari layar ujian lebih dari 3 kali. Terkunci!', icon: 'error', allowOutsideClick: false}).then(() => { submitUjian(false, true); }); } else { Swal.fire('PERINGATAN KECURANGAN!', `Dilarang meminimalkan layar/membuka tab lain! (Peringatan ${curangCount}/3)`, 'warning'); }
}

window.addEventListener('offline', () => { const el = document.getElementById('network-status'); if(el) { el.innerText = 'OFFLINE'; el.classList.replace('bg-emerald-500', 'bg-red-500'); } });
window.addEventListener('online', () => { const el = document.getElementById('network-status'); if(el) { el.innerText = 'ONLINE'; el.classList.replace('bg-red-500', 'bg-emerald-500'); } checkPendingSubmit(); });

// CORE LOGIN EXECUTOR
async function prosesLogin() {
    const user = document.getElementById('login-user').value; const pass = document.getElementById('login-pass').value;
    if(!user || !pass) return Swal.fire('Oops', 'Wajib diisi!', 'warning'); Swal.fire({ title: 'Otentikasi...', didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(API + '/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: user, password: pass}) }); const data = await res.json();
        if (data.status === "success") {
            activeUser = data.user; Swal.close(); document.getElementById('view-login').classList.add('hidden');
            if (activeUser.role.toLowerCase() === 'siswa') { document.getElementById('view-siswa-token').classList.remove('hidden'); document.getElementById('nama-siswa-welcome').innerText = activeUser.name; checkPendingSubmit(false); } 
            else { 
                document.getElementById('view-admin').classList.remove('hidden'); 
                if (activeUser.role.toLowerCase() === 'guru') { 
                    document.getElementById('menu-users').classList.add('hidden'); 
                    document.getElementById('menu-jadwal').classList.add('hidden'); 
                    document.getElementById('role-badge').classList.remove('hidden'); 
                    document.getElementById('role-badge').innerText = `GURU: ${activeUser.mapel || 'Semua Mapel'}`; 
                } 
                loadMaster(); showPage('dashboard'); 
            }
        } else Swal.fire('Gagal', data.message, 'error');
    } catch (e) { Swal.fire('Error', 'Server mati.', 'error'); }
}
function logout() { location.reload(); }

// STUDENT ENGINE
function saveToLocal() { if(currentExam && activeUser) localStorage.setItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`, JSON.stringify(cbtAnswers)); }
function loadFromLocal() { if(currentExam && activeUser) { const saved = localStorage.getItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); if(saved) cbtAnswers = JSON.parse(saved); } }

async function mulaiUjian() {
    const pin = document.getElementById('input-pin').value; if(!pin) return Swal.fire('Error', 'PIN!', 'warning'); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading() });
    try {
        const clientDate = new Date().toLocaleDateString('en-CA'); const clientTime = new Date().toTimeString().substring(0,5); 
        const res = await fetch(API + '/siswa/cek-pin', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pin: pin, student_name: activeUser.name, client_date: clientDate, client_time: clientTime}) }); const data = await res.json();
        
        if(data.status === "success") {
            currentExam = data.exam; const resSoal = await fetch(API + '/siswa/get-soal', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({exam_id: currentExam.mapel}) }); const dataSoal = await resSoal.json();
            if(!dataSoal.questions || dataSoal.questions.length === 0) return Swal.fire('Oops', 'Kosong!', 'error');
            document.getElementById('view-siswa-token').classList.add('hidden'); document.getElementById('view-siswa-ujian').classList.remove('hidden');
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
            cbtQuestions = dataSoal.questions; cbtAnswers = new Array(cbtQuestions.length).fill(null).map(() => ({ ans: '' })); cbtCurrentIndex = 0;
            
            let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`;
            localStorage.setItem(startTimeKey, Date.now()); 
            loadFromLocal(); startTimer(currentExam.durasi || 60); renderCbtGrid(); showCbtQuestion(0); curangCount = 0; isExamActive = true; Swal.close();
        } else Swal.fire('Gagal', data.message, 'error');
    } catch(e) { Swal.fire('Error', 'Terputus', 'error'); }
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
    let totalMax = 0; let totalGet = 0;
    cbtQuestions.forEach((q, index) => {
        let ans = cbtAnswers[index]?.ans || ""; let bobot = q.skor ? parseFloat(q.skor) : 1; totalMax += bobot;
        if(!ans || ans === "" || (ans.indexOf('-') !== -1 && (q.tipe==='BS'||q.tipe==='TS'||q.tipe==='SIFAT'))) return;
        let kArr, aArr, betul=0;
        if (q.tipe === 'PG') { if(ans.replace(/\s/g, '').toLowerCase() === (q.kunci||"").replace(/\s/g, '').toLowerCase()) totalGet += bobot; } 
        else if (q.tipe === 'PGK') { kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); if(kArr.length>0) { aArr.forEach(a => { if(kArr.includes(a)) betul++; }); totalGet += (betul / kArr.length) * bobot; } } 
        else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { kArr = (q.kunci||"").replace(/\s/g, '').toUpperCase().split(',').filter(x=>x); if ((q.tipe === 'BS' || q.tipe === 'TS') && kArr.some(k => k === 'S')) { kArr = kArr.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k)); } aArr = ans.replace(/\s/g, '').toUpperCase().split(','); for(let j=0; j<kArr.length; j++) { if(aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== "") betul++; } if(kArr.length>0) totalGet += (betul / kArr.length) * bobot; } 
        else if (q.tipe === 'JODOH') { kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); kArr.forEach(k => { if(aArr.includes(k)) betul++; }); if(kArr.length>0) totalGet += (betul / kArr.length) * bobot; } 
        else if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') { kArr = (q.kunci || "").toLowerCase().match(/[a-z0-9]+/gi) || []; aArr = ans.toLowerCase().match(/[a-z0-9]+/gi) || []; if(kArr.length>0) { let aWordsUnique = [...new Set(aArr)]; kArr.forEach(kw => { if(aWordsUnique.includes(kw)) betul++; }); totalGet += (betul / kArr.length) * bobot; } }
    });
    return totalMax > 0 ? Math.round((totalGet / totalMax) * 100) : 0;
}

setInterval(() => {
    if (isExamActive && navigator.onLine) {
        let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; let start = localStorage.getItem(startTimeKey);
        if (start) { 
            let diffMs = Date.now() - parseInt(start); let dMins = Math.floor(diffMs / 60000); let dSecs = Math.floor((diffMs % 60000) / 1000); 
            let terjawab = 0; let totalSoal = cbtQuestions.length;
            for(let i=0; i<totalSoal; i++){
                let a = cbtAnswers[i]?.ans || ""; let q = cbtQuestions[i]; if(a === "") continue;
                if((q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') && a.indexOf('-') !== -1) continue;
                if(q.tipe === 'JODOH' && a.split(',').length < (q.kunci||"").split(',').length) continue;
                terjawab++;
            }
            let durasiTeks = `${dMins}m ${dSecs}s | ${terjawab}/${totalSoal} Soal`; let lScore = getLiveScore(); 
            fetch(API + '/siswa/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, durasi: durasiTeks, live_score: lScore}) }).catch(e=>console.log(e)); 
        }
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
    if(imgUrl && imgUrl.includes('drive.google.com')) { 
        let idMatch = imgUrl.match(/[?&]id=([^&]+)/) || imgUrl.match(/\/d\/([^\/]+)/); 
        if(idMatch && idMatch[1]) { imgUrl = `https://lh3.googleusercontent.com/d/${idMatch[1]}=s1200`; fallbackUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`; } 
    }
    if (imgUrl && q.tipe !== 'GFORM' && imgUrl.startsWith('http')) { 
        divMedia.innerHTML = `<img src="${imgUrl}" ${fallbackUrl ? `onerror="if(this.src !== '${fallbackUrl}') this.src='${fallbackUrl}';"` : ''} class="w-auto max-w-full h-auto max-h-[60vh] rounded-xl border shadow-sm mx-auto mb-3 md:mb-4 object-contain">`; 
    }
    
    if(q.tipe === 'GFORM') { divOpsi.innerHTML = `<div class="gform-container"><iframe src="${q.tanya || q.gform_url}"></iframe></div>`; cbtSaveAnswer("COMPLETED"); } 
    else {
        let htmlOpsi = ""; let opsiArray = q.opsi_json ? q.opsi_json.split(/\|\|\|/).map(o=>o.trim()).filter(o=>o) : []; const abjad = ['A', 'B', 'C', 'D', 'E', 'F'];
        if (q.tipe === 'JODOH') {
            let lines = (q.tanya||"").split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(l => l); let premises = []; let mainTanya = []; lines.forEach(l => { if (/^\d+[\.\)]\s?/.test(l)) premises.push(l); else mainTanya.push(l); }); divTanya.innerHTML = formatMath(mainTanya.join('<br>')); 
            let totalPairs = q.kunci ? q.kunci.split(',').length : (premises.length || 4); let savedArr = savedAns ? savedAns.split(',') : [];
            htmlOpsi += `<div class="bg-blue-50 p-3 md:p-4 rounded-xl border border-blue-200 mt-2 mb-3 md:mb-4"><p class="text-[10px] md:text-xs font-bold text-blue-800 mb-2 md:mb-3"><i class="fa fa-mouse-pointer"></i> JODOHKAN PERNYATAAN:</p><div class="space-y-2 md:space-y-3">`;
            for(let i=0; i<totalPairs; i++) { let currentSaved = savedArr[i] ? savedArr[i].replace(/[0-9]/g, '') : ''; let labelText = premises[i] ? premises[i] : `Pasangan No. ${i+1}`; htmlOpsi += `<div class="flex flex-col md:flex-row items-start md:items-center justify-between p-2 md:p-3 bg-white border border-blue-100 rounded-lg shadow-sm gap-2"><span class="font-bold text-slate-700 text-[10px] md:text-sm md:w-1/2 leading-snug">${formatMath(labelText)}</span><select class="jodoh-select p-2 md:p-3 border-2 border-emerald-300 rounded-lg text-[10px] md:text-sm font-bold text-emerald-800 bg-emerald-50 outline-none w-full md:w-1/2" onchange="cbtSaveJodoh(${totalPairs})"><option value="">- Pilih Jawaban -</option>`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx]; let isSel = (currentSaved === huruf) ? "selected" : ""; htmlOpsi += `<option value="${huruf}" ${isSel}>${formatMath(val)}</option>`; }); htmlOpsi += `</select></div>`; } htmlOpsi += `</div></div>`;
        } else {
            divTanya.innerHTML = formatMath(q.tanya || "");
            if (q.tipe === 'PG') { htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = (savedAns === huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-2 md:p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-blue-300"><input type="radio" name="cbt_ans" value="${huruf}" ${isChecked} onchange="cbtSaveAnswer(this.value)" class="w-4 h-4 md:w-5 md:h-5 text-blue-600 mr-2 md:mr-3 accent-blue-600"><span class="font-black text-[10px] md:text-sm mr-2 md:mr-3 bg-slate-100 border border-slate-200 w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full text-slate-600 shadow-sm">${huruf}</span><span class="text-xs md:text-sm font-medium text-slate-700 leading-snug">${formatMath(val)}</span></label>`; }); htmlOpsi += `</div>`; }
            else if (q.tipe === 'PGK') { let savedArr = savedAns ? savedAns.split(',') : []; htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = savedArr.includes(huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-2 md:p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-purple-300"><input type="checkbox" value="${huruf}" ${isChecked} onchange="cbtSaveCheckbox()" class="cbt-pgk-cb w-5 h-5 md:w-6 md:h-6 text-purple-600 mr-3 md:mr-4 rounded accent-purple-600 shadow-sm"><span class="text-xs md:text-sm font-medium text-slate-700 leading-snug">${formatMath(val)}</span></label>`; }); htmlOpsi += `</div>`; }
            else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') {
                let savedArr = savedAns ? savedAns.split(',') : []; let headers = [];
                if (q.tipe === 'BS') headers = ['Benar', 'Salah']; else if (q.tipe === 'TS') headers = ['Sesuai', 'Tidak Sesuai']; else if (q.tipe === 'SIFAT') headers = ['Komutatif', 'Asosiatif', 'Distributif'];
                let statements = opsiArray.length > 0 ? opsiArray : ['Pernyataan 1', 'Pernyataan 2'];
                htmlOpsi += `<div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm"><table class="w-full text-[10px] md:text-sm text-left"><thead class="bg-slate-100 text-slate-600"><tr><th class="p-3 md:p-4 border-b">Pernyataan</th>`;
                headers.forEach(h => htmlOpsi += `<th class="p-3 md:p-4 border-b text-center font-bold min-w-[60px]">${formatMath(h)}</th>`); htmlOpsi += `</tr></thead><tbody class="divide-y divide-slate-100 bg-white">`;
                statements.forEach((val, idx) => { htmlOpsi += `<tr class="hover:bg-slate-50"><td class="p-3 md:p-4 text-slate-700 font-medium whitespace-normal leading-snug">${formatMath(val)}</td>`; headers.forEach((h, hIdx) => { let huruf = abjad[hIdx]; let isChecked = savedArr[idx] === huruf ? 'checked' : ''; htmlOpsi += `<td class="p-3 md:p-4 text-center border-l"><input type="radio" name="matrix_${idx}" value="${huruf}" ${isChecked} onchange="cbtSaveMatrix(${statements.length})" class="w-4 h-4 md:w-5 md:h-5 accent-blue-600 cursor-pointer"></td>`; }); htmlOpsi += `</tr>`; }); htmlOpsi += `</tbody></table></div>`;
            }
            else if (q.tipe === 'ISIAN') { htmlOpsi += `<input type="text" onkeyup="cbtSaveAnswer(this.value)" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth', block:'center'}), 300)" value="${savedAns}" class="w-full p-3 md:p-4 border-2 rounded-xl text-xs md:text-sm font-bold outline-none bg-white focus:border-blue-500" placeholder="Ketik jawaban singkat...">`; }
            else if (q.tipe === 'ESAI') { htmlOpsi += `<textarea onkeyup="cbtSaveAnswer(this.value)" onfocus="setTimeout(()=>this.scrollIntoView({behavior:'smooth', block:'center'}), 300)" class="w-full p-3 md:p-4 border-2 rounded-xl h-24 md:h-32 text-xs md:text-sm outline-none bg-white focus:border-blue-500" placeholder="Uraikan jawaban Anda...">${savedAns}</textarea>`; }
        } divOpsi.innerHTML = htmlOpsi; 
    } renderCbtGrid();
}

function cbtSaveCheckbox() { let checked = []; document.querySelectorAll('.cbt-pgk-cb:checked').forEach(cb => checked.push(cb.value)); cbtSaveAnswer(checked.join(',')); }
function cbtSaveMatrix(length) { let arr = []; for(let i=0; i<length; i++) { let selected = document.querySelector(`input[name="matrix_${i}"]:checked`); arr.push(selected ? selected.value : '-'); } arr.join(',') !== '' ? cbtSaveAnswer(arr.join(',')) : null; }
function cbtSaveJodoh(totalPairs) { let arr = []; let selects = document.querySelectorAll('.jodoh-select'); selects.forEach((sel, idx) => { if(sel.value) arr.push(`${idx+1}${sel.value}`); }); cbtSaveAnswer(arr.join(',')); }
function cbtSaveAnswer(val) { cbtAnswers[cbtCurrentIndex].ans = val; saveToLocal(); renderCbtGrid(); }

function cbtNext() {
    if(cbtCurrentIndex < cbtQuestions.length - 1) showCbtQuestion(cbtCurrentIndex + 1);
    else {
        let kosong = cbtQuestions.filter((q, i) => { let a = cbtAnswers[i].ans; if(q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') return a === "" || a.indexOf('-') !== -1; if(q.tipe === 'JODOH') return a.split(',').length < (q.kunci||"").split(',').length; return a === ""; }).length;
        if(kosong > 0) Swal.fire('Peringatan!', `Ada ${kosong} soal belum lengkap dijawab!`, 'warning');
        else Swal.fire('Selesai!', 'Semua soal terjawab. Silakan kumpulkan.', 'success');
    }
}
function cbtPrev() { if(cbtCurrentIndex > 0) showCbtQuestion(cbtCurrentIndex - 1); }

async function checkPendingSubmit(showFeedback = false) {
    if(!activeUser) return; const pendingData = localStorage.getItem(`pending_submit_${activeUser.username}`);
    if(pendingData) {
        document.getElementById('offline-pending-alert').classList.remove('hidden');
        if(navigator.onLine) {
            if(showFeedback) Swal.fire({title:'Menyinkronkan...', didOpen: ()=>Swal.showLoading()});
            try {
                const payload = JSON.parse(pendingData); await fetch(API + '/siswa/submit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                localStorage.removeItem(`pending_submit_${activeUser.username}`); document.getElementById('offline-pending-alert').classList.add('hidden');
                Swal.fire('Berhasil!', 'Jawaban tersinkron.', 'success').then(() => location.reload());
            } catch(e) { if(showFeedback) Swal.fire('Gagal', 'Sinyal belum stabil.', 'error'); }
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
    if(!rawAnswer || rawAnswer === '-') return '-';
    let opsiArray = q.opsi_json ? q.opsi_json.split(/\|\|\|/).map(o=>o.trim()).filter(o=>o) : []; const abjad = ['A', 'B', 'C', 'D', 'E', 'F'];
    if(q.tipe === 'PG') { let idx = abjad.indexOf(rawAnswer); return idx !== -1 && opsiArray[idx] ? `${rawAnswer}. ${opsiArray[idx]}` : rawAnswer; }
    if(q.tipe === 'PGK') { let ansArr = rawAnswer.split(','); let texts = []; ansArr.forEach(a => { let idx = abjad.indexOf(a); if(idx !== -1 && opsiArray[idx]) texts.push(`${a}. ${opsiArray[idx]}`); else texts.push(a); }); return texts.join(', '); }
    if(q.tipe === 'JODOH') { let ansArr = rawAnswer.split(','); let texts = []; ansArr.forEach(a => { let num = a.replace(/[a-zA-Z]/g, ''); let letPart = a.replace(/[0-9]/g, ''); let idx = abjad.indexOf(letPart); if(idx !== -1 && opsiArray[idx]) texts.push(`No.${num}->${opsiArray[idx]}`); else texts.push(a); }); return texts.join(' | '); }
    if(q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { 
        let headers = q.tipe === 'BS' ? ['Benar', 'Salah'] : (q.tipe === 'TS' ? ['Sesuai', 'Tidak Sesuai'] : ['Komutatif', 'Asosiatif', 'Distributif']);
        let ansArr = rawAnswer.split(','); let texts = []; ansArr.forEach((a, i) => { let idx = abjad.indexOf(a); if(idx !== -1 && headers[idx]) texts.push(`No.${i+1}:${headers[idx]}`); else texts.push(`No.${i+1}:-`); }); return texts.join(', '); 
    } return rawAnswer;
}

async function submitUjian(showConfirm = true, isForceCurang = false) {
    let benar = 0; let salah = 0; let detail = []; let isGformOnly = cbtQuestions.length > 0 && cbtQuestions[0].tipe === 'GFORM'; let nilaiAkhir = 0; let totalSkorMaksimal = 0; let totalSkorDiperoleh = 0;
    if(!isGformOnly) {
        cbtQuestions.forEach((q, index) => {
            let ans = cbtAnswers[index].ans; let status = 'Salah'; let bobot = q.skor ? parseFloat(q.skor) : 1; let poin = 0;
            if (q.kunci && q.kunci.trim() === '') { status = 'Menunggu Koreksi Guru'; poin = 0; }
            else if (q.tipe === 'PG') { totalSkorMaksimal += bobot; if((ans||"").trim().toLowerCase() === (q.kunci||"").trim().toLowerCase()) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else salah++; } 
            else if (q.tipe === 'PGK') { totalSkorMaksimal += bobot; let kunciArr = (q.kunci||"").toLowerCase().split(',').filter(x=>x); let ansArr = (ans||"").toLowerCase().split(',').filter(x=>x); if(kunciArr.length > 0) { let betul = 0; ansArr.forEach(a => { if(kunciArr.includes(a)) betul++; }); if(betul === kunciArr.length && ansArr.length === kunciArr.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if(betul > 0) { status = `Sebagian Benar (${betul}/${kunciArr.length})`; poin = (betul / kunciArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else salah++; } else salah++; } 
            else if (q.tipe === 'BS' || q.tipe === 'TS' || q.tipe === 'SIFAT') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").toUpperCase().split(',').filter(x=>x); let aArr = (ans||"").toUpperCase().split(','); let correctCount = 0; for(let j=0; j<kArr.length; j++) { if(aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== "") correctCount++; } if(correctCount === kArr.length && kArr.length > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if (correctCount > 0) { status = `Sebagian Benar (${correctCount}/${kArr.length})`; poin = (correctCount / kArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else salah++; }
            else if (q.tipe === 'JODOH') { totalSkorMaksimal += bobot; let kArr = (q.kunci||"").toLowerCase().split(',').filter(x=>x); let aArr = (ans||"").toLowerCase().split(',').filter(x=>x); let correctCount = 0; kArr.forEach(k => { if(aArr.includes(k)) correctCount++; }); if(correctCount === kArr.length && kArr.length > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if (correctCount > 0) { status = `Sebagian Benar (${correctCount}/${kArr.length})`; poin = (correctCount / kArr.length) * bobot; totalSkorDiperoleh += poin; benar++; } else salah++; }
            else if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') { let kWords = (q.kunci || "").toLowerCase().match(/[a-z0-9]+/gi) || []; let aWords = (ans || "").toLowerCase().match(/[a-z0-9]+/gi) || []; if (kWords.length > 0) { totalSkorMaksimal += bobot; let matchWords = 0; let aWordsUnique = [...new Set(aWords)]; kWords.forEach(kw => { if(aWordsUnique.includes(kw)) matchWords++; }); if(matchWords === kWords.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else if(matchWords > 0) { status = `Sebagian Benar (${matchWords}/${kWords.length})`; poin = (matchWords / kWords.length) * bobot; totalSkorDiperoleh += poin; benar++; } else salah++; } else { status = 'Menunggu Koreksi Guru'; poin = 0; } }
            detail.push({ no: index+1, tipe: q.tipe, tanya: q.tanya, jawab: getFullAnswerText(q, ans), kunci: getFullAnswerText(q, q.kunci), status: status, poin: Math.round(poin * 100) / 100 });
        }); nilaiAkhir = totalSkorMaksimal > 0 ? Math.round((totalSkorDiperoleh / totalSkorMaksimal) * 100) : 0;
    } else nilaiAkhir = 'Cek G-Form';

    let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; let start = localStorage.getItem(startTimeKey); let durasiText = '-';
    if (start) { 
        let diffMs = Date.now() - parseInt(start); let dMins = Math.floor(diffMs / 60000); let dSecs = Math.floor((diffMs % 60000) / 1000); 
        let terjawab = cbtQuestions.filter((q,i) => cbtAnswers[i].ans !== "").length;
        durasiText = `${dMins}m ${dSecs}s | ${terjawab}/${cbtQuestions.length} Soal`; 
    }

    const payload = { student_name: activeUser.name, mapel: currentExam.mapel, nilai: nilaiAkhir, benar: benar, salah: salah, detail_jawaban: JSON.stringify(detail), is_curang: isForceCurang, durasi: durasiText };

    const sendLogic = async () => {
        clearInterval(examTimerInterval); isExamActive = false;
        if(!navigator.onLine) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); Swal.fire('Sinyal Offline', 'Jawaban aman di HP.', 'warning'); return; }
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
            await fetch(API + '/siswa/submit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(document.exitFullscreen) document.exitFullscreen();
            localStorage.removeItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); localStorage.removeItem(`cbt_time_${currentExam.mapel}_${activeUser.username}`);
            Swal.fire('Selesai!', `Nilai: ${nilaiAkhir}`, 'success').then(() => location.reload());
        } catch(e) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); Swal.fire('Saved offline', 'Error server.', 'warning'); }
    };

    if (showConfirm && !isForceCurang) {
        Swal.fire({ title: 'Kumpulkan Ujian?', text: "Apakah Anda yakin ingin menyudahi ujian ini?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#059669' }).then((r) => { if(r.isConfirmed) sendLogic(); });
    } else sendLogic();
}

// ADMIN PAGES MANAGEMENT
function showPage(p) { 
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden')); 
    const elPage = document.getElementById('page-'+p);
    if (elPage) elPage.classList.remove('hidden'); 
    
    // Pastikan pemanggilan title tidak crash jika element tidak ada
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = p.toUpperCase();
    
    if(window.innerWidth < 768) toggleAdminSidebar(); 
    if(p === 'dashboard') loadStats(); if(p === 'jadwal') loadJadwal(); if(p === 'nilai') loadNilai(); if(p === 'banksoal') loadBankSoal(); if(p === 'users') loadUsers(); 
}

async function loadMaster() { const resC = await fetch(API + '/admin/config'); const conf = await resC.json(); document.getElementById('app-name-display').innerText = conf.find(c => c.key === 'app_name').value; }

async function loadStats() {
    if(!activeUser || activeUser.role === 'siswa') return;
    const resStats = await fetch(API + '/admin/stats'); const dataStats = await resStats.json();
    document.getElementById('stat-siswa').innerText = dataStats.total_siswa; document.getElementById('stat-guru').innerText = dataStats.total_guru;
    
    const resSch = await fetch(API + '/admin/schedules' + getAuthParams()); const schedules = await resSch.json();
    document.getElementById('dashboard-tokens').innerHTML = schedules.map(s => `<div class="bg-gradient-to-r from-blue-600 to-blue-800 p-4 rounded-xl text-white flex justify-between items-center border border-blue-500"><div><p class="text-[9px] font-bold opacity-80 uppercase">${s.mapel}</p><h2 class="text-base md:text-xl font-black font-mono tracking-widest">${s.pin}</h2></div><i class="fa fa-key text-xl opacity-40"></i></div>`).join('');

    const resA = await fetch(API + '/admin/recent-activity'); allActivityData = await resA.json();
    renderActivityTable();
}

function renderActivityTable() {
    const selKelas = document.getElementById('filter-kelas').value; const selMapel = document.getElementById('filter-mapel').value;
    let filtered = allActivityData.filter(a => (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel));
    
    let blocked = filtered.filter(a => a.status && a.status.includes('Curang'));
    let finished = filtered.filter(a => a.status === 'Selesai');
    let working = filtered.filter(a => a.status === 'Mengerjakan' || (!a.status.includes('Curang') && a.status !== 'Selesai'));

    document.getElementById('stat-kerja').innerText = working.length;
    document.getElementById('stat-selesai').innerText = finished.length;
    document.getElementById('stat-curang').innerText = blocked.length;

    const buildRows = (arr, isWorking, badge) => arr.map(a => {
        let btn = ''; if(a.status && a.status.includes('Curang')) btn = `<br><button onclick="resetSiswa('${a.student_name}', '${a.exam_name}')" class="mt-1 bg-blue-600 text-white px-2 py-0.5 rounded text-[8px]"><i class="fa fa-unlock"></i> Lepas Kunci</button>`;
        let valueText = isWorking ? `Live: ${a.score || 0}` : (a.score || 0);
        return `<tr class="border-b"><td class="p-2 font-bold">${a.student_name}<br><span class="text-[8px] text-slate-400">Kls: ${a.kelas}</span></td><td>${a.exam_name}</td><td><span class="px-2 py-0.5 rounded text-[9px] font-bold ${badge}">${a.status}</span>${btn}</td><td class="font-black">${valueText}</td><td>${a.last_seen || '-'}</td></tr>`;
    }).join('');

    let html = buildRows(blocked, false, 'bg-red-500 text-white') + buildRows(working, true, 'bg-blue-100 text-blue-700') + buildRows(finished, false, 'bg-emerald-100 text-emerald-700');
    document.getElementById('monitor-container').innerHTML = html || `<p class="text-center p-4 text-slate-400">Tidak ada aktivitas.</p>`;
}

async function resetSiswa(nama, mapel) {
    Swal.fire({ title: 'Buka Akses?', icon: 'warning', showCancelButton: true }).then(async (r) => {
        if(r.isConfirmed) { await fetch(API + '/admin/reset-siswa', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: nama, mapel: mapel}) }); loadStats(); }
    });
}

// SCHEDULES CONTROLLER
async function saveJadwal() {
    const mapel = document.getElementById('j_mapel').value; const tanggal = document.getElementById('j_tgl').value; const jam = document.getElementById('j_jam').value; const durasi = document.getElementById('j_durasi').value;
    if(!mapel || !tanggal || !jam || !durasi) return Swal.fire('Oops','Wajib lengkap!','warning');
    await fetch(API + '/api/admin/add-schedule', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mapel, tanggal: `${tanggal}|${jam}`, durasi }) });
    loadJadwal(); Swal.fire('Sukses','Jadwal dibuat!','success');
}

async function loadJadwal() {
    const res = await fetch(API + '/admin/schedules' + getAuthParams()); const data = await res.json(); window.allSchedulesData = data;
    document.getElementById('list-jadwal').innerHTML = data.map(j => {
        let parts = j.tanggal ? j.tanggal.split('|') : [];
        return `<div class="bg-white p-4 rounded-xl border border-l-4 border-blue-500 flex justify-between items-center shadow-sm"><div><h4 class="font-bold text-blue-900">${j.mapel}</h4><p class="text-[10px] text-slate-400">${parts[0] || j.tanggal} • ${j.durasi} Mnt</p></div><div class="text-center font-mono border-l pl-4"><span class="text-xs text-slate-400 block">PIN</span><b class="text-lg text-blue-600 tracking-wider">${j.pin}</b></div><div class="flex flex-col gap-1 pl-2 border-l"><button onclick="editJadwal(${j.id})" class="text-blue-600 p-1 text-xs"><i class="fa fa-edit"></i></button><button onclick="hapusJadwal(${j.id})" class="text-red-500 p-1 text-xs"><i class="fa fa-trash"></i></button></div></div>`;
    }).join('');
}

// BANK SOAL CONTROLLER
async function importExcelSoal() {
    const file = document.getElementById('ex_file').files[0]; const exam_id = document.getElementById('ex_judul').value;
    if(!file || !exam_id) return Swal.fire('Oops', 'Wajib lengkap!', 'warning');
    const fd = new FormData(); fd.append('file_excel', file); fd.append('exam_id', exam_id);
    await fetch(API + '/admin/import-soal', { method: 'POST', body: fd }); loadBankSoal(); Swal.fire('Berhasil','Excel ter-import','success');
}

async function importWord() {
    const file = document.getElementById('w_file').files[0]; const exam_id = document.getElementById('w_judul').value;
    if(!file || !exam_id) return Swal.fire('Oops', 'Wajib lengkap!', 'warning');
    const fd = new FormData(); fd.append('file_word', file); fd.append('exam_id', exam_id);
    await fetch(API + '/admin/import-word', { method: 'POST', body: fd }); loadBankSoal(); Swal.fire('Berhasil','Word terekstrak','success');
}

let questionCount = 1;
function tambahBarisSoal() {
    questionCount++; const container = document.getElementById('bulk-questions-container');
    const html = `<div class="question-item bg-slate-50 p-4 rounded-2xl border-2 relative mt-4" data-no="${questionCount}"><div class="absolute -left-3 -top-3 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center font-black text-xs">${questionCount}</div><button onclick="this.parentElement.remove()" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs"><i class="fa fa-times"></i></button><div class="grid grid-cols-1 gap-2"><div class="grid grid-cols-3 gap-2"><div><select class="q-tipe w-full p-2 border rounded-lg text-xs"><option value="PG">PG Biasa</option><option value="PGK">PG Kompleks</option><option value="JODOH">Menjodohkan</option><option value="ISIAN">Isian Singkat</option><option value="ESAI">Uraian / Esai</option><option value="BS">Benar/Salah</option><option value="TS">Tabel Sesuai</option><option value="SIFAT">Sifat Komutatif/Asosiatif</option></select></div><div><input type="text" class="q-kunci w-full p-2 border rounded-lg text-xs" placeholder="Kunci"></div><div><input type="number" class="q-skor w-full p-2 border rounded-lg text-xs" value="1"></div></div><input type="text" class="q-image w-full p-2 border rounded-lg text-xs" placeholder="Link Gambar (Opsional)"><textarea class="q-tanya w-full p-2 border rounded-lg text-xs h-12" placeholder="Pertanyaan"></textarea><input type="text" class="q-opsi w-full p-2 border rounded-lg text-xs" placeholder="Opsi A ||| Opsi B ||| Opsi C"></div></div>`;
    container.insertAdjacentHTML('beforeend', html);
}

async function simpanSoalBulk() {
    const kodeUjian = document.getElementById('s_judul_bulk').value; if(!kodeUjian) return Swal.fire('Error', 'Isi KODE UJIAN!', 'warning');
    const items = document.querySelectorAll('.question-item'); let dataSoal = [];
    items.forEach(el => { dataSoal.push({ exam_id: kodeUjian, tipe: el.querySelector('.q-tipe').value, tanya: el.querySelector('.q-tanya').value, opsi_json: el.querySelector('.q-opsi').value, kunci: el.querySelector('.q-kunci').value.toUpperCase(), gform_url: el.querySelector('.q-image').value, skor: parseFloat(el.querySelector('.q-skor').value) || 1 }); });
    await fetch(API + '/admin/add-soal-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: dataSoal }) });
    location.reload();
}

async function loadBankSoal() {
    const res = await fetch(API + '/admin/questions' + getAuthParams()); const data = await res.json();
    if (data.length === 0) { document.getElementById('banksoal-container').innerHTML = '<p class="text-center p-4 bg-white border rounded-xl text-slate-400">Kosong.</p>'; return; }
    let groups = {}; data.forEach(q => { if(!groups[q.exam_id]) groups[q.exam_id] = []; groups[q.exam_id].push(q); });
    
    document.getElementById('banksoal-container').innerHTML = Object.entries(groups).map(([examId, list]) => {
        let rows = list.map(q => `<tr class="border-b"><td class="p-2 text-xs"><span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black text-[9px]">${q.tipe}</span></td><td class="whitespace-normal p-2 text-xs font-medium">${formatMath(q.tanya).substring(0,70)}... <br><span class="text-[9px] text-emerald-600 font-bold">Kunci: ${q.kunci}</span> <span class="text-[9px] text-blue-600 font-bold ml-2">Skor: ${q.skor||1}</span></td><td><button onclick="hapusSoal(${q.id})" class="text-red-500 text-xs"><i class="fa fa-trash"></i></button></td></tr>`).join('');
        return `<div class="mb-3 bg-white border rounded-xl overflow-hidden shadow-sm"><div class="p-3 bg-slate-50 font-bold text-xs flex justify-between items-center"><span onclick="document.getElementById('soal-${examId}').classList.toggle('hidden')" class="cursor-pointer flex-1">${examId} (${list.length} Soal)</span><button onclick="hapusPaketSoal('${examId}')" class="text-red-500 text-[10px] font-bold"><i class="fa fa-trash"></i> Hapus Paket</button></div><div id="soal-${examId}" class="hidden overflow-x-auto"><table class="w-full text-left"><tbody>${rows}</tbody></table></div></div>`;
    }).join('');
}

async function hapusSoal(id) { await fetch(API + '/admin/delete-soal/' + id, { method: 'DELETE' }); loadBankSoal(); }
async function hapusPaketSoal(examId) { await fetch(API + '/admin/delete-exam/' + encodeURIComponent(examId), { method: 'DELETE' }); loadBankSoal(); }
async function hapusJadwal(id) { await fetch(API + '/admin/delete-schedule/' + id, { method: 'DELETE' }); loadJadwal(); }

// REKAP & KKM GRADE REPORT CONTROLLER
async function loadNilai() {
    const res = await fetch(API + '/admin/results' + getAuthParams()); const data = await res.json(); window.allResultsData = data;
    if(document.getElementById('filter-kelas-nilai').options.length === 1) { 
        let kelasSet = new Set(); let mapelSet = new Set(); window.allResultsData.forEach(r => { if(r.kelas && r.kelas !== '-') kelasSet.add(r.kelas); if(r.mapel) mapelSet.add(r.mapel); }); 
        const fKelas = document.getElementById('filter-kelas-nilai'); kelasSet.forEach(k => fKelas.add(new Option(k, k))); 
        const fMapel = document.getElementById('filter-mapel-nilai'); mapelSet.forEach(m => fMapel.add(new Option(m, m))); 
    } renderNilaiTable();
}

function renderNilaiTable() {
    const selKelas = document.getElementById('filter-kelas-nilai').value; const selMapel = document.getElementById('filter-mapel-nilai').value; const valKKM = parseFloat(document.getElementById('input-kkm').value);
    window.filteredResultsData = window.allResultsData.filter(r => (selKelas === "" || r.kelas === selKelas) && (selMapel === "" || r.mapel === selMapel));
    
    document.getElementById('nilai-body').innerHTML = window.filteredResultsData.map(n => {
        let statusKKMHtml = '-';
        if (!isNaN(valKKM)) {
            statusKKMHtml = (parseFloat(n.nilai) || 0) >= valKKM ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">TUNTAS</span>` : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">REMEDIAL</span>`;
        }
        return `<tr><td class="p-2 font-medium">${n.student_name}<br><span class="text-[9px] text-slate-400">Kls: ${n.kelas}</span></td><td>${n.mapel}</td><td class="text-emerald-600 font-bold">${n.benar || 0}</td><td class="text-red-500 font-bold">${n.salah || 0}</td><td class="font-black">${n.nilai}</td><td>${statusKKMHtml}</td><td><button onclick='lihatDetail(${JSON.stringify(n.detail_jawaban || "[]")})' class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">Detail</button></td></tr>`;
    }).join('');
}

function lihatDetail(detailJson) {
    let details = []; try { details = typeof detailJson === 'string' ? JSON.parse(detailJson) : detailJson; } catch(e){}
    if(details.length === 0) return Swal.fire('Info', 'Format Google Form, detail analisis tidak tersedia.', 'info');
    document.getElementById('detail-content').innerHTML = details.map(d => {
        let colored = colorizeAnswer(d.jawab, d.kunci, d.tipe);
        let badgeColor = d.status.includes('Benar') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
        return `<div class="bg-white p-3 rounded-xl border mb-2"><div class="flex justify-between items-center mb-1"><span class="font-bold text-xs">Soal No. ${d.no} (${d.tipe})</span><span class="px-2 py-0.5 text-[9px] font-bold rounded ${badgeColor}">${d.status} (Skor: ${d.poin})</span></div><p class="text-xs text-slate-600 mb-2">${formatMath(d.tanya)}</p><div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded"><div class="border-r"><b>Siswa:</b><p>${colored}</p></div><div><b>Kunci:</b><p class="text-emerald-600 font-bold">${formatMath(d.kunci)}</p></div></div></div>`;
    }).join('');
    document.getElementById('modal-detail').classList.remove('hidden');
}

function exportExcelDetail() {
    if(!window.filteredResultsData || window.filteredResultsData.length === 0) return Swal.fire('Kosong', 'Tidak ada data', 'warning');
    const valKKM = parseFloat(document.getElementById('input-kkm').value); let isKKMActive = !isNaN(valKKM);
    let maxQ = 0; window.filteredResultsData.forEach(r => { try { let len = JSON.parse(r.detail_jawaban).length; if(len > maxQ) maxQ = len; } catch(e){} });
    
    let tableHtml = `<table border="1"><thead><tr><th>Nama Siswa</th><th>Kelas</th><th>Mapel</th><th>Benar</th><th>Salah</th><th>Nilai Akhir</th>`;
    if(isKKMActive) tableHtml += `<th>Status (KKM: ${valKKM})</th>`;
    for(let i=1; i<=maxQ; i++) tableHtml += `<th>No.${i}</th>`;
    tableHtml += `</tr></thead><tbody>`;
    
    window.filteredResultsData.forEach(r => {
        let details = []; try { details = JSON.parse(r.detail_jawaban); } catch(e){}
        tableHtml += `<tr><td>${r.student_name}</td><td>${r.kelas||'-'}</td><td>${r.mapel}</td><td>${r.benar}</td><td>${r.salah}</td><td style="font-weight:bold;">${r.nilai}</td>`;
        if(isKKMActive) {
            let stText = (parseFloat(r.nilai) || 0) >= valKKM ? 'TUNTAS' : 'REMEDIAL';
            let stCol = (parseFloat(r.nilai) || 0) >= valKKM ? '#047857' : '#dc2626';
            tableHtml += `<td style="font-weight:bold; color:${stCol};">${stText}</td>`;
        }
        let detMap = {}; details.forEach(d => { detMap[d.no] = d; });
        for(let i=1; i<=maxQ; i++) { tableHtml += `<td>${detMap[i] ? detMap[i].jawab : '-'}</td>`; } tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`;
    let blob = new Blob([tableHtml], {type: 'application/vnd.ms-excel'}); let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Rekap_Nilai_CBT.xls'; a.click();
}

// MANAGEMENT USERS CONTROLLER
async function loadUsers() {
    const res = await fetch(API + '/admin/users'); const data = await res.json();
    document.getElementById('user-body').innerHTML = data.map(u => `<tr class="border-b"><td class="p-2 font-medium">${u.name}</td><td>${u.username}</td><td>${u.kelas || u.mapel || '-'}</td><td><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px]">${u.role}</span></td><td class="text-right p-2"><button onclick='editUser(${JSON.stringify(u)})' class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs mr-1"><i class="fa fa-edit"></i></button><button onclick="hapusUser('${u.username}')" class="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs"><i class="fa fa-trash"></i></button></td></tr>`).join('');
}
async function importUsers(inp) { if(!inp.files[0]) return; const fd = new FormData(); fd.append('file_excel', inp.files[0]); await fetch(API + '/admin/import-users', { method: 'POST', body: fd }); loadUsers(); Swal.fire('Sukses','User ter-import','success'); }
async function hapusUser(usr) { await fetch(API + '/admin/delete-user/' + usr, { method: 'DELETE' }); loadUsers(); }

function tambahUserManual() {
    Swal.fire({
        title: 'Tambah Pengguna',
        html: `<div class="space-y-2 text-left"><div><label class="text-[10px] font-bold">Nama Lengkap</label><input id="a_name" class="w-full p-2 border rounded text-xs"></div><div><label class="text-[10px] font-bold">Username</label><input id="a_user" class="w-full p-2 border rounded text-xs"></div><div><label class="text-[10px] font-bold">Password</label><input id="a_pass" class="w-full p-2 border rounded text-xs"></div><div><label class="text-[10px] font-bold">Role</label><select id="a_role" class="w-full p-2 border rounded text-xs"><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="admin">Admin</option></select></div><div><label class="text-[10px] font-bold">Kelas / Mapel</label><input id="a_kelas" class="w-full p-2 border rounded text-xs" placeholder="Misal: VII-A atau BINDO-KLS7"></div></div>`,
        showCancelButton: true, preConfirm: () => { return { name: document.getElementById('a_name').value, username: document.getElementById('a_user').value, password: document.getElementById('a_pass').value, role: document.getElementById('a_role').value, kelas: document.getElementById('a_role').value === 'siswa' ? document.getElementById('a_kelas').value : '', mapel: document.getElementById('a_role').value === 'guru' ? document.getElementById('a_kelas').value : '' } }
    }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/add-user', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } });
}

function editUser(u) {
    Swal.fire({
        title: 'Edit Pengguna',
        html: `<div class="space-y-2 text-left"><div><label class="text-[10px] font-bold">Nama</label><input id="e_name" class="w-full p-2 border rounded text-xs" value="${u.name}"></div><div><label class="text-[10px] font-bold">Username</label><input id="e_user" class="w-full p-2 border rounded text-xs" value="${u.username}"></div><div><label class="text-[10px] font-bold">Password</label><input id="e_pass" class="w-full p-2 border rounded text-xs" value="${u.password}"></div><div><label class="text-[10px] font-bold">Kelas/Mapel</label><input id="e_kelas" class="w-full p-2 border rounded text-xs" value="${u.kelas || u.mapel || ''}"></div></div>`,
        showCancelButton: true, preConfirm: () => { return { old_username: u.username, name: document.getElementById('e_name').value, username: document.getElementById('e_user').value, password: document.getElementById('e_pass').value, role: u.role, kelas: u.role === 'siswa' ? document.getElementById('e_kelas').value : '', mapel: u.role === 'guru' ? document.getElementById('e_kelas').value : '' } }
    }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/update-user', {method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } });
}

async function clearMonitoring() { await fetch(API + '/admin/clear-monitoring', {method:'DELETE'}); loadStats(); }
async function clearResults() { await fetch(API + '/admin/clear-results', {method:'DELETE'}); loadNilai(); loadStats(); }
async function clearSchedules() { await fetch(API + '/admin/clear-schedules', {method:'DELETE'}); loadJadwal(); }
async function clearQuestions() { await fetch(API + '/admin/clear-questions', {method:'DELETE'}); loadBankSoal(); }
async function clearUsers() { await fetch(API + '/admin/clear-users', {method:'DELETE'}); loadUsers(); }

setInterval(() => { if(activeUser && activeUser.role !== 'siswa' && !document.getElementById('page-dashboard').classList.contains('hidden')) loadStats(); }, 3000);