// ============================================================
// CBT SPENDA — MODUL SISWA (PIN, konfirmasi, ruang ujian)
// ============================================================
const ABJAD = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MATRIX = ['BS', 'TS', 'NK', 'SIFAT'];

let examInfo = null, examTicket = null, examPin = '';
let cbtQuestions = [], cbtAnswers = {}, cbtRagu = {}, cbtCurrentIndex = 0, optOrder = {};
let isExamActive = false, examTimerInterval = null, pingInterval = null, curangCount = 0, lastViolation = 0;
let warnedFive = false, warnedOne = false;

const K = {
    state: () => `cbt4_state_${activeUser.username}_${examInfo.mapel}`,
    end: () => `cbt_time_${examInfo.mapel}_${activeUser.username}`,
    start: () => `cbt_start_${examInfo.mapel}_${activeUser.username}`,
    active: () => `cbt4_active_${activeUser.username}`,
    pending: () => `cbt4_pending_${activeUser.username}`,
};
const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    json(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
};

// ---------- Halaman PIN ----------
function bukaHalamanPin() {
    showView('view-siswa-token');
    $('nama-siswa-welcome').textContent = activeUser.name;
    $('kelas-siswa-welcome').textContent = activeUser.kelas ? 'Kelas ' + activeUser.kelas : '';
    const act = ls.json(K.active());
    $('resume-banner').classList.toggle('hidden', !act);
    if (act) { $('resume-mapel').textContent = act.mapel; $('input-pin').value = act.pin || ''; }
    $('pending-banner').classList.toggle('hidden', !ls.get(K.pending()));
    setTimeout(() => $('input-pin').focus(), 50);
    if (ls.get(K.pending()) && navigator.onLine) checkPendingSubmit(false);
}

async function cekPin() {
    const pin = $('input-pin').value.trim();
    if (!pin) return toast('Masukkan PIN ujian', 'warning');
    const btn = $('btn-cek-pin'); btn.disabled = true; btn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Memeriksa PIN…';
    try {
        const data = await api('/siswa/cek-pin', { body: { pin } });
        if (data.status === 'success') {
            examInfo = data.exam; examTicket = data.ticket; examPin = pin;
            tampilKonfirmasi();
        } else if (data.status === 'locked') {
            tampilTerkunci(data.message);
        } else if (data.status === 'finished') {
            ls.del(K.active());
            Swal.fire({ icon: 'success', title: 'Ujian sudah selesai', text: data.message });
        } else {
            Swal.fire({ icon: 'error', title: 'PIN tidak bisa dipakai', text: data.message });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Tidak bisa terhubung', text: 'Periksa koneksi internet lalu coba lagi.' });
    } finally { btn.disabled = false; btn.textContent = 'Lanjut'; }
}

function tampilKonfirmasi() {
    const fmtTgl = t => { try { return new Date(t + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return t; } };
    const rows = [
        ['Nama', esc(activeUser.name)], ['Kelas', esc(activeUser.kelas || '-')],
        ['Paket ujian', `<b>${esc(examInfo.mapel)}</b>`], ['Jumlah soal', examInfo.jumlah_soal + ' soal'],
        ['Waktu', examInfo.durasi + ' menit'],
    ];
    if (examInfo.tanggal) rows.push(['Jadwal', esc(fmtTgl(examInfo.tanggal) + (examInfo.jam ? ', ' + examInfo.jam : ''))]);
    $('konfirmasi-data').innerHTML = rows.map(([k, v]) => `<div class="flex justify-between gap-4 px-5 py-3"><dt class="text-muted text-sm">${k}</dt><dd class="text-right font-semibold">${v}</dd></div>`).join('');
    const resume = !!ls.json(K.state()) || examInfo.resume;
    $('btn-mulai').textContent = resume ? 'Lanjutkan mengerjakan' : 'Mulai mengerjakan';
    $('setuju-tatib').checked = false; $('btn-mulai').disabled = true;
    showView('view-siswa-konfirmasi');
}
function batalKonfirmasi() { examInfo = null; examTicket = null; bukaHalamanPin(); }

// ---------- Acak deterministik per siswa ----------
function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function shuffle(arr, rnd) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- Mulai ujian ----------
async function mulaiUjian() {
    const btn = $('btn-mulai'); btn.disabled = true; btn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Menyiapkan soal…';
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    try {
        const data = await api('/siswa/get-soal', { body: { ticket: examTicket } });
        if (!data.questions || !data.questions.length) throw new Error('Soal tidak ditemukan.');
        let qs = data.questions;
        const rnd = seeded(activeUser.username + '|' + examInfo.mapel);
        if (examInfo.acak_soal && qs[0].tipe !== 'GFORM') qs = shuffle(qs, rnd);
        optOrder = {};
        qs.forEach(q => {
            const n = splitOpsi(q).length, idx = [...Array(n).keys()];
            optOrder[q.id] = (examInfo.acak_opsi && (q.tipe === 'PG' || q.tipe === 'PGK')) ? shuffle(idx, rnd) : idx;
        });
        cbtQuestions = qs;
        const st = ls.json(K.state()) || {};
        cbtAnswers = st.answers || {}; cbtRagu = st.ragu || {};
        cbtCurrentIndex = Math.min(st.idx || 0, qs.length - 1);

        if (!ls.get(K.end())) ls.set(K.end(), Date.now() + examInfo.durasi * 60000);
        if (!ls.get(K.start())) ls.set(K.start(), Date.now());
        ls.set(K.active(), JSON.stringify({ mapel: examInfo.mapel, pin: examPin }));

        $('ujian-mapel-title').textContent = examInfo.mapel;
        $('ujian-nama-siswa').textContent = activeUser.name;
        $('cbt-total-soal').textContent = qs.length;
        applyFont();
        showView('view-siswa-ujian');
        document.body.classList.add('exam-active');
        curangCount = 0; warnedFive = warnedOne = false;
        isExamActive = true;
        startTimer();
        showCbtQuestion(cbtCurrentIndex);
        kirimPing();
        clearInterval(pingInterval);
        pingInterval = setInterval(kirimPing, 15000);
        updateNetwork();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Gagal memuat soal', text: e.message || 'Periksa koneksi lalu coba lagi.' });
        btn.disabled = false; btn.textContent = 'Mulai mengerjakan';
    }
}

function saveState() {
    if (!examInfo || !activeUser) return;
    ls.set(K.state(), JSON.stringify({ answers: cbtAnswers, ragu: cbtRagu, idx: cbtCurrentIndex }));
}
const elapsedSec = () => { const s = parseInt(ls.get(K.start()) || Date.now()); return Math.floor((Date.now() - s) / 1000); };

// ---------- Timer ----------
function startTimer() {
    clearInterval(examTimerInterval);
    const tick = () => {
        const end = parseInt(ls.get(K.end()) || 0);
        const left = Math.floor((end - Date.now()) / 1000);
        const box = $('timer-box');
        if (left <= 0) {
            clearInterval(examTimerInterval); $('exam-countdown').textContent = '00:00:00';
            if (isExamActive) { Swal.fire({ icon: 'info', title: 'Waktu habis', text: 'Jawabanmu dikumpulkan otomatis.', timer: 2500, showConfirmButton: false }); kirimJawaban(); }
            return;
        }
        const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
        $('exam-countdown').textContent = [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
        box.classList.toggle('is-warn', left <= 300 && left > 60);
        box.classList.toggle('is-crit', left <= 60);
        if (left <= 300 && !warnedFive) { warnedFive = true; toast('Sisa waktu 5 menit', 'warning'); }
        if (left <= 60 && !warnedOne) { warnedOne = true; toast('Sisa waktu 1 menit!', 'warning'); }
    };
    tick(); examTimerInterval = setInterval(tick, 1000);
}

// ---------- Ping progres ----------
async function kirimPing() {
    if (!isExamActive || !navigator.onLine) return;
    try {
        const r = await api('/siswa/ping', { body: { ticket: examTicket, answers: cbtAnswers, elapsed: elapsedSec() }, quiet: true });
        if (r && r.status === 'protected') {
            if ((r.state || '').includes('Terkunci')) { stopUjian(); tampilTerkunci(); }
            else if (r.state === 'Selesai') { stopUjian(); bersihkanLokal(); tampilSelesai({ show_score: false }); }
        }
    } catch (e) {}
}

// ---------- Status jawaban ----------
function pairCount(q) { return q.pair_count || ((q.tanya || '').split(/\r?\n|<br\s*\/?>/i).filter(l => /^\s*\d+[.)]\s?/.test(l)).length) || 4; }
function isAnswered(q) {
    const a = cbtAnswers[q.id] || '';
    if (!a) return false;
    if (MATRIX.includes(q.tipe)) return !a.split(',').includes('-');
    if (q.tipe === 'JODOH') return a.split(',').filter(Boolean).length >= pairCount(q);
    return true;
}
function hitung() {
    let dijawab = 0, ragu = 0;
    cbtQuestions.forEach(q => { if (isAnswered(q)) dijawab++; if (cbtRagu[q.id]) ragu++; });
    return { dijawab, ragu, kosong: cbtQuestions.length - dijawab, total: cbtQuestions.length };
}

function renderCbtGrid() {
    $('cbt-grid').innerHTML = cbtQuestions.map((q, i) => {
        const cls = cbtRagu[q.id] ? 'is-ragu' : (isAnswered(q) ? 'is-filled' : '');
        const lbl = `Soal ${i + 1}${cbtRagu[q.id] ? ', ragu-ragu' : isAnswered(q) ? ', sudah dijawab' : ', belum dijawab'}`;
        return `<button class="ljk-cell ${cls} ${i === cbtCurrentIndex ? 'is-current' : ''}" onclick="lompatKe(${i})" aria-label="${lbl}">${i + 1}</button>`;
    }).join('');
    const h = hitung();
    $('nav-summary').textContent = `${h.dijawab} dari ${h.total} dijawab${h.ragu ? ` · ${h.ragu} ragu-ragu` : ''}`;
    $('exam-progress').style.width = (h.dijawab / h.total * 100) + '%';
    $('nav-badge').textContent = h.kosong || '';
}
function lompatKe(i) { showCbtQuestion(i); if (window.innerWidth < 1024) toggleCbtNav(false); }
function toggleCbtNav(force) {
    const p = $('cbt-nav-panel'), open = force === undefined ? !p.classList.contains('is-open') : force;
    p.classList.toggle('is-open', open); $('cbt-nav-overlay').classList.toggle('hidden', !open);
}

// ---------- Ukuran huruf ----------
function applyFont() { const s = parseInt(ls.get('cbt_font') || 17); document.documentElement.style.setProperty('--soal-size', s + 'px'); }
function ubahFont(d) { const s = Math.min(24, Math.max(14, parseInt(ls.get('cbt_font') || 17) + d * 2)); ls.set('cbt_font', s); applyFont(); }

// ---------- Tampilkan soal ----------
function showCbtQuestion(index) {
    cbtCurrentIndex = index; saveState();
    const q = cbtQuestions[index]; const saved = cbtAnswers[q.id] || '';
    $('cbt-no-soal').textContent = index + 1;
    $('cbt-tipe-soal').textContent = TIPE_LABEL[q.tipe] || q.tipe;
    $('btn-prev').disabled = index === 0;
    const last = index === cbtQuestions.length - 1;
    $('btn-next').innerHTML = last ? '<span>Selesai</span><i class="fa fa-flag-checkered"></i>' : '<span class="hidden sm:inline">Berikutnya</span><i class="fa fa-chevron-right"></i>';
    $('btn-next').className = last ? 'btn btn-ok' : 'btn btn-primary';
    $('btn-ragu').setAttribute('aria-pressed', cbtRagu[q.id] ? 'true' : 'false');

    const mediaUrl = (q.media_path && String(q.media_path).startsWith('http')) ? q.media_path : ((q.gform_url && String(q.gform_url).startsWith('http') && q.tipe !== 'GFORM') ? q.gform_url : '');
    $('cbt-media-area').innerHTML = mediaUrl && q.tipe !== 'GFORM' ? `<div class="soal-media">${imgTag(mediaUrl, 1200)}</div>` : '';

    const opsi = splitOpsi(q); const order = optOrder[q.id] || opsi.map((_, i) => i);
    let tanyaHtml = '', html = '';

    if (q.tipe === 'GFORM') {
        tanyaHtml = '<p>Kerjakan soal pada formulir di bawah, lalu tekan <b>Kirim</b> di dalam formulir.</p>';
        html = `<div class="rounded-2xl overflow-hidden border border-line" style="height:70vh"><iframe src="${esc(q.tanya || q.gform_url)}" class="w-full h-full border-0"></iframe></div>`;
        if (!saved) { cbtAnswers[q.id] = 'COMPLETED'; saveState(); }
    } else if (q.tipe === 'JODOH') {
        const lines = (q.tanya || '').split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
        const premis = lines.filter(l => /^\d+[.)]\s?/.test(l)), utama = lines.filter(l => !/^\d+[.)]\s?/.test(l));
        tanyaHtml = formatMath(utama.join('<br>'));
        const n = pairCount(q); const sv = saved ? saved.split(',') : [];
        html = `<p class="hint"><i class="fa fa-link"></i>Pilih pasangan yang tepat untuk setiap nomor.</p>`;
        for (let i = 0; i < n; i++) {
            const cur = (sv.find(x => parseInt(x) === i + 1) || '').replace(/[0-9]/g, '');
            html += `<div class="jodoh-row ${cur ? 'is-on' : ''}"><span class="font-semibold">${formatMath(premis[i] || `Pernyataan ${i + 1}`)}</span>
                <select class="field jodoh-select" data-no="${i + 1}" onchange="cbtSaveJodoh()"><option value="">Pilih pasangan…</option>
                ${opsi.map((o, k) => `<option value="${ABJAD[k]}" ${cur === ABJAD[k] ? 'selected' : ''}>${ABJAD[k]}. ${esc(o.replace(/<[^>]+>/g, ''))}</option>`).join('')}</select></div>`;
        }
    } else {
        tanyaHtml = formatMath((q.tanya || '').replace(/\n/g, '<br>'));
        if (q.tipe === 'PG' || q.tipe === 'PGK') {
            const multi = q.tipe === 'PGK'; const sv = saved.split(',').filter(Boolean);
            const imgMode = opsi.some(isImageUrl);
            if (multi) html += `<p class="hint"><i class="fa fa-list-check"></i>Pilih semua jawaban yang benar (bisa lebih dari satu).</p>`;
            html += `<div class="${imgMode ? 'opsi-grid' : ''}" role="${multi ? 'group' : 'radiogroup'}">`;
            order.forEach((orig, pos) => {
                const val = ABJAD[orig], on = sv.includes(val), o = opsi[orig];
                const content = isImageUrl(o) ? imgTag(o, 600) : `<span class="opsi-text">${formatMath(o)}</span>`;
                html += `<button type="button" class="opsi ${multi ? 'is-square' : ''} ${on ? 'is-on' : ''}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${on}" data-val="${val}" onclick="pilihOpsi(this, ${multi})"><span class="bubble">${ABJAD[pos]}</span>${content}</button>`;
            });
            html += '</div>';
        } else if (MATRIX.includes(q.tipe)) {
            const sv = saved ? saved.split(',') : [];
            const hm = (opsi[0] || '').match(/^HEADER\[(.+)\]$/i);
            let heads, rows = hm ? opsi.slice(1) : opsi;
            if (q.tipe === 'BS') heads = ['Benar', 'Salah'];
            else if (q.tipe === 'TS') heads = ['Sesuai', 'Tidak sesuai'];
            else if (hm) heads = hm[1].split(',').map(h => h.trim()).filter(Boolean);
            else heads = q.tipe === 'NK' ? ['Numerik', 'Kategorik'] : ['Komutatif', 'Asosiatif', 'Distributif'];
            if (!rows.length) rows = ['Pernyataan 1', 'Pernyataan 2'];
            html = `<p class="hint"><i class="fa fa-table"></i>Pilih satu jawaban di setiap baris.</p><div class="mx-wrap"><table class="matrix"><thead><tr><th>${q.tipe === 'NK' ? 'Data' : 'Pernyataan'}</th>${heads.map(h => `<th class="c">${formatMath(h)}</th>`).join('')}</tr></thead><tbody>`;
            rows.forEach((r, i) => {
                html += `<tr><td>${formatMath(r)}</td>${heads.map((h, k) => `<td class="c"><input type="radio" class="mx-radio" name="matrix_${i}" value="${ABJAD[k]}" ${sv[i] === ABJAD[k] ? 'checked' : ''} onchange="cbtSaveMatrix(${rows.length})" aria-label="Baris ${i + 1}: ${esc(h)}"></td>`).join('')}</tr>`;
            });
            html += '</tbody></table></div>';
        } else if (q.tipe === 'ISIAN') {
            html = `<label class="field-label" for="jawab-isian">Jawabanmu</label><input id="jawab-isian" class="field" style="font-size:inherit;height:auto;padding:12px 14px" value="${esc(saved)}" oninput="cbtSaveText(this.value)" placeholder="Ketik jawaban singkat…" autocomplete="off">`;
        } else if (q.tipe === 'ESAI') {
            html = `<label class="field-label" for="jawab-esai">Jawabanmu</label><textarea id="jawab-esai" class="field" rows="7" style="font-size:inherit" oninput="cbtSaveText(this.value)" placeholder="Uraikan jawabanmu di sini…">${esc(saved)}</textarea>`;
        }
    }
    $('cbt-tanya').innerHTML = tanyaHtml;
    $('cbt-opsi-area').innerHTML = html;
    applyMathRendering($('soal-body'));
    $('soal-scroll').scrollTop = 0;
    renderCbtGrid();
}

function setAnswer(val) { cbtAnswers[cbtQuestions[cbtCurrentIndex].id] = val; saveState(); renderCbtGrid(); }
function pilihOpsi(btn, multi) {
    const wrap = btn.parentElement;
    if (!multi) wrap.querySelectorAll('.opsi').forEach(b => { b.classList.remove('is-on'); b.setAttribute('aria-checked', 'false'); });
    const on = multi ? !btn.classList.contains('is-on') : true;
    btn.classList.toggle('is-on', on); btn.setAttribute('aria-checked', on);
    const vals = [...wrap.querySelectorAll('.opsi.is-on')].map(b => b.dataset.val).sort();
    setAnswer(vals.join(','));
}
function cbtSaveMatrix(n) {
    const arr = []; for (let i = 0; i < n; i++) { const s = document.querySelector(`input[name="matrix_${i}"]:checked`); arr.push(s ? s.value : '-'); }
    setAnswer(arr.join(','));
}
function cbtSaveJodoh() {
    const arr = []; document.querySelectorAll('.jodoh-select').forEach(s => { s.closest('.jodoh-row').classList.toggle('is-on', !!s.value); if (s.value) arr.push(s.dataset.no + s.value); });
    setAnswer(arr.join(','));
}
let textTimer = null;
function cbtSaveText(v) { cbtAnswers[cbtQuestions[cbtCurrentIndex].id] = v; clearTimeout(textTimer); textTimer = setTimeout(() => { saveState(); renderCbtGrid(); }, 300); }

function toggleRagu() {
    const q = cbtQuestions[cbtCurrentIndex];
    if (cbtRagu[q.id]) delete cbtRagu[q.id]; else cbtRagu[q.id] = true;
    $('btn-ragu').setAttribute('aria-pressed', cbtRagu[q.id] ? 'true' : 'false');
    saveState(); renderCbtGrid();
}
function cbtNext() { if (cbtCurrentIndex < cbtQuestions.length - 1) showCbtQuestion(cbtCurrentIndex + 1); else bukaRingkasan(); }
function cbtPrev() { if (cbtCurrentIndex > 0) showCbtQuestion(cbtCurrentIndex - 1); }

// Navigasi keyboard: ← → pindah soal, A–E memilih opsi (PG)
document.addEventListener('keydown', e => {
    if (!isExamActive) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { e.preventDefault(); return; }
    if (Swal.isVisible() || !$('modal').classList.contains('hidden')) return;
    const tag = (document.activeElement || {}).tagName;
    if (tag === 'INPUT' && document.activeElement.type !== 'radio' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); cbtNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); cbtPrev(); }
    else if (/^[a-eA-E]$/.test(e.key)) {
        const btns = document.querySelectorAll('#cbt-opsi-area .opsi');
        const b = btns[ABJAD.indexOf(e.key.toUpperCase())];
        if (b) b.click();
    }
});

// ---------- Ringkasan & kirim ----------
function bukaRingkasan() {
    toggleCbtNav(false);
    const h = hitung();
    const kosongList = cbtQuestions.map((q, i) => (!isAnswered(q) ? i : -1)).filter(i => i >= 0);
    const raguList = cbtQuestions.map((q, i) => (cbtRagu[q.id] ? i : -1)).filter(i => i >= 0);
    const chips = (list, cls) => list.map(i => `<button class="ljk-cell ${cls}" style="width:40px" onclick="closeModal(); lompatKe(${i})">${i + 1}</button>`).join('');
    let pesan = h.kosong ? `Masih ada <b>${h.kosong} soal</b> yang belum dijawab.` : (h.ragu ? `Semua soal sudah dijawab, tapi <b>${h.ragu} soal</b> masih ditandai ragu-ragu.` : 'Semua soal sudah dijawab. Periksa sekali lagi jika masih ada waktu.');
    openModal('<h2 class="font-extrabold text-lg">Kumpulkan jawaban?</h2>', `
        <div class="summary-grid"><div><b>${h.dijawab}</b><span class="text-sm text-muted">Dijawab</span></div>
        <div style="background:var(--gold-50)"><b style="color:var(--gold-700)">${h.ragu}</b><span class="text-sm text-muted">Ragu-ragu</span></div>
        <div style="${h.kosong ? 'background:var(--bad-50)' : ''}"><b style="${h.kosong ? 'color:var(--bad)' : ''}">${h.kosong}</b><span class="text-sm text-muted">Belum</span></div></div>
        <p class="mt-5">${pesan} Setelah dikumpulkan, jawaban tidak bisa diubah.</p>
        ${kosongList.length ? `<p class="text-sm font-bold mt-5 mb-2">Belum dijawab — ketuk untuk membuka</p><div class="flex flex-wrap gap-2">${chips(kosongList, '')}</div>` : ''}
        ${raguList.length ? `<p class="text-sm font-bold mt-5 mb-2">Ragu-ragu</p><div class="flex flex-wrap gap-2">${chips(raguList, 'is-ragu')}</div>` : ''}`,
        { foot: `<button class="btn btn-ghost" onclick="closeModal()">Periksa lagi</button><button class="btn btn-ok" onclick="closeModal(); kirimJawaban()"><i class="fa fa-paper-plane"></i> Kumpulkan sekarang</button>` });
}

function stopUjian() {
    isExamActive = false; clearInterval(examTimerInterval); clearInterval(pingInterval);
    document.body.classList.remove('exam-active');
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
}
function bersihkanLokal() { [K.state(), K.end(), K.start(), K.active()].forEach(k => ls.del(k)); }

async function kirimJawaban(isCurang = false) {
    const payload = { ticket: examTicket, answers: cbtAnswers, elapsed: elapsedSec(), is_curang: isCurang, mapel: examInfo.mapel };
    stopUjian(); saveState();
    if (!navigator.onLine) return simpanPending(payload);
    loading('Mengirim jawaban…');
    try {
        const r = await api('/siswa/submit', { body: payload });
        if (r.status !== 'success') throw new Error(r.message);
        Swal.close(); bersihkanLokal(); tampilSelesai(r);
    } catch (e) { simpanPending(payload); }
}
function simpanPending(payload) {
    ls.set(K.pending(), JSON.stringify(payload));
    Swal.close();
    showView('view-siswa-selesai');
    $('selesai-content').innerHTML = `<i class="fa fa-cloud-arrow-up text-5xl text-gold mb-5"></i>
        <h1 class="text-2xl font-extrabold">Jawaban disimpan di perangkat</h1>
        <p class="text-muted mt-2">Koneksi ke server terputus. Jangan hapus data browser. Jawaban akan dikirim begitu perangkat online kembali.</p>
        <button onclick="checkPendingSubmit(true)" class="btn btn-primary w-full h-12 mt-8">Coba kirim sekarang</button>`;
}
async function checkPendingSubmit(feedback) {
    if (!activeUser) return;
    const p = ls.json(K.pending()); if (!p) return;
    if (!navigator.onLine) { if (feedback) toast('Masih offline', 'error'); return; }
    if (feedback) loading('Mengirim jawaban…');
    try {
        const r = await api('/siswa/submit', { body: p });
        if (r.status !== 'success') throw new Error(r.message);
        ls.del(K.pending());
        try { Object.keys(localStorage).filter(k => k.includes(activeUser.username) && (k.startsWith('cbt4_state_') || k.startsWith('cbt_time_') || k.startsWith('cbt_start_') || k.startsWith('cbt4_active_')) && (!p.mapel || k.includes(p.mapel))).forEach(k => localStorage.removeItem(k)); } catch (e) {}
        Swal.close(); tampilSelesai(r);
    } catch (e) { if (feedback) Swal.fire({ icon: 'error', title: 'Belum terkirim', text: 'Koneksi belum stabil. Coba lagi sebentar.' }); }
}

function tampilSelesai(r) {
    showView('view-siswa-selesai');
    const nilai = r && r.show_score && r.nilai !== null && r.nilai !== undefined && !isNaN(r.nilai) ? Number(r.nilai) : null;
    $('selesai-content').innerHTML = `
        ${nilai !== null ? `<div class="score-ring" style="--p:${nilai}"><div><p class="text-sm text-muted font-semibold">Nilai</p><p class="text-5xl font-extrabold tabular-nums">${nilai}</p></div></div>`
            : `<div class="w-20 h-20 rounded-full bg-ok-50 text-ok grid place-items-center mx-auto text-3xl"><i class="fa fa-check"></i></div>`}
        <h1 class="text-2xl font-extrabold mt-7">Jawaban terkirim</h1>
        <p class="text-muted mt-2">Terima kasih, ${esc(activeUser.name.split(' ')[0])}. ${r && r.total ? `Kamu menjawab ${r.terjawab} dari ${r.total} soal. ` : ''}Hasil lengkap akan diumumkan oleh guru.</p>
        <button onclick="logout()" class="btn btn-primary w-full h-12 mt-8">Keluar</button>`;
}
function tampilTerkunci(msg) {
    showView('view-siswa-selesai');
    $('selesai-content').innerHTML = `<div class="w-20 h-20 rounded-full bg-bad-50 text-bad grid place-items-center mx-auto text-3xl"><i class="fa fa-lock"></i></div>
        <h1 class="text-2xl font-extrabold mt-7">Akun terkunci sementara</h1>
        <p class="text-muted mt-2">${esc(msg || 'Kamu meninggalkan layar ujian lebih dari 3 kali.')} Jawabanmu tetap tersimpan.</p>
        <ol class="rules text-left mt-6 card p-5"><li>Angkat tangan dan beri tahu pengawas.</li><li>Tunggu pengawas membuka akses dari panel guru.</li><li>Masuk lagi, ketik PIN yang sama, dan lanjutkan dari soal terakhir.</li></ol>
        <button onclick="logout()" class="btn btn-primary w-full h-12 mt-6">Keluar</button>`;
}

// ---------- Deteksi kecurangan ----------
function deteksiKecurangan() {
    if (!isExamActive || !navigator.onLine) return;
    if (Date.now() - lastViolation < 2000) return; // blur + visibilitychange = satu kejadian
    lastViolation = Date.now();
    curangCount++;
    api('/siswa/flag-curang', { body: { ticket: examTicket, count: curangCount, answers: cbtAnswers, elapsed: elapsedSec() }, quiet: true }).catch(() => {});
    if (curangCount >= 4) {
        stopUjian(); saveState(); tampilTerkunci();
        return;
    }
    const sisa = 3 - curangCount;
    Swal.fire({
        icon: 'warning', title: `Peringatan ${curangCount} dari 3`,
        html: `<p>Kamu terdeteksi meninggalkan layar ujian.</p><p class="mt-3 ${sisa === 0 ? 'text-bad font-bold' : ''}">${sisa === 0 ? 'Ini peringatan terakhir. Pelanggaran berikutnya akan mengunci akunmu.' : `Sisa toleransi: <b>${sisa}×</b>. Pelanggaran ke-4 mengunci akun.`}</p>`,
        confirmButtonText: 'Kembali ke ujian', allowOutsideClick: false, allowEscapeKey: false,
    }).then(() => { if (isExamActive && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') deteksiKecurangan(); });
// Klik di dalam iframe Google Form memicu 'blur' — itu bukan pelanggaran
window.addEventListener('blur', () => setTimeout(() => { if ((document.activeElement || {}).tagName !== 'IFRAME') deteksiKecurangan(); }, 0));
document.addEventListener('fullscreenchange', () => { if (isExamActive && !document.fullscreenElement) deteksiKecurangan(); });
document.addEventListener('contextmenu', e => { if (isExamActive) e.preventDefault(); });
document.addEventListener('copy', e => { if (isExamActive) e.preventDefault(); });
document.addEventListener('keyup', e => { if (isExamActive && e.key === 'PrintScreen') { try { navigator.clipboard.writeText(''); } catch (x) {} toast('Tangkapan layar tidak diizinkan', 'warning'); } });

function updateNetwork() {
    const el = $('network-status'); if (!el) return;
    el.textContent = navigator.onLine ? 'Online' : 'Offline';
    el.classList.toggle('is-off', !navigator.onLine);
    $('offline-pending-alert').classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', () => { updateNetwork(); if (activeUser && activeUser.role === 'siswa') { kirimPing(); checkPendingSubmit(false); } });
window.addEventListener('offline', updateNetwork);
