// CBT APP ENGINE - Copyright (c) | SPENDA-DIGI-2026
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
    return text.replace(/\^\((.*?)\)/g, '<sup>$1</sup>').replace(/\^([a-zA-Z0-9]+)/g, '<sup>$1</sup>').replace(/_\((.*?)\)/g, '<sub>$1</sub>').replace(/_([a-zA-Z0-9]+)/g, '<sub>$1</sub>');
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

function logout() { location.reload(); }
function saveToLocal() { if(currentExam && activeUser) localStorage.setItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`, JSON.stringify(cbtAnswers)); }
function loadFromLocal() { if(currentExam && activeUser) { const saved = localStorage.getItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); if(saved) cbtAnswers = JSON.parse(saved); } }

async function mulaiUjian() {
    const pin = document.getElementById('input-pin').value; if(!pin) return Swal.fire('Error', 'PIN!', 'warning'); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading() });
    try {
        const clientDate = new Date().toLocaleDateString('en-CA'); const clientTime = new Date().toTimeString().substring(0,5); 
        const res = await fetch(API + '/siswa/cek-pin', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pin: pin, student_name: activeUser.name, client_date: clientDate, client_time: clientTime}) }); const data = await res.json();
        if(data.status === "success") {
            currentExam = data.exam; const resSoal = await fetch(API + '/siswa/get-soal', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({exam_id: currentExam.mapel}) }); const dataSoal = await resSoal.json();
            if(!dataSoal.questions || dataSoal.questions.length === 0) return Swal.fire('Oops', 'Soal belum diatur!', 'error');
            document.getElementById('view-siswa-token').classList.add('hidden'); document.getElementById('view-siswa-ujian').classList.remove('hidden');
            document.getElementById('ujian-mapel-title').innerText = currentExam.mapel; document.getElementById('ujian-nama-siswa').innerText = activeUser.name;
            if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
            cbtQuestions = dataSoal.questions; cbtAnswers = new Array(cbtQuestions.length).fill(null).map(() => ({ ans: '' })); cbtCurrentIndex = 0;
            let startTimeKey = `cbt_start_${currentExam.mapel}_${activeUser.username}`; localStorage.setItem(startTimeKey, Date.now()); 
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
        fetch(API + '/siswa/ping', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, durasi: durasiTeks, live_score: lScore}) }).catch(e=>console.log(e)); 
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
        let hd = []; if (q.tipe === 'BS') hd = ['Benar', 'Salah']; else if (q.tipe === 'TS') hd = ['Sesuai', 'Tidak Sesuai']; else if (q.tipe === 'SIFAT') hd = ['Sifat Komutatif', 'Sifat Asosiatif', 'Sifat Distributif'];
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
async function loadPublicData() { try { const res = await fetch(API + '/admin/recent-activity'); publicActivityData = await res.json(); if(document.getElementById('pub-filter-kelas').options.length === 1) { let kelasSet = new Set(); let mapelSet = new Set(); publicActivityData.forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); }); const fKelas = document.getElementById('pub-filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); }); const fMapel = document.getElementById('pub-filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); }); } renderPublicTable(); } catch(e) { console.log("Gagal load score"); } }
function renderPublicTable() { const selKelas = document.getElementById('pub-filter-kelas').value; const selMapel = document.getElementById('pub-filter-mapel').value; let filtered = publicActivityData.filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); }); filtered.sort((a,b) => (parseFloat(String(b.score).split('|')[0])||0) - (parseFloat(String(a.score).split('|')[0])||0)); document.getElementById('public-table-body').innerHTML = filtered.map(a => { let badge = a.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : (a.status.includes('Curang') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'); let skorMentah = a.score !== null && a.score !== undefined ? String(a.score) : '-'; let nilaiTampil = skorMentah.includes('|') ? skorMentah.split('|')[0].trim() : skorMentah; return `<tr class="hover:bg-slate-50"><td class="p-2 md:p-3 font-bold text-slate-800">${a.student_name}</td><td class="p-2 md:p-3 font-medium text-slate-600">${a.kelas||'-'} <br><span class="text-[9px]">${a.exam_name}</span></td><td class="p-2 md:p-3 text-center"><span class="px-2 py-1 rounded text-[9px] font-bold ${badge}">${a.status}</span></td><td class="p-2 md:p-3 text-center font-black text-sm text-blue-600">${nilaiTampil}</td></tr>`; }).join('') || `<tr><td colspan="4" class="text-center p-4 text-slate-400">Belum ada aktivitas.</td></tr>`; }
function keluarPublic() { clearInterval(publicInterval); document.getElementById('view-public-score').classList.add('hidden'); document.getElementById('view-public-score').classList.remove('flex'); document.getElementById('view-login').classList.remove('hidden'); }

async function loadStats() { 
    if(!activeUser || activeUser.role === 'siswa') return; 
    const resStats = await fetch(API + '/admin/stats'); const dataStats = await resStats.json(); 
    document.getElementById('stat-siswa').innerText = dataStats.total_siswa; document.getElementById('stat-guru').innerText = dataStats.total_guru; 
    
    const resSch = await fetch(API + '/admin/schedules' + getAuthParams()); const schedules = await resSch.json(); 
    document.getElementById('dashboard-tokens').innerHTML = schedules.map(s => `<div class="bg-gradient-to-r from-blue-600 to-blue-800 p-3 md:p-4 rounded-xl shadow-md text-white flex justify-between items-center border border-blue-500"><div><p class="text-[8px] md:text-[10px] font-bold opacity-80 uppercase">${s.mapel}</p><h2 class="text-base md:text-xl font-black tracking-widest">${s.pin}</h2></div><i class="fa fa-key text-xl opacity-50"></i></div>`).join('');

    const resA = await fetch(API + '/admin/recent-activity'); allActivityData = await resA.json(); 
    if(document.getElementById('filter-kelas').options.length === 1) {
        let kelasSet = new Set(); let mapelSet = new Set();
        allActivityData.forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); });
        const fKelas = document.getElementById('filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); });
        const fMapel = document.getElementById('filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); });
    } renderActivityTable();
}

async function resetSiswa(nama, mapel) { Swal.fire({ title: 'Buka Akses?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Buka!' }).then(async (r) => { if (r.isConfirmed) { await fetch(API + '/admin/reset-siswa', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: nama, mapel: mapel}) }); loadStats(); } }); }
async function usirHantu(id) { await fetch(API + '/admin/remove-activity/' + id, { method: 'DELETE' }); loadStats(); }

function renderActivityTable() {
    let scrollPositions = []; document.querySelectorAll('.scroll-saver').forEach(el => scrollPositions.push(el.scrollTop));
    const selKelas = document.getElementById('filter-kelas').value; const selMapel = document.getElementById('filter-mapel').value;
    let filtered = allActivityData.filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); });
    
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
            if (a.last_seen && a.last_seen.includes('(')) { let parts = a.last_seen.split(' ('); jamUpdate = parts[0]; let dText = parts[1].replace(')', ''); if(dText.includes('|')) { let subParts = dText.split('|'); durasiFinal = `<span class="font-bold text-slate-700"><i class="fa fa-clock text-slate-400 mr-1"></i> ${subParts[0].trim()}</span><br><span class="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mt-1 inline-block"><i class="fa fa-tasks"></i> Progress: ${subParts[1].trim()}</span>`; } else { durasiFinal = `<span class="font-bold text-slate-700"><i class="fa fa-clock text-slate-400 mr-1"></i> ${dText}</span>`; } } else if (a.status === 'Mengerjakan') { durasiFinal = `<span class="font-bold text-orange-500"><i class="fa fa-spinner fa-spin mr-1"></i> Baru mulai</span>`; }
            let hantuBtn = (isWorking && activeUser && activeUser.role.toLowerCase() === 'admin') ? `<button onclick="usirHantu(${a.id})" class="ml-2 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white px-2 py-1 rounded shadow-sm text-[8px]"><i class="fa fa-times"></i></button>` : '';

            return `<tr class="hover:bg-slate-50 border-b border-slate-100 ${rowColorClass}"><td class="p-2 md:p-3 font-bold ${textClass}">${a.student_name} ${hantuBtn}<br><span class="text-[8px] md:text-[9px] text-slate-400">Kelas: ${a.kelas||'-'}</span></td><td class="p-2 md:p-3 font-medium">${a.exam_name}</td><td class="p-2 md:p-3"><span class="px-2 py-1 rounded-full text-[9px] md:text-[10px] font-bold ${badgeClass}">${a.status}</span> ${aksiBtn}</td><td class="p-2 md:p-3 font-black text-sm">${skorTampil}</td><td class="p-2 md:p-3">${durasiFinal}</td><td class="p-2 md:p-3 text-[9px] md:text-[10px] text-slate-500">${jamUpdate}</td></tr>`;
        }).join('');
        return `<div class="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white mb-4"><div class="p-2 md:p-3 text-[10px] md:text-xs font-black uppercase tracking-widest ${titleColorClass}"><i class="fa ${icon} mr-1"></i> ${title} <span class="float-right bg-white/80 px-2 py-0.5 rounded-full shadow-sm text-[9px] text-slate-700">${dataArray.length} Siswa</span></div><div class="overflow-x-auto"><div class="max-h-[40vh] overflow-y-auto scroll-saver"><table class="w-full text-left text-[10px] md:text-xs"><thead class="text-[8px] md:text-[9px] text-slate-500 uppercase sticky top-0 z-10 shadow-sm"><tr><th class="p-2 md:p-3 bg-slate-100">Nama Siswa</th><th class="p-2 md:p-3 bg-slate-100">Ujian</th><th class="p-2 md:p-3 bg-slate-100">Status / Aksi</th><th class="p-2 md:p-3 bg-slate-100">Skor</th><th class="p-2 md:p-3 bg-slate-100">Durasi / Progress</th><th class="p-2 md:p-3 bg-slate-100">Jam Update</th></tr></thead><tbody class="divide-y divide-slate-100 bg-white">${rows}</tbody></table></div></div></div>`;
    };

    html += renderTableGroup('Siswa Diblokir (Curang)', 'fa-ban', 'bg-red-50 text-red-600 border-b border-red-200', blocked, 'bg-red-50/30', 'text-red-700', 'bg-red-500 text-white animate-pulse', false);
    html += renderTableGroup('Sedang Mengerjakan (Live)', 'fa-spinner fa-spin', 'bg-blue-50 text-blue-600 border-b border-blue-200', working, '', 'text-slate-800', 'bg-blue-100 text-blue-700', true);
    html += renderTableGroup('Selesai Ujian (Final)', 'fa-check-circle', 'bg-emerald-50 text-emerald-600 border-b border-emerald-200', finished, '', 'text-slate-800', 'bg-emerald-100 text-emerald-700', false);
    document.getElementById('monitor-container').innerHTML = html || `<div class="text-center p-8 text-slate-400 font-bold bg-white rounded-xl border border-dashed">Belum ada aktivitas.</div>`; 
    document.querySelectorAll('.scroll-saver').forEach((el, index) => { if(scrollPositions[index]) el.scrollTop = scrollPositions[index]; });
}

// NILAI
async function loadNilai() { 
    const res = await fetch(API + '/admin/results' + getAuthParams()); const data = await res.json(); window.allResultsData = data; 
    if(document.getElementById('filter-kelas-nilai').options.length === 1) { 
        let kelasSet = new Set(); let mapelSet = new Set(); window.allResultsData.forEach(r => { if(r.kelas && r.kelas !== '-') kelasSet.add(r.kelas); if(r.mapel) mapelSet.add(r.mapel); }); 
        const fKelas = document.getElementById('filter-kelas-nilai'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); }); 
        const fMapel = document.getElementById('filter-mapel-nilai'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); }); 
    } renderNilaiTable(); 
}

function renderNilaiTable() { 
    const selKelas = document.getElementById('filter-kelas-nilai').value; 
    const selMapel = document.getElementById('filter-mapel-nilai').value; 
    window.filteredResultsData = window.allResultsData.filter(r => { return (selKelas === "" || r.kelas === selKelas) && (selMapel === "" || r.mapel === selMapel); }); 
    document.getElementById('nilai-body').innerHTML = window.filteredResultsData.map(n => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-3 font-semibold whitespace-normal min-w-[120px] md:min-w-[150px] leading-snug text-slate-800">${n.student_name} <br><span class="text-[9px] text-slate-400 font-medium">Kelas: ${n.kelas||'-'}</span></td>
            <td class="p-3 text-slate-700 font-medium">${n.mapel}</td>
            <td class="p-3 text-xs text-slate-500 font-medium">${(n.tanggal || '').includes('|') ? n.tanggal.split('|')[1] : '-'}</td>
            <td class="p-3 text-center text-emerald-600 font-bold">${n.benar || 0}</td>
            <td class="p-3 text-center text-red-500 font-bold">${n.salah || 0}</td>
            <td class="p-3 text-center font-black text-sm md:text-base text-blue-600">${n.nilai}</td>
            <td class="p-3 text-center"><button onclick='lihatDetail(${JSON.stringify(n.detail_jawaban || "[]").replace(/'/g, "'")})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold hover:bg-blue-200 transition shadow-sm"><i class="fa fa-eye mr-1"></i> Detail</button></td>
        </tr>
    `).join(''); 
}

function lihatDetail(detailJson) { let details = []; try { details = JSON.parse(detailJson); } catch(e) { details = []; } if(details.length === 0) return Swal.fire('Info', 'Bentuk GForm', 'info'); let html = details.map(d => { let coloredJawab = colorizeAnswer(d.jawab, d.kunci, d.tipe); let statusColor = d.status.includes('Benar') ? 'bg-emerald-100 text-emerald-700' : (d.status==='Salah' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'); return `<div class="bg-white p-3 md:p-4 rounded-xl border shadow-sm"><div class="flex justify-between items-start mb-2"><span class="font-bold text-slate-700 text-[10px] md:text-sm">Soal No. ${d.no}</span><span class="px-2 py-1 text-[9px] md:text-[10px] font-bold rounded-full ${statusColor}">${d.status} (Skor: ${d.poin})</span></div><div class="text-[10px] md:text-sm text-slate-600 mb-3 whitespace-pre-line leading-relaxed">${formatMath(d.tanya)}</div><div class="flex gap-2 md:gap-4 text-[9px] md:text-xs bg-slate-50 p-2 md:p-3 rounded-lg border border-slate-100"><div class="flex-1"><span class="text-slate-400 block mb-1">Jawaban Siswa:</span><span class="leading-relaxed">${coloredJawab}</span></div><div class="flex-1 border-l pl-2 md:pl-4"><span class="text-slate-400 block mb-1">Kunci Jawaban:</span><strong class="text-emerald-600 leading-relaxed">${formatMath((d.kunci||'-').replace(/, | \\ /g, '<br>'))}</strong></div></div></div>` }).join(''); document.getElementById('detail-content').innerHTML = html; document.getElementById('modal-detail').classList.remove('hidden'); }

// JADWAL & KKM
async function loadMaster() { document.getElementById('app-name-display').innerText = 'SPENDA-DIGI-2026'; }
async function loadJadwal() { const res = await fetch(API + '/admin/schedules' + getAuthParams()); const data = await res.json(); window.allSchedulesData = data; document.getElementById('list-jadwal').innerHTML = data.map(j => { let tglJamArr = j.tanggal ? j.tanggal.split('|') : []; let tglTampil = tglJamArr[0] || j.tanggal; let jamTampil = tglJamArr[1] ? ` • Jam ${tglJamArr[1]}` : ''; let statusBadge = j.status === 'Aktif' ? '<span class="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[8px] font-bold">Aktif</span>' : '<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[8px] font-bold">Ditutup</span>'; return `<div class="bg-white p-3 md:p-4 rounded-xl border border-l-4 border-blue-500 shadow-sm flex justify-between items-center relative"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><h4 class="font-bold text-[10px] md:text-sm text-blue-900">${j.mapel}</h4> ${statusBadge}</div><p class="text-[8px] md:text-[10px] text-slate-400"><i class="fa fa-calendar-alt"></i> ${tglTampil}${jamTampil} • <i class="fa fa-clock"></i> ${j.durasi} Menit • KKM: <span class="font-bold text-blue-600">${j.kkm||0}</span></p></div><div class="text-center px-3 md:px-4 border-l border-slate-100"><p class="text-[7px] md:text-[8px] font-bold text-slate-400">PIN UJIAN</p><p class="text-base md:text-lg font-black text-blue-600 font-mono tracking-widest">${j.pin}</p></div><div class="flex flex-col gap-1.5 pl-2 border-l border-slate-100"><button onclick="editJadwal(${j.id})" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1.5 rounded transition shadow-sm text-[10px] md:text-xs"><i class="fa fa-edit"></i></button><button onclick="hapusJadwal(${j.id})" class="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-2 py-1.5 rounded transition shadow-sm text-[10px] md:text-xs"><i class="fa fa-trash"></i></button></div></div>`; }).join(''); const resExams = await fetch(API + '/admin/available-exams' + getAuthParams()); const exams = await resExams.json(); const selectMapel = document.getElementById('j_mapel'); selectMapel.innerHTML = '<option value="">-- Pilih Kode Soal --</option>' + exams.map(e => `<option value="${e}">${e}</option>`).join(''); }

async function saveJadwal() { 
    const mapel = document.getElementById('j_mapel').value; const tgl = document.getElementById('j_tgl').value; const jam = document.getElementById('j_jam').value; const durasi = document.getElementById('j_durasi').value; const kkm = document.getElementById('j_kkm').value || 0;
    if(!mapel || !tgl || !jam || !durasi) return Swal.fire('Oops', 'Lengkapi semua jadwal!', 'warning'); 
    await fetch(API + '/admin/add-schedule', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mapel, tanggal: `${tgl}|${jam}`, durasi, kkm }) }); loadJadwal(); 
}

function editJadwal(id) { 
    const j = window.allSchedulesData.find(x => x.id === id); if(!j) return; 
    let tglJamArr = j.tanggal ? j.tanggal.split('|') : []; let tgl = tglJamArr[0] || ''; let jam = tglJamArr[1] || ''; 
    Swal.fire({ 
        title: 'Edit Jadwal', html: `<div class="space-y-3 text-left"><div><label class="text-[10px] md:text-xs font-bold text-slate-500">Mapel / Kode Soal</label><input id=\"e_j_mapel\" class=\"w-full p-2 border rounded bg-slate-100 font-bold\" value=\"${j.mapel}\" readonly></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Tanggal Mulai</label><input type=\"date\" id=\"e_j_tgl\" class=\"w-full p-2 border rounded\" value=\"${tgl}\"></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Jam Mulai</label><input type=\"time\" id=\"e_j_jam\" class=\"w-full p-2 border rounded\" value=\"${jam}\"></div><div class="flex gap-2"><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Durasi</label><input type=\"number\" id=\"e_j_durasi\" class=\"w-full p-2 border rounded font-bold\" value=\"${j.durasi}\"></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">KKM</label><input type=\"number\" id=\"e_j_kkm\" class=\"w-full p-2 border rounded bg-blue-50 text-blue-700 font-bold\" value=\"${j.kkm||0}\"></div></div><div><label class=\"text-[10px] md:text-xs font-bold text-slate-500\">Status</label><select id=\"e_j_status\" class=\"w-full p-2 border rounded font-bold text-blue-700\"><option value=\"Aktif\" ${j.status==='Aktif'?'selected':''}>Aktif</option><option value=\"Ditutup\" ${j.status!=='Aktif'?'selected':''}>Ditutup (Kunci Ujian)</option></select></div></div>`, showCancelButton: true, confirmButtonText: 'Simpan', preConfirm: () => { return { id: j.id, mapel: document.getElementById('e_j_mapel').value, tanggal: document.getElementById('e_j_tgl').value + '|' + document.getElementById('e_j_jam').value, durasi: document.getElementById('e_j_durasi').value, kkm: document.getElementById('e_j_kkm').value, status: document.getElementById('e_j_status').value } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/update-schedule', {method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadJadwal(); } }); 
}

// MANAGEMENT BANK SOAL & USERS
async function loadBankSoal() { const res = await fetch(API + '/admin/questions' + getAuthParams()); const data = await res.json(); if (data.length === 0) { document.getElementById('banksoal-container').innerHTML = '<div class="text-center p-8 bg-white border rounded-xl">Belum ada soal.</div>'; return; } const groups = {}; data.forEach(q => { if(!groups[q.exam_id]) groups[q.exam_id] = []; groups[q.exam_id].push(q); }); let html = ''; for (const [examId, questions] of Object.entries(groups)) { let tableRows = questions.map(q => { let det = q.tipe === 'GFORM' ? `Link G-Form: ${q.tanya || q.gform_url}` : (q.tanya ? formatMath(q.tanya).substring(0,80)+'...' : '-'); det += `<br><span class="text-[10px] text-emerald-600 font-bold p-1 bg-emerald-50 rounded">KUNCI: ${formatMath(q.kunci) || '-'}</span>`; return `<tr class="hover:bg-slate-50 border-b"><td class="p-2 w-20"><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black">${q.tipe}</span></td><td class="p-2 text-xs">${det}</td><td class="p-2 text-right w-24"><button onclick="hapusSoal(${q.id})" class="text-red-500 border p-2 rounded-lg"><i class="fa fa-trash"></i></button></td></tr>`; }).join(''); html += `<div class="mb-3 bg-white border rounded-xl overflow-hidden"><div class="p-3 bg-slate-50 font-bold text-slate-700 flex justify-between items-center"><button onclick="document.getElementById('soal-${examId}').classList.toggle('hidden')" class="flex-1 text-left"><i class="fa fa-folder-open text-blue-500 mr-2"></i> ${examId} (${questions.length} Soal)</button><button onclick="hapusPaketSoal('${examId.replace(/'/g, "\\'")}')" class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs">Hapus</button></div><div id="soal-${examId}" class="hidden overflow-x-auto"><table class="w-full text-left text-xs"><tbody class="divide-y">${tableRows}</tbody></table></div></div>`; } document.getElementById('banksoal-container').innerHTML = html; }
let questionCount = 1;
function tambahBarisSoal() { questionCount++; const container = document.getElementById('bulk-questions-container'); const html = `<div class="question-item bg-slate-50 p-4 rounded-2xl border relative mt-4" data-no="${questionCount}"><div class="absolute -left-3 -top-3 w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center font-black shadow-lg text-xs">${questionCount}</div><button onclick="this.parentElement.remove()" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs shadow-md"><i class="fa fa-times"></i></button><div class="grid grid-cols-1 gap-3"><div class="grid grid-cols-1 md:grid-cols-3 gap-2"><div><label class="text-[10px] font-bold text-slate-500">TIPE SOAL</label><select class="q-tipe w-full p-2 border rounded-lg text-xs outline-none"><option value="PG">1 - Pilihan Ganda Biasa</option><option value="PGK">2 - PG Kompleks (Centang)</option><option value="JODOH">3 - Menjodohkan</option><option value="ISIAN">4 - Isian Singkat</option><option value="ESAI">5 - Uraian (Esai)</option><option value="BS">7 - Benar/Salah</option><option value="TS">9 - TS (Tabel Sesuai)</option><option value="SIFAT">10 - SIFAT</option><option value="GFORM">8 - Link G-Form</option></select></div><div><label class="text-[10px] font-bold text-slate-500">KUNCI JAWABAN</label><input type="text" class="q-kunci w-full p-2 border rounded-lg text-xs"></div><div><label class="text-[10px] font-bold text-blue-600">SKOR BOBOT</label><input type="number" class="q-skor w-full p-2 border bg-blue-50 rounded-lg text-xs font-bold" value="1"></div></div><div><label class="text-[10px] font-bold text-blue-500">LINK DRIVE GAMBAR</label><input type="text" class="q-image w-full p-2 border rounded-lg text-xs"></div><div><label class="text-[10px] font-bold text-slate-500">PERTANYAAN</label><textarea class="q-tanya w-full p-2 border rounded-lg text-xs h-16"></textarea></div><div class="q-area-opsi"><label class="text-[10px] font-bold text-orange-600">OPSI (Pemisah |||)</label><input type="text" class="q-opsi w-full p-2 border rounded-lg text-xs"></div></div></div>`; container.insertAdjacentHTML('beforeend', html); }
async function simpanSoalBulk() { const kodeUjian = document.getElementById('s_judul_bulk').value; if(!kodeUjian) return; const items = document.querySelectorAll('.question-item'); let dataSoal = []; items.forEach(el => { dataSoal.push({ exam_id: kodeUjian, tipe: el.querySelector('.q-tipe').value, tanya: el.querySelector('.q-tanya').value, opsi_json: el.querySelector('.q-opsi').value, kunci: el.querySelector('.q-kunci').value.toUpperCase(), gform_url: el.querySelector('.q-image').value, skor: parseFloat(el.querySelector('.q-skor').value) || 1 }); }); await fetch(API + '/admin/add-soal-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: dataSoal }) }); location.reload(); }

async function loadUsers() { const res = await fetch(API + '/admin/users'); const data = await res.json(); document.getElementById('user-body').innerHTML = data.map(u => `<tr><td class="p-2 font-medium">${u.name}</td><td>${u.username}</td><td>${u.kelas || u.mapel || '-'}</td><td>${u.role}</td><td class="text-right p-2"><button onclick='editUser(${JSON.stringify(u)})' class="bg-blue-100 text-blue-600 px-2 py-1 rounded mr-1">Edit</button><button onclick="hapusUser('${u.username}')" class="bg-red-100 text-red-600 px-2 py-1 rounded">Hapus</button></td></tr>`).join(''); }
function tambahUserManual() { Swal.fire({ title: 'Tambah User', html: `<div class="space-y-3 text-left"><div><label class="text-xs font-bold text-slate-500">Nama</label><input id="a_name" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Username</label><input id="a_user" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Password</label><input id="a_pass" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Role</label><select id="a_role" class="w-full p-2 border rounded"><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="admin">Admin</option></select></div><div><label class="text-xs font-bold text-slate-500">Kelas</label><input id="a_kelas" class="w-full p-2 border rounded"></div><div><label class="text-xs font-bold text-slate-500">Mapel</label><input id="a_mapel" class="w-full p-2 border rounded"></div></div>`, showCancelButton: true, preConfirm: () => { return { name: document.getElementById('a_name').value, username: document.getElementById('a_user').value, password: document.getElementById('a_pass').value, role: document.getElementById('a_role').value, kelas: document.getElementById('a_kelas').value, mapel: document.getElementById('a_mapel').value } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/add-user', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } }); }
function editUser(u) { Swal.fire({ title: 'Edit User', html: `<div class="space-y-3 text-left"><div><label class="text-xs font-bold text-slate-500">Nama</label><input id="e_name" class="w-full p-2 border rounded" value="${u.name}"></div><div><label class="text-xs font-bold text-slate-500">Username</label><input id="e_user" class="w-full p-2 border rounded" value="${u.username}"></div><div><label class="text-xs font-bold text-slate-500">Password</label><input id="e_pass" class="w-full p-2 border rounded" value="${u.password}"></div><div><label class="text-xs font-bold text-slate-500">Role</label><select id="e_role" class="w-full p-2 border rounded"><option value="siswa" ${u.role==='siswa'?'selected':''}>Siswa</option><option value="guru" ${u.role==='guru'?'selected':''}>Guru</option></select></div><div><label class="text-xs font-bold text-slate-500">Kelas</label><input id="e_kelas" class="w-full p-2 border rounded" value="${u.kelas||''}"></div><div><label class="text-xs font-bold text-slate-500">Mapel</label><input id="e_mapel" class="w-full p-2 border rounded" value="${u.mapel||''}"></div></div>`, showCancelButton: true, preConfirm: () => { return { old_username: u.username, name: document.getElementById('e_name').value, username: document.getElementById('e_user').value, password: document.getElementById('e_pass').value, role: document.getElementById('e_role').value, kelas: document.getElementById('e_kelas').value, mapel: document.getElementById('e_mapel').value } } }).then(async (res) => { if(res.isConfirmed) { await fetch(API+'/admin/update-user', {method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(res.value)}); loadUsers(); } }); }

async function hapusUser(usr) { await fetch(API+'/admin/delete-user/'+usr, {method:'DELETE'}); loadUsers(); }
async function hapusJadwal(id) { await fetch(API+'/admin/delete-schedule/'+id, {method:'DELETE'}); loadJadwal(); }
async function hapusPaketSoal(examId) { await fetch(API + '/admin/delete-exam/' + encodeURIComponent(examId), {method: 'DELETE'}); loadBankSoal(); loadJadwal(); }
async function hapusSoal(id) { await fetch(API + '/admin/delete-question/' + id, {method: 'DELETE'}); loadBankSoal(); }
async function clearMonitoring() { await fetch(API + '/admin/clear-monitoring', {method:'DELETE'}); loadStats(); }
async function clearResults() { await fetch(API + '/admin/clear-results', {method:'DELETE'}); loadNilai(); loadStats(); }
async function clearSchedules() { await fetch(API + '/admin/clear-schedules', {method:'DELETE'}); loadJadwal(); }
async function clearQuestions() { await fetch(API + '/admin/clear-questions', {method:'DELETE'}); loadBankSoal(); }
async function clearUsers() { await fetch(API + '/admin/clear-users', {method:'DELETE'}); loadUsers(); }

setInterval(() => { if(activeUser && activeUser.role !== 'siswa' && !document.getElementById('page-dashboard').classList.contains('hidden')) loadStats(); }, 3000);