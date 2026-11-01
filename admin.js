// ============================================================
// CBT SPENDA — PANEL ADMIN & GURU
// ============================================================
const isAdmin = () => activeUser && activeUser.role === 'admin';
const PAGE_TITLE = { dashboard: 'Pemantauan', jadwal: 'Jadwal & PIN', banksoal: 'Bank soal', nilai: 'Hasil & analisis', users: 'Peserta & guru', akun: 'Akun saya', sekolah: 'Profil sekolah' };
let currentPage = 'dashboard', dashTimer = null;
let allActivityData = [], allSchedules = [], allQuestions = [], allResults = [], allUsers = [];

function bukaPanelAdmin() {
    showView('view-admin');
    $('admin-user-name').textContent = activeUser.name;
    $('admin-user-role').textContent = isAdmin() ? 'Administrator' : 'Guru' + (activeUser.mapel ? ' · ' + activeUser.mapel : '');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    if (!isAdmin()) { $('role-badge').textContent = 'Guru'; $('role-badge').classList.remove('hidden'); }
    let start = 'dashboard';
    try { start = sessionStorage.getItem('cbt_page') || 'dashboard'; } catch (e) {}
    if (!isAdmin() && ['jadwal', 'users', 'sekolah'].includes(start)) start = 'dashboard';
    showPage(start);
    clearInterval(dashTimer);
    dashTimer = setInterval(() => { if (currentPage === 'dashboard' && document.visibilityState === 'visible') refreshDashboard(true); }, 5000);
}

function toggleAdminSidebar(force) {
    const s = $('admin-sidebar'), open = force === undefined ? !s.classList.contains('is-open') : force;
    s.classList.toggle('is-open', open); $('admin-overlay').classList.toggle('hidden', !open);
}

function showPage(p) {
    if (!activeUser || activeUser.role === 'siswa') return;
    if (!isAdmin() && ['jadwal', 'users', 'sekolah'].includes(p)) p = 'dashboard';
    currentPage = p;
    try { sessionStorage.setItem('cbt_page', p); } catch (e) {}
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    $('page-' + p).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.page === p));
    $('page-title').textContent = PAGE_TITLE[p];
    toggleAdminSidebar(false);
    ({ dashboard: initDashboard, jadwal: loadJadwal, banksoal: loadBankSoal, nilai: loadNilai, users: loadUsers, akun: renderAkun, sekolah: renderSekolah })[p]();
}

const pageHead = (title, sub, right = '') => `<div class="page-head"><div class="flex-1 min-w-[220px]"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>`;
const emptyBox = (icon, text, action = '') => `<div class="empty"><i class="fa ${icon}"></i><p>${text}</p>${action}</div>`;

// =============================================================
// PEMANTAUAN
// =============================================================
function initDashboard() {
    if (!$('mon-groups')) {
        $('page-dashboard').innerHTML = pageHead('Pemantauan ujian', 'Status peserta diperbarui otomatis setiap 5 detik.',
            `<div class="flex flex-wrap gap-2 w-full sm:w-auto">
                <input id="mon-search" class="field field-sm sm:w-48" placeholder="Cari nama…" oninput="renderActivityTable()">
                <select id="filter-mapel" class="field field-sm w-auto" onchange="renderActivityTable()"><option value="">Semua paket</option></select>
                <select id="filter-kelas" class="field field-sm w-auto" onchange="renderActivityTable()"><option value="">Semua kelas</option></select>
                <button onclick="bukaPapanSkor()" class="btn btn-sm btn-outline" title="Buka papan skor untuk proyektor/TV"><i class="fa fa-ranking-star"></i> Papan skor</button>
                ${isAdmin() ? `<button onclick="clearMonitoring()" class="btn btn-sm btn-outline" title="Hapus semua data pemantauan"><i class="fa fa-broom"></i> Bersihkan</button>` : ''}
            </div>`) +
            `<div id="dash-stats" class="stat-strip mb-5" style="--n:6"></div>
             <div id="dash-pins" class="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6"></div>
             <div id="mon-groups" class="space-y-5"></div>`;
    }
    refreshDashboard();
}

async function refreshDashboard(silent) {
    try {
        const [stats, sch, act] = await Promise.all([api('/admin/stats'), api('/admin/schedules'), api('/admin/recent-activity')]);
        allSchedules = sch || []; allActivityData = act || [];
        $('dash-stats').dataset.base = JSON.stringify(stats);
        const aktif = allSchedules.filter(s => s.status === 'Aktif');
        $('dash-pins').innerHTML = aktif.map(s => `<div class="pin-card">
            <div class="flex-1 min-w-0"><p class="text-sm text-white/70 truncate" title="${esc(s.mapel)}">${esc(s.mapel)}</p><p class="pin mt-1">${esc(s.pin)}</p></div>
            <button class="icon-btn text-white/80 hover:bg-white/10 hover:text-white" onclick="copyText('${jsq(s.pin)}')" aria-label="Salin PIN"><i class="fa fa-copy"></i></button></div>`).join('')
            || (isAdmin() ? `<div class="card px-5 py-4 sm:col-span-2 text-sm text-muted flex items-center gap-3"><i class="fa fa-circle-info"></i>Belum ada ujian aktif. <button class="btn btn-xs btn-outline ml-auto" onclick="showPage('jadwal')">Buat jadwal</button></div>` : '');
        fillSelect('filter-mapel', allActivityData.map(a => a.exam_name), 'Semua paket');
        fillSelect('filter-kelas', allActivityData.map(a => a.kelas).filter(k => k && k !== '-'), 'Semua kelas');
        renderActivityTable();
        $('sync-indicator').textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        $('sync-indicator').classList.remove('hidden');
    } catch (e) { if (!silent) toast('Gagal memuat data pemantauan', 'error'); }
}

function bolehBuka(exam) {
    if (isAdmin()) return true;
    const m = (activeUser.mapel || '').toLowerCase();
    if (!m || m === 'semua') return true;
    const ex = (exam || '').toLowerCase();
    return m.split(',').map(x => x.trim()).filter(Boolean).some(x => ex.includes(x) || x.includes(ex));
}

function renderActivityTable() {
    if (!$('mon-groups')) return;
    const k = $('filter-kelas').value, m = $('filter-mapel').value, q = ($('mon-search').value || '').toLowerCase();
    const list = allActivityData.filter(a => (!k || a.kelas === k) && (!m || a.exam_name === m) && (!q || (a.student_name || '').toLowerCase().includes(q)));
    const groups = { act: [], work: [], done: [] };
    list.forEach(a => { const s = statusInfo(a.status).key; (s === 'locked' || s === 'warned' ? groups.act : s === 'done' ? groups.done : groups.work).push(a); });
    groups.work.sort((a, b) => (parseProgress(b.last_seen)?.done || 0) - (parseProgress(a.last_seen)?.done || 0));
    groups.done.sort((a, b) => scoreNum(b.score) - scoreNum(a.score));
    groups.act.sort((a, b) => statusInfo(a.status).key === 'locked' ? -1 : 1);

    const base = JSON.parse($('dash-stats').dataset.base || '{}');
    const stat = (n, l, c = '') => `<div><p class="stat-num ${c}">${n}</p><p class="stat-label">${l}</p></div>`;
    $('dash-stats').innerHTML = stat(base.total_siswa ?? '–', 'Siswa terdaftar') + stat(base.total_guru ?? '–', 'Guru') + stat(base.total_paket ?? '–', 'Paket soal')
        + stat(groups.work.length, 'Sedang mengerjakan', 'text-navy') + stat(groups.done.length, 'Selesai', 'text-ok') + stat(groups.act.length, 'Perlu tindakan', groups.act.length ? 'text-bad' : '');

    if (!allActivityData.length) { $('mon-groups').innerHTML = `<div class="card">${emptyBox('fa-users-viewfinder', 'Belum ada peserta yang mulai ujian. Mereka akan muncul di sini begitu memasukkan PIN.')}</div>`; return; }

    const row = a => {
        const st = statusInfo(a.status), p = parseProgress(a.last_seen) || {};
        const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
        let aksi = '';
        if (st.key === 'locked' || st.key === 'warned') aksi += bolehBuka(a.exam_name) ? `<button class="btn btn-xs btn-primary" onclick="resetSiswa('${jsq(a.student_name)}','${jsq(a.exam_name)}')"><i class="fa fa-lock-open"></i> Buka akses</button>` : '';
        if (isAdmin()) aksi += `<button class="icon-btn icon-btn-sm" title="Opsi lain" onclick="menuAktivitas(${a.id}, '${jsq(a.student_name)}','${jsq(a.exam_name)}')"><i class="fa fa-ellipsis"></i></button>`;
        return `<tr>
            <td class="min-w-[170px]"><p class="font-semibold">${esc(a.student_name)}</p><p class="text-xs text-muted">${esc(a.kelas || '-')} · ${esc(a.exam_name)}</p></td>
            <td><span class="chip ${st.chip}">${st.label}</span></td>
            <td class="min-w-[150px]">${p.total ? `<div class="flex items-center gap-2"><div class="progress flex-1"><i style="width:${pct}%"></i></div><span class="text-xs tabular-nums text-muted w-12">${p.done}/${p.total}</span></div>` : '<span class="text-xs text-muted">Baru mulai</span>'}</td>
            <td class="num font-bold text-base">${st.key === 'work' ? `<span class="text-muted font-semibold text-sm">${esc(String(a.score ?? '-'))}</span>` : esc(String(a.score ?? '-').split('|')[0])}</td>
            <td class="text-xs text-muted whitespace-nowrap">${esc(p.durasi || '-')}<br>${esc(p.jam || '')}</td>
            <td class="text-right whitespace-nowrap">${aksi}</td></tr>`;
    };
    const group = (title, dot, arr, note) => arr.length ? `<div class="card overflow-hidden">
        <div class="group-head"><span class="dot" style="background:${dot}"></span><h3 class="font-bold">${title}</h3><span class="chip chip-muted">${arr.length}</span><span class="text-xs text-muted ml-auto hidden sm:inline">${note}</span></div>
        <div class="overflow-x-auto max-h-[60vh]"><table class="tbl"><thead><tr><th>Peserta</th><th>Status</th><th>Progres</th><th class="num">Skor</th><th>Durasi · update</th><th></th></tr></thead><tbody>${arr.map(row).join('')}</tbody></table></div></div>` : '';
    $('mon-groups').innerHTML = group('Perlu tindakan', 'var(--bad)', groups.act, 'Peserta yang keluar dari layar ujian')
        + group('Sedang mengerjakan', 'var(--navy)', groups.work, 'Skor sementara dihitung dari jawaban terakhir')
        + group('Selesai', 'var(--ok)', groups.done, 'Diurutkan dari skor tertinggi')
        || `<div class="card">${emptyBox('fa-filter', 'Tidak ada peserta yang cocok dengan filter.')}</div>`;
}

function bukaPapanSkor() {
    const p = new URLSearchParams(); const m = $('filter-mapel').value, k = $('filter-kelas').value;
    if (m) p.set('paket', m); if (k) p.set('kelas', k);
    window.open('/skor' + (p.toString() ? '?' + p : ''), '_blank');
}
async function resetSiswa(nama, mapel) {
    const r = await Swal.fire({ icon: 'question', title: 'Buka akses peserta?', html: `<b>${esc(nama)}</b> bisa masuk lagi dan melanjutkan <b>${esc(mapel)}</b> dari jawaban terakhirnya.`, showCancelButton: true, confirmButtonText: 'Buka akses', cancelButtonText: 'Batal' });
    if (!r.isConfirmed) return;
    await api('/admin/reset-siswa', { body: { student_name: nama, mapel } });
    toast('Akses dibuka'); refreshDashboard();
}
async function menuAktivitas(id, nama, mapel) {
    const r = await Swal.fire({
        title: esc(nama), html: `<p class="text-sm text-muted mb-1">${esc(mapel)}</p>`, showDenyButton: true, showCancelButton: true,
        confirmButtonText: '<i class="fa fa-rotate-left"></i> Izinkan ulang dari awal', denyButtonText: '<i class="fa fa-trash"></i> Hapus dari daftar', cancelButtonText: 'Tutup',
    });
    if (r.isConfirmed) {
        if (!await confirmDanger('Ulang ujian?', `Nilai dan status <b>${esc(nama)}</b> untuk <b>${esc(mapel)}</b> akan dihapus. Peserta mengerjakan dari awal.`)) return;
        await api('/admin/ulang-ujian', { body: { student_name: nama, mapel } }); toast('Peserta bisa mengulang ujian');
    } else if (r.isDenied) {
        await api('/admin/remove-activity/' + id, { method: 'DELETE' }); toast('Dihapus dari daftar');
    }
    refreshDashboard();
}
async function clearMonitoring() {
    if (!await confirmDanger('Bersihkan pemantauan?', 'Semua status peserta di layar pemantauan dihapus. Nilai yang sudah masuk <b>tidak</b> ikut terhapus.')) return;
    await api('/admin/clear-monitoring', { method: 'DELETE' }); toast('Pemantauan dibersihkan'); refreshDashboard();
}

// =============================================================
// JADWAL & PIN
// =============================================================
async function loadJadwal() {
    const pg = $('page-jadwal');
    if (!$('list-jadwal')) {
        const today = new Date().toLocaleDateString('en-CA');
        pg.innerHTML = pageHead('Jadwal & PIN', 'Setiap jadwal menghasilkan satu PIN. Beberapa paket bisa digabung dalam satu PIN — siswa otomatis mendapat paket sesuai kelasnya.')
            + `<div class="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
            <form class="card p-5 space-y-4" onsubmit="event.preventDefault(); saveJadwal();">
                <h3 class="section-title">Buat jadwal baru</h3>
                <div><p class="field-label">Paket soal</p><div id="j_mapel_container" class="border border-line rounded-xl max-h-52 overflow-y-auto divide-y divide-line"></div></div>
                <div class="grid grid-cols-2 gap-3"><div><label class="field-label" for="j_tgl">Tanggal</label><input type="date" id="j_tgl" class="field" value="${today}"></div>
                <div><label class="field-label" for="j_jam">Jam mulai</label><input type="time" id="j_jam" class="field" value="07:30"></div></div>
                <div><label class="field-label" for="j_durasi">Durasi (menit)</label><input type="number" id="j_durasi" class="field" value="90" min="5" max="600"></div>
                <div class="space-y-3 pt-1">
                    <label class="flex items-center justify-between gap-3"><span><b class="text-sm">Acak urutan soal</b><br><span class="text-xs text-muted">Setiap siswa mendapat urutan berbeda</span></span><span class="switch"><input type="checkbox" id="j_acak_soal" checked><span></span></span></label>
                    <label class="flex items-center justify-between gap-3"><span><b class="text-sm">Acak pilihan jawaban</b><br><span class="text-xs text-muted">Hanya untuk PG & PG kompleks</span></span><span class="switch"><input type="checkbox" id="j_acak_opsi"><span></span></span></label>
                </div>
                <button class="btn btn-primary w-full"><i class="fa fa-key"></i> Buat jadwal & PIN</button>
            </form>
            <div><div class="flex items-center gap-3 mb-3"><h3 class="section-title flex-1">Daftar jadwal</h3><button onclick="clearSchedules()" class="btn btn-sm btn-danger"><i class="fa fa-trash"></i> Hapus semua</button></div>
            <div id="list-jadwal" class="space-y-3"></div></div></div>`;
    }
    const [sch, counts] = await Promise.all([api('/admin/schedules'), api('/admin/available-exams?withCount=1')]);
    allSchedules = sch || [];
    const exams = Object.keys(counts || {}).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    $('j_mapel_container').innerHTML = exams.map(e => `<label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper"><input type="checkbox" name="j_mapel_cb" value="${esc(e)}" class="w-4 h-4 accent-[#14306B]"><span class="flex-1 font-semibold text-sm">${esc(e)}</span><span class="text-xs text-muted">${counts[e]} soal</span></label>`).join('')
        || `<p class="p-4 text-sm text-muted">Belum ada paket soal. <button type="button" class="text-navy font-bold underline" onclick="showPage('banksoal')">Buat di Bank soal</button></p>`;
    $('list-jadwal').innerHTML = allSchedules.map(j => {
        const [tgl, jam] = (j.tanggal || '').split('|');
        const tglTxt = tgl ? new Date(tgl + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        const on = j.status === 'Aktif';
        const paket = (j.mapel || '').split(',').map(m => m.trim()).filter(Boolean);
        const total = paket.reduce((s, m) => s + (counts[m] || 0), 0);
        return `<div class="card p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${on ? '' : 'opacity-75'}">
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap gap-1.5 mb-2">${paket.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>
                <p class="text-sm text-muted"><i class="fa fa-calendar mr-1"></i>${esc(tglTxt)}${jam ? ', ' + esc(jam) : ''} · ${j.durasi} menit · ${total} soal${j.acak_soal ? ' · <i class="fa fa-shuffle" title="Soal diacak"></i>' : ''}</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-center"><p class="text-xs text-muted font-semibold">PIN</p><p class="text-2xl font-extrabold tracking-[.14em] tabular-nums ${on ? 'text-navy' : 'text-muted'}">${esc(j.pin)}</p></div>
                <div class="flex flex-col gap-1">
                    <button class="icon-btn icon-btn-sm" title="Salin PIN" onclick="copyText('${jsq(j.pin)}')"><i class="fa fa-copy"></i></button>
                    <button class="icon-btn icon-btn-sm" title="Buat PIN baru" onclick="regenPin(${j.id})"><i class="fa fa-arrows-rotate"></i></button>
                </div>
                <label class="flex flex-col items-center gap-1" title="${on ? 'Tutup ujian' : 'Buka ujian'}"><span class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="setStatusJadwal(${j.id}, this.checked)"><span></span></span><span class="text-xs font-semibold ${on ? 'text-ok' : 'text-muted'}">${on ? 'Dibuka' : 'Ditutup'}</span></label>
                <div class="flex flex-col gap-1">
                    <button class="icon-btn icon-btn-sm" title="Ubah" onclick="editJadwal(${j.id})"><i class="fa fa-pen"></i></button>
                    <button class="icon-btn icon-btn-sm hover:!text-bad" title="Hapus" onclick="hapusJadwal(${j.id})"><i class="fa fa-trash"></i></button>
                </div>
            </div></div>`;
    }).join('') || `<div class="card">${emptyBox('fa-calendar-plus', 'Belum ada jadwal. Pilih paket soal di kiri untuk membuat PIN pertama.')}</div>`;
}

async function saveJadwal() {
    const mapel = [...document.querySelectorAll('input[name="j_mapel_cb"]:checked')].map(c => c.value);
    if (!mapel.length) return toast('Pilih minimal satu paket soal', 'warning');
    const tgl = $('j_tgl').value, jam = $('j_jam').value, durasi = $('j_durasi').value;
    if (!tgl || !jam || !durasi) return toast('Lengkapi tanggal, jam, dan durasi', 'warning');
    const r = await api('/admin/add-schedule', { body: { mapel: mapel.join(', '), tanggal: `${tgl}|${jam}`, durasi, acak_soal: $('j_acak_soal').checked, acak_opsi: $('j_acak_opsi').checked } });
    if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
    await Swal.fire({ icon: 'success', title: 'Jadwal dibuat', html: `PIN ujian:<p class="text-4xl font-extrabold tracking-[.2em] text-navy my-3">${esc(r.pin)}</p>${r.warning ? `<p class="text-sm text-gold-700">${esc(r.warning)}</p>` : ''}` });
    loadJadwal();
}
async function setStatusJadwal(id, on) { await api('/admin/schedule-status', { body: { id, status: on ? 'Aktif' : 'Ditutup' } }); toast(on ? 'Ujian dibuka' : 'Ujian ditutup'); loadJadwal(); }
async function regenPin(id) {
    const r = await Swal.fire({ icon: 'question', title: 'Buat PIN baru?', text: 'PIN lama tidak bisa dipakai lagi. Siswa yang sedang mengerjakan tidak terganggu.', showCancelButton: true, confirmButtonText: 'Buat PIN baru', cancelButtonText: 'Batal' });
    if (!r.isConfirmed) return;
    const d = await api('/admin/regenerate-pin', { body: { id } }); toast('PIN baru: ' + d.pin); loadJadwal();
}
async function editJadwal(id) {
    const j = allSchedules.find(x => x.id === id); if (!j) return;
    const [tgl, jam] = (j.tanggal || '').split('|');
    const r = await Swal.fire({
        title: 'Ubah jadwal', html: `<div class="text-left space-y-3">
            <div><p class="field-label">Paket</p><p class="font-semibold">${esc(j.mapel)}</p></div>
            <div class="grid grid-cols-2 gap-3"><div><label class="field-label">Tanggal</label><input type="date" id="e_tgl" class="field" value="${esc(tgl || '')}"></div><div><label class="field-label">Jam</label><input type="time" id="e_jam" class="field" value="${esc(jam || '')}"></div></div>
            <div><label class="field-label">Durasi (menit)</label><input type="number" id="e_dur" class="field" value="${j.durasi}"></div>
            <label class="flex items-center justify-between"><span class="text-sm font-semibold">Acak urutan soal</span><span class="switch"><input type="checkbox" id="e_as" ${j.acak_soal ? 'checked' : ''}><span></span></span></label>
            <label class="flex items-center justify-between"><span class="text-sm font-semibold">Acak pilihan jawaban</span><span class="switch"><input type="checkbox" id="e_ao" ${j.acak_opsi ? 'checked' : ''}><span></span></span></label></div>`,
        showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
        preConfirm: () => ({ id: j.id, mapel: j.mapel, status: j.status, tanggal: $('e_tgl').value + '|' + $('e_jam').value, durasi: $('e_dur').value, acak_soal: $('e_as').checked, acak_opsi: $('e_ao').checked }),
    });
    if (!r.isConfirmed) return;
    const d = await api('/admin/update-schedule', { method: 'PUT', body: r.value });
    toast(d.warning || 'Jadwal disimpan', d.warning ? 'warning' : 'success'); loadJadwal();
}
async function hapusJadwal(id) {
    const j = allSchedules.find(x => x.id === id);
    if (!await confirmDanger('Hapus jadwal?', `Jadwal <b>${esc(j ? j.mapel : '')}</b> dan PIN-nya akan dihapus. Nilai yang sudah masuk tetap aman.`)) return;
    await api('/admin/delete-schedule/' + id, { method: 'DELETE' }); toast('Jadwal dihapus'); loadJadwal();
}
async function clearSchedules() {
    if (!await confirmDanger('Hapus semua jadwal?', 'Semua PIN tidak bisa dipakai lagi.', 'HAPUS')) return;
    await api('/admin/clear-schedules', { method: 'DELETE' }); toast('Semua jadwal dihapus'); loadJadwal();
}

// =============================================================
// BANK SOAL
// =============================================================
let bankTab = 'paket';
async function loadBankSoal() {
    const pg = $('page-banksoal');
    if (!$('bank-body')) {
        pg.innerHTML = pageHead('Bank soal', 'Kelompokkan soal per paket dengan kode seperti <b>MTK-7</b> (semua kelas 7), <b>MTK-7A</b> (khusus 7A), atau <b>IPA</b> (semua kelas).',
            `<div class="tabs" role="tablist"><button class="tab" data-tab="paket" onclick="setBankTab('paket')">Daftar paket</button><button class="tab" data-tab="import" onclick="setBankTab('import')">Impor file</button><button class="tab" data-tab="manual" onclick="setBankTab('manual')">Tulis soal</button></div>`)
            + `<div id="bank-body"></div>`;
    }
    setBankTab(bankTab);
}
async function setBankTab(t) {
    bankTab = t;
    document.querySelectorAll('#page-banksoal .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === t));
    if (t === 'paket') { allQuestions = await api('/admin/questions') || []; renderPaket(); }
    if (t === 'import') renderImportTab();
    if (t === 'manual') renderManualTab();
}

function renderPaket() {
    const body = $('bank-body');
    if (!allQuestions.length) { body.innerHTML = `<div class="card">${emptyBox('fa-layer-group', 'Bank soal masih kosong.', `<button class="btn btn-primary mt-4" onclick="setBankTab('import')"><i class="fa fa-file-import"></i> Impor soal dari Excel atau Word</button>`)}</div>`; return; }
    const groups = {};
    allQuestions.forEach(q => { (groups[q.exam_id] = groups[q.exam_id] || []).push(q); });
    const open = new Set([...document.querySelectorAll('.paket-body:not(.hidden)')].map(e => e.dataset.id));
    const search = ($('bank-search') || {}).value || '';
    body.innerHTML = `<div class="flex flex-wrap gap-2 mb-4 items-center"><input id="bank-search" class="field field-sm sm:w-72" placeholder="Cari teks soal atau kode paket…" value="${esc(search)}" oninput="renderPaketList()">
        <span class="text-sm text-muted ml-auto">${Object.keys(groups).length} paket · ${allQuestions.length} soal</span>
        ${isAdmin() ? `<button onclick="clearQuestions()" class="btn btn-sm btn-danger"><i class="fa fa-trash"></i> Hapus semua soal</button>` : ''}</div>
        <div id="paket-list" class="space-y-3"></div>`;
    window._bankGroups = groups; window._bankOpen = open;
    renderPaketList();
}
function renderPaketList() {
    const groups = window._bankGroups || {}, open = window._bankOpen || new Set();
    const s = ($('bank-search').value || '').toLowerCase();
    const ids = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    $('paket-list').innerHTML = ids.map(id => {
        let qs = groups[id];
        const matchId = id.toLowerCase().includes(s);
        if (s && !matchId) qs = qs.filter(q => (q.tanya || '').toLowerCase().includes(s));
        if (!qs.length) return '';
        const tipeCount = {}; groups[id].forEach(q => { tipeCount[q.tipe] = (tipeCount[q.tipe] || 0) + 1; });
        const totalSkor = groups[id].reduce((t, q) => t + (parseFloat(q.skor) || 1), 0);
        const isOpen = open.has(id) || (s && !matchId);
        return `<div class="card overflow-hidden">
            <div class="flex flex-wrap items-center gap-3 px-4 py-3">
                <button class="flex items-center gap-3 flex-1 min-w-[200px] text-left" onclick="togglePaket('${jsq(id)}')">
                    <i class="fa fa-chevron-right text-muted text-xs transition-transform ${isOpen ? 'rotate-90' : ''}" data-chev="${esc(id)}"></i>
                    <span><span class="font-bold">${esc(id)}</span><span class="block text-xs text-muted">${groups[id].length} soal · total bobot ${totalSkor} · ${Object.entries(tipeCount).map(([t, n]) => `${t} ${n}`).join(', ')}</span></span>
                </button>
                <div class="flex gap-1.5">
                    <button class="btn btn-xs btn-outline" onclick="previewPaket('${jsq(id)}')"><i class="fa fa-eye"></i> Pratinjau</button>
                    ${isAdmin() ? `<button class="btn btn-xs btn-outline" onclick="renamePaket('${jsq(id)}')"><i class="fa fa-pen"></i> Ganti kode</button><button class="btn btn-xs btn-danger" onclick="hapusPaketSoal('${jsq(id)}')"><i class="fa fa-trash"></i></button>` : ''}
                </div>
            </div>
            <div class="paket-body border-t border-line ${isOpen ? '' : 'hidden'}" data-id="${esc(id)}"><div class="overflow-x-auto"><table class="tbl">
                <thead><tr><th class="w-10">No</th><th>Soal</th><th>Kunci</th><th class="num">Bobot</th><th></th></tr></thead><tbody>
                ${qs.map(q => `<tr><td class="text-muted tabular-nums">${groups[id].indexOf(q) + 1}</td>
                    <td class="max-w-[520px]"><span class="chip chip-muted mb-1">${TIPE_LABEL[q.tipe] || esc(q.tipe)}</span>${q.media_path ? ' <i class="fa fa-image text-muted" title="Ada gambar"></i>' : ''}<p class="line-clamp-2 text-sm">${esc((q.tanya || '').slice(0, 220))}</p></td>
                    <td class="font-bold text-ok whitespace-nowrap">${esc(q.kunci || '—') || '<span class="text-bad">Kosong</span>'}</td>
                    <td class="num">${q.skor || 1}</td>
                    <td class="text-right whitespace-nowrap"><button class="btn btn-xs btn-outline" onclick="editSoal(${q.id})"><i class="fa fa-pen"></i> Ubah</button>${isAdmin() ? ` <button class="icon-btn icon-btn-sm hover:!text-bad" onclick="hapusSoal(${q.id})" title="Hapus soal"><i class="fa fa-trash"></i></button>` : ''}</td></tr>`).join('')}
                </tbody></table></div></div></div>`;
    }).join('') || `<div class="card">${emptyBox('fa-magnifying-glass', 'Tidak ada soal yang cocok.')}</div>`;
}
function togglePaket(id) {
    const b = document.querySelector(`.paket-body[data-id="${CSS.escape(id)}"]`); b.classList.toggle('hidden');
    document.querySelector(`[data-chev="${CSS.escape(id)}"]`).classList.toggle('rotate-90', !b.classList.contains('hidden'));
    window._bankOpen = new Set([...document.querySelectorAll('.paket-body:not(.hidden)')].map(e => e.dataset.id));
}

// --- Pratinjau soal (tampilan seperti siswa, dengan kunci) ---
function renderPreviewSoal(q, no) {
    const opsi = splitOpsi(q); const kunci = String(q.kunci || '').toUpperCase().replace(/\s/g, '');
    let body = '';
    if (q.tipe === 'PG' || q.tipe === 'PGK') {
        const ks = kunci.split(',');
        body = opsi.map((o, i) => `<div class="flex gap-3 items-start py-1.5"><span class="w-7 h-7 rounded-full grid place-items-center text-xs font-extrabold flex-shrink-0 ${ks.includes(ABJAD[i]) ? 'bg-ok text-white' : 'border-2 border-[#8C99B1] text-muted'}">${ABJAD[i]}</span><span class="pt-0.5">${isImageUrl(o) ? imgTag(o, 400, 'max-h-28 rounded') : formatMath(esc(o))}</span></div>`).join('');
    } else if (MATRIX.includes(q.tipe)) {
        const hm = (opsi[0] || '').match(/^HEADER\[(.+)\]$/i); const rows = hm ? opsi.slice(1) : opsi;
        let ks = kunci.split(','); if ((q.tipe === 'BS' || q.tipe === 'TS') && ks.includes('S')) ks = ks.map(k => k === 'B' ? 'A' : k === 'S' ? 'B' : k);
        const heads = q.tipe === 'BS' ? ['Benar', 'Salah'] : q.tipe === 'TS' ? ['Sesuai', 'Tidak sesuai'] : hm ? hm[1].split(',') : q.tipe === 'NK' ? ['Numerik', 'Kategorik'] : ['Komutatif', 'Asosiatif', 'Distributif'];
        body = `<table class="matrix mt-1"><thead><tr><th>Pernyataan</th>${heads.map(h => `<th class="c">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr><td>${formatMath(esc(r))}</td>${heads.map((h, k) => `<td class="c">${ks[i] === ABJAD[k] ? '<i class="fa fa-circle-check text-ok text-lg"></i>' : '<i class="fa-regular fa-circle text-[#B6C0D2]"></i>'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    } else if (q.tipe === 'JODOH') {
        body = `<p class="text-sm text-muted">Pilihan: ${opsi.map((o, i) => `<b>${ABJAD[i]}</b>. ${esc(o)}`).join(' · ')}</p><p class="mt-1 text-sm">Kunci: <b class="text-ok">${esc(kunci)}</b></p>`;
    } else if (q.tipe === 'GFORM') {
        body = `<p class="text-sm">Tautan: <a class="text-navy underline" href="${esc(q.tanya || q.gform_url)}" target="_blank" rel="noopener">${esc(q.tanya || q.gform_url)}</a></p>`;
    } else {
        body = `<p class="text-sm">Kata kunci penilaian: <b class="text-ok">${esc(q.kunci || '— (dinilai manual)')}</b></p>`;
    }
    const media = q.media_path && String(q.media_path).startsWith('http') ? `<div class="soal-media">${imgTag(q.media_path, 800)}</div>` : '';
    return `<div class="card p-4 soal" style="--soal-size:15px"><div class="flex items-center gap-2 mb-2"><span class="font-extrabold">${no}.</span><span class="chip chip-muted">${TIPE_LABEL[q.tipe] || esc(q.tipe)}</span><span class="text-xs text-muted ml-auto">Bobot ${q.skor || 1}</span></div>
        ${media}<div class="soal-tanya mb-3">${q.tipe === 'GFORM' ? '' : formatMath(esc(q.tanya || '').replace(/\n/g, '<br>'))}</div>${body}</div>`;
}
function previewPaket(id) {
    const qs = (window._bankGroups || {})[id] || [];
    openModal(`<h2 class="font-extrabold text-lg">Pratinjau ${esc(id)}</h2><p class="text-sm text-muted">${qs.length} soal · kunci ditandai hijau</p>`, `<div class="space-y-3">${qs.map((q, i) => renderPreviewSoal(q, i + 1)).join('')}</div>`, { wide: true });
}

// --- Editor soal (ubah / baru) ---
function soalEditorHtml(q = {}) {
    const opsiLines = splitOpsi(q).join('\n');
    return `<div class="grid sm:grid-cols-3 gap-3">
        <div><label class="field-label">Tipe soal</label><select id="ed_tipe" class="field" onchange="hintEditor()">${Object.entries(TIPE_LABEL).map(([k, v]) => `<option value="${k}" ${q.tipe === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="field-label">Kunci jawaban</label><input id="ed_kunci" class="field font-bold" value="${esc(q.kunci || '')}" oninput="this.value=this.value.toUpperCase()"></div>
        <div><label class="field-label">Bobot skor</label><input id="ed_skor" type="number" min="0.5" step="0.5" class="field" value="${q.skor || 1}"></div></div>
        <div class="mt-3"><label class="field-label">Pertanyaan</label><textarea id="ed_tanya" rows="5" class="field">${esc(q.tanya || '')}</textarea>
        <p class="text-xs text-muted mt-1">Pangkat: <code>x^2</code> · indeks: <code>H_2O</code> · pecahan: <code>(3/4)</code> · rumus LaTeX: <code>$\\sqrt{x}$</code></p></div>
        <div class="mt-3"><label class="field-label">Pilihan / pernyataan <span class="font-normal text-muted">(satu per baris)</span></label><textarea id="ed_opsi" rows="5" class="field">${esc(opsiLines)}</textarea><p id="ed_hint" class="text-xs text-muted mt-1"></p></div>
        <div class="mt-3"><label class="field-label">Link gambar <span class="font-normal text-muted">(Google Drive atau URL gambar, opsional)</span></label><input id="ed_media" class="field" value="${esc(q.media_path || '')}" placeholder="https://drive.google.com/file/d/…"></div>`;
}
const EDITOR_HINT = {
    PG: 'Kunci: satu huruf, misal <b>B</b>.', PGK: 'Kunci: beberapa huruf dipisah koma, misal <b>A,C</b>.',
    BS: 'Setiap baris = satu pernyataan. Kunci per baris: <b>B,S,B</b> (Benar/Salah).', TS: 'Setiap baris = satu pernyataan. Kunci: <b>A,B,A</b> (A = Sesuai, B = Tidak sesuai).',
    NK: 'Setiap baris = satu data. Kunci: <b>A,B</b> (A = Numerik, B = Kategorik). Header khusus: baris pertama <code>HEADER[Kolom1,Kolom2]</code>.',
    SIFAT: 'Setiap baris = satu pernyataan. Kunci: A/B/C per baris. Header khusus: <code>HEADER[...]</code> di baris pertama.',
    JODOH: 'Tulis premis bernomor di pertanyaan (1. …, 2. …). Pilihan = pasangan. Kunci: <b>1B,2C,3A</b>.',
    ISIAN: 'Tanpa pilihan. Kunci = kata kunci jawaban, misal <b>36</b>.', ESAI: 'Tanpa pilihan. Kunci = kata-kata kunci; kosongkan jika dinilai manual.',
    GFORM: 'Tulis link Google Form di kolom pertanyaan.',
};
function hintEditor() { const t = $('ed_tipe'); if (t) $('ed_hint').innerHTML = EDITOR_HINT[t.value] || ''; }
function bacaEditor() {
    const tipe = $('ed_tipe').value;
    return {
        tipe, tanya: $('ed_tanya').value.trim(), kunci: $('ed_kunci').value.trim().toUpperCase().replace(/\s+/g, ''),
        skor: parseFloat($('ed_skor').value) || 1, media_path: $('ed_media').value.trim(),
        opsi_json: $('ed_opsi').value.split('\n').map(s => s.trim()).filter(Boolean).join('|||'),
    };
}
function editSoal(id) {
    const q = allQuestions.find(x => x.id === id); if (!q) return;
    const guru = !isAdmin();
    openModal(`<h2 class="font-extrabold text-lg">Ubah soal</h2><p class="text-sm text-muted">${esc(q.exam_id)}</p>`, soalEditorHtml(q) + `<div id="ed_preview" class="mt-4"></div>`, {
        wide: true, foot: `<button class="btn btn-ghost mr-auto" onclick="$('ed_preview').innerHTML=renderPreviewSoal({...bacaEditor(), exam_id:''}, '#'); applyMathRendering($('ed_preview'))"><i class="fa fa-eye"></i> Pratinjau</button><button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="simpanEditSoal(${id})"><i class="fa fa-floppy-disk"></i> Simpan perubahan</button>`,
    });
    hintEditor();
}
async function simpanEditSoal(id) {
    const v = bacaEditor(); if (!v.tanya) return toast('Pertanyaan tidak boleh kosong', 'warning');
    const r = await api('/admin/update-soal', { method: 'PUT', body: { id, ...v } });
    if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: r.message });
    closeModal(); toast('Soal disimpan'); setBankTab('paket');
}
async function hapusSoal(id) {
    if (!await confirmDanger('Hapus soal ini?', 'Soal dihapus permanen dari paket.')) return;
    await api('/admin/delete-question/' + id, { method: 'DELETE' }); toast('Soal dihapus'); setBankTab('paket');
}
async function hapusPaketSoal(id) {
    if (!await confirmDanger(`Hapus paket ${esc(id)}?`, `Semua soal di paket <b>${esc(id)}</b> akan dihapus permanen.`, id)) return;
    await api('/admin/delete-exam/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Paket dihapus'); setBankTab('paket');
}
async function renamePaket(id) {
    const r = await Swal.fire({ title: 'Ganti kode paket', input: 'text', inputValue: id, inputLabel: 'Kode baru', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', inputValidator: v => !v.trim() && 'Kode wajib diisi' });
    if (!r.isConfirmed || r.value.trim() === id) return;
    await api('/admin/rename-exam', { body: { from: id, to: r.value.trim() } }); toast('Kode paket diganti'); setBankTab('paket');
}
async function clearQuestions() {
    if (!await confirmDanger('Hapus SEMUA soal?', 'Seluruh bank soal dari semua paket akan dihapus permanen.', 'HAPUS SEMUA')) return;
    await api('/admin/clear-questions', { method: 'DELETE' }); toast('Bank soal dikosongkan'); setBankTab('paket');
}

function renderImportTab() {
    $('bank-body').innerHTML = `<div class="grid lg:grid-cols-2 gap-5">
        <div class="card p-5">
            <div class="flex items-start gap-3 mb-4"><span class="w-10 h-10 rounded-xl bg-ok-50 text-ok grid place-items-center"><i class="fa fa-file-excel"></i></span>
            <div class="flex-1"><h3 class="section-title">Excel (.xlsx)</h3><p class="text-sm text-muted">Cara paling andal. Mendukung semua tipe soal.</p></div>
            <button class="btn btn-xs btn-outline" onclick="downloadTemplateSoal()"><i class="fa fa-download"></i> Template</button></div>
            <label class="field-label" for="ex_judul">Kode paket</label><input id="ex_judul" class="field mb-3" placeholder="Contoh: MTK-7A">
            <label class="dropzone mb-4"><i class="fa fa-cloud-arrow-up text-xl text-muted"></i><span class="text-sm flex-1"><b>Pilih file Excel</b><br><span class="text-muted" id="ex_name">Kolom: Tipe, Pertanyaan, Opsi_A–E, Kunci, Skor, Link_Gambar</span></span><input type="file" id="ex_file" accept=".xlsx,.xls" class="sr-only" onchange="$('ex_name').textContent=this.files[0]?.name||''"></label>
            <button onclick="importExcelSoal()" class="btn btn-ok w-full"><i class="fa fa-file-import"></i> Baca & pratinjau</button>
        </div>
        <div class="card p-5">
            <div class="flex items-start gap-3 mb-4"><span class="w-10 h-10 rounded-xl bg-navy-50 text-navy grid place-items-center"><i class="fa fa-file-word"></i></span>
            <div class="flex-1"><h3 class="section-title">Word (.docx)</h3><p class="text-sm text-muted">Tabel dengan header yang sama seperti Excel, atau teks bernomor: <i>1. Soal → A. Opsi → Kunci: A</i>.</p></div></div>
            <label class="field-label" for="w_judul">Kode paket</label><input id="w_judul" class="field mb-3" placeholder="Contoh: IPA-8B">
            <label class="dropzone mb-4"><i class="fa fa-cloud-arrow-up text-xl text-muted"></i><span class="text-sm flex-1"><b>Pilih file Word</b><br><span class="text-muted" id="w_name">Persamaan Word (pecahan, pangkat) dibaca otomatis</span></span><input type="file" id="w_file" accept=".docx" class="sr-only" onchange="$('w_name').textContent=this.files[0]?.name||''"></label>
            <button onclick="importWord()" class="btn btn-primary w-full"><i class="fa fa-file-import"></i> Baca & pratinjau</button>
        </div></div>`;
}
function downloadTemplateSoal() {
    if (typeof XLSX === 'undefined') return toast('Library Excel belum termuat, coba lagi', 'error');
    const rows = [
        { Tipe: 'PG', Pertanyaan: 'Hasil dari 15 + (−8) × 2 adalah …', Opsi_A: '−1', Opsi_B: '1', Opsi_C: '14', Opsi_D: '46', Opsi_E: '', Kunci: 'A', Skor: 1, Link_Gambar: '' },
        { Tipe: 'PGK', Pertanyaan: 'Manakah yang termasuk bilangan prima?', Opsi_A: '2', Opsi_B: '9', Opsi_C: '11', Opsi_D: '15', Opsi_E: '17', Kunci: 'A,C,E', Skor: 1, Link_Gambar: '' },
        { Tipe: 'BS', Pertanyaan: 'Tentukan benar atau salah.', Opsi_A: 'Setiap bilangan genap habis dibagi 2', Opsi_B: '0 adalah bilangan asli', Opsi_C: '', Opsi_D: '', Opsi_E: '', Kunci: 'B,S', Skor: 2, Link_Gambar: '' },
        { Tipe: 'JODOH', Pertanyaan: 'Pasangkan istilah berikut.\n1. Faktor\n2. Kelipatan', Opsi_A: 'Hasil kali dengan bilangan asli', Opsi_B: 'Pembagi habis suatu bilangan', Opsi_C: '', Opsi_D: '', Opsi_E: '', Kunci: '1B,2A', Skor: 2, Link_Gambar: '' },
        { Tipe: 'ISIAN', Pertanyaan: 'KPK dari 12 dan 18 adalah …', Opsi_A: '', Opsi_B: '', Opsi_C: '', Opsi_D: '', Opsi_E: '', Kunci: '36', Skor: 1, Link_Gambar: '' },
        { Tipe: 'ESAI', Pertanyaan: 'Jelaskan cara menentukan FPB dengan faktorisasi prima!', Opsi_A: '', Opsi_B: '', Opsi_C: '', Opsi_D: '', Opsi_E: '', Kunci: 'faktorisasi prima', Skor: 3, Link_Gambar: '' },
    ];
    const guide = [['Tipe', 'Arti', 'Format kunci'], ['PG', 'Pilihan ganda', 'A'], ['PGK', 'PG kompleks', 'A,C'], ['BS', 'Benar/Salah (tabel)', 'B,S,B'], ['TS', 'Sesuai/Tidak sesuai', 'A,B,A'], ['NK', 'Numerik/Kategorik', 'A,B'], ['SIFAT', 'Sifat operasi', 'A,B,C'], ['JODOH', 'Menjodohkan', '1B,2A'], ['ISIAN', 'Isian singkat', 'kata kunci'], ['ESAI', 'Uraian', 'kata kunci / kosong'], ['GFORM', 'Link Google Form', '(tulis link di Pertanyaan)']];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Soal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Panduan');
    XLSX.writeFile(wb, 'TEMPLATE_SOAL_CBT.xlsx');
}

function renderManualTab() {
    $('bank-body').innerHTML = `<div class="card p-5 max-w-3xl">
        <div class="flex flex-wrap items-end gap-3 mb-4"><div class="flex-1 min-w-[200px]"><label class="field-label" for="man_kode">Kode paket</label><input id="man_kode" class="field" list="man_kode_list" placeholder="Pilih atau ketik kode baru"><datalist id="man_kode_list">${[...new Set(allQuestions.map(q => q.exam_id))].map(e => `<option value="${esc(e)}">`).join('')}</datalist></div>
        <p class="text-sm text-muted pb-3" id="man_count"></p></div>
        ${soalEditorHtml({ tipe: 'PG', skor: 1 })}
        <div id="ed_preview" class="mt-4"></div>
        <div class="flex flex-wrap gap-2 mt-5"><button class="btn btn-ghost" onclick="$('ed_preview').innerHTML=renderPreviewSoal({...bacaEditor()}, '#'); applyMathRendering($('ed_preview'))"><i class="fa fa-eye"></i> Pratinjau</button>
        <button class="btn btn-primary ml-auto" onclick="simpanSoalManual()"><i class="fa fa-plus"></i> Simpan & tulis soal berikutnya</button></div></div>`;
    hintEditor();
}
async function simpanSoalManual() {
    const kode = $('man_kode').value.trim(); const v = bacaEditor();
    if (!kode) return toast('Isi kode paket dulu', 'warning');
    if (!v.tanya) return toast('Pertanyaan masih kosong', 'warning');
    const r = await api('/admin/add-soal-bulk', { body: { questions: [{ exam_id: kode, ...v, gform_url: '' }] } });
    if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
    toast('Soal tersimpan ke ' + kode);
    allQuestions.push({ exam_id: kode });
    const n = allQuestions.filter(q => q.exam_id === kode).length;
    $('man_count').textContent = `${kode} sekarang berisi ${n} soal`;
    ['ed_tanya', 'ed_opsi', 'ed_kunci', 'ed_media'].forEach(id => $(id).value = ''); $('ed_preview').innerHTML = ''; $('ed_tanya').focus();
}

// =============================================================
// HASIL & ANALISIS
// =============================================================
let nilaiTab = 'rekap', nilaiSort = { key: 'nilai', dir: -1 };
window.filteredResultsData = [];
const getKkmStorage = () => { try { return JSON.parse(localStorage.getItem('cbt_kkm_mapel') || '{}'); } catch (e) { return {}; } };
function kkmFor(mapel) { const m = getKkmStorage(); if (m[mapel]) return m[mapel]; for (const k in m) if (mapel && mapel.includes(k)) return m[k]; return 0; }
const parseDetail = n => { try { return typeof n.detail_jawaban === 'string' ? JSON.parse(n.detail_jawaban) : (n.detail_jawaban || []); } catch (e) { return []; } };

async function loadNilai() {
    if (!$('nilai-body')) {
        $('page-nilai').innerHTML = pageHead('Hasil & analisis', 'Pilih paket untuk melihat statistik kelas dan analisis tiap butir soal.',
            `<div class="tabs"><button class="tab" data-tab="rekap" onclick="setNilaiTab('rekap')">Rekap nilai</button><button class="tab" data-tab="analisis" onclick="setNilaiTab('analisis')">Analisis butir</button></div>`)
            + `<div class="card p-3 mb-4 flex flex-wrap items-center gap-2 no-print">
                <select id="filter-mapel-nilai" class="field field-sm w-auto" onchange="handleMapelNilaiChange()"><option value="">Semua paket</option></select>
                <select id="filter-kelas-nilai" class="field field-sm w-auto" onchange="renderNilai()"><option value="">Semua kelas</option></select>
                <input id="nilai-search" class="field field-sm sm:w-44" placeholder="Cari nama…" oninput="renderNilai()">
                <label class="flex items-center gap-2 text-sm font-semibold ml-0 sm:ml-2">KKM <input type="number" id="input-kkm-nilai" class="field field-sm w-20" placeholder="—" onchange="updateKkmMapel(this.value)" title="Pilih paket dulu"></label>
                <div class="ml-auto flex flex-wrap gap-2">
                    <button onclick="exportRekap()" class="btn btn-sm btn-outline"><i class="fa fa-table"></i> Rekap .xlsx</button>
                    <button onclick="exportExcelDetail()" class="btn btn-sm btn-ok"><i class="fa fa-file-excel"></i> Detail jawaban</button>
                    <button onclick="cetakRekapNilai()" class="btn btn-sm btn-outline"><i class="fa fa-print"></i> Cetak berkop</button>
                    ${isAdmin() ? `<button onclick="clearResults()" class="btn btn-sm btn-danger" title="Hapus semua nilai"><i class="fa fa-trash"></i></button>` : ''}
                </div></div>
            <div id="nilai-body"></div>`;
    }
    allResults = await api('/admin/results') || [];
    fillSelect('filter-mapel-nilai', allResults.map(r => r.mapel), 'Semua paket');
    fillSelect('filter-kelas-nilai', allResults.map(r => r.kelas).filter(k => k && k !== '-'), 'Semua kelas');
    if (!$('filter-mapel-nilai').value) { const first = $('filter-mapel-nilai').options[1]; if (first && $('filter-mapel-nilai').options.length === 2) $('filter-mapel-nilai').value = first.value; }
    handleMapelNilaiChange();
}
function setNilaiTab(t) { nilaiTab = t; renderNilai(); }
function handleMapelNilaiChange() { const m = $('filter-mapel-nilai').value; $('input-kkm-nilai').value = m ? (getKkmStorage()[m] || '') : ''; $('input-kkm-nilai').disabled = !m; renderNilai(); }
function updateKkmMapel(val) {
    const m = $('filter-mapel-nilai').value; if (!m) return;
    const map = getKkmStorage(); if (parseFloat(val) > 0) map[m] = parseFloat(val); else delete map[m];
    localStorage.setItem('cbt_kkm_mapel', JSON.stringify(map)); renderNilai();
}
function sortNilai(key) { nilaiSort = { key, dir: nilaiSort.key === key ? -nilaiSort.dir : (key === 'nilai' ? -1 : 1) }; renderNilai(); }

function renderNilai() {
    document.querySelectorAll('#page-nilai .tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === nilaiTab));
    const k = $('filter-kelas-nilai').value, m = $('filter-mapel-nilai').value, s = ($('nilai-search').value || '').toLowerCase();
    const data = allResults.filter(r => (!k || r.kelas === k) && (!m || r.mapel === m) && (!s || (r.student_name || '').toLowerCase().includes(s)));
    const { key, dir } = nilaiSort;
    data.sort((a, b) => key === 'nilai' ? (scoreNum(a.nilai) - scoreNum(b.nilai)) * dir : String(a[key] || '').localeCompare(String(b[key] || ''), 'id', { numeric: true }) * dir);
    window.filteredResultsData = data;
    if (!allResults.length) { $('nilai-body').innerHTML = `<div class="card">${emptyBox('fa-chart-column', 'Belum ada nilai masuk. Nilai muncul di sini begitu peserta mengumpulkan jawaban.')}</div>`; return; }
    if (nilaiTab === 'analisis') return renderAnalisis(data, m);

    const nums = data.map(r => scoreNum(r.nilai)).filter(n => !isNaN(n));
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
    const kkm = m ? kkmFor(m) : 0;
    const tuntas = kkm ? nums.filter(n => n >= kkm).length : null;
    const bins = [[0, 39], [40, 59], [60, 74], [75, 89], [90, 100]].map(([a, b]) => ({ l: `${a}–${b}`, n: nums.filter(x => x >= a && x <= b).length, low: kkm ? b < kkm : a < 60 }));
    const maxBin = Math.max(1, ...bins.map(b => b.n));
    const stat = (n, l) => `<div><p class="stat-num">${n}</p><p class="stat-label">${l}</p></div>`;
    const arrow = c => nilaiSort.key === c ? (nilaiSort.dir > 0 ? ' ↑' : ' ↓') : '';

    $('nilai-body').innerHTML = `<div class="grid lg:grid-cols-[1fr_340px] gap-4 mb-5 items-start">
        <div class="stat-strip" style="--n:5">${stat(data.length, 'Peserta')}${stat(nums.length ? avg.toFixed(1) : '–', 'Rata-rata')}${stat(nums.length ? Math.max(...nums) : '–', 'Tertinggi')}${stat(nums.length ? Math.min(...nums) : '–', 'Terendah')}${stat(tuntas === null ? '<span class="text-base text-muted font-semibold">Isi KKM</span>' : `${tuntas}<span class="text-base text-muted"> / ${nums.length}</span>`, 'Tuntas KKM')}</div>
        <div class="card p-4"><p class="text-sm font-bold mb-3">Sebaran nilai</p><div class="histo">${bins.map(b => `<div><small class="tabular-nums">${b.n}</small><div class="bar ${b.low ? 'is-low' : ''}" style="height:${b.n / maxBin * 100}%"></div><small>${b.l}</small></div>`).join('')}</div></div></div>
        <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl" id="nilai-table"><thead><tr>
            <th class="w-10">#</th><th class="th-sort" onclick="sortNilai('student_name')">Nama${arrow('student_name')}</th><th class="th-sort" onclick="sortNilai('kelas')">Kelas${arrow('kelas')}</th><th>Paket</th><th>Durasi</th><th class="num">Benar / salah</th><th class="num th-sort" onclick="sortNilai('nilai')">Nilai${arrow('nilai')}</th><th>Status</th><th class="no-print"></th></tr></thead>
            <tbody>${data.map((n, i) => {
                const kk = kkmFor(n.mapel), v = scoreNum(n.nilai);
                const st = kk ? (v >= kk ? '<span class="chip chip-ok">Tuntas</span>' : '<span class="chip chip-bad">Remedial</span>') : '<span class="text-xs text-muted">—</span>';
                const dur = ((n.tanggal || '').split('|')[1] || '-').trim();
                return `<tr><td class="text-muted tabular-nums">${i + 1}</td><td class="font-semibold">${esc(n.student_name)}</td><td>${esc(n.kelas || '-')}</td><td class="text-sm">${esc(n.mapel)}</td>
                    <td class="text-xs text-muted whitespace-nowrap">${esc(dur)}</td><td class="num">${n.benar || 0} / ${n.salah || 0}</td>
                    <td class="num text-lg font-extrabold ${kk ? (v >= kk ? 'text-ok' : 'text-bad') : ''}">${esc(String(n.nilai))}</td><td>${st}</td>
                    <td class="text-right whitespace-nowrap no-print"><button class="btn btn-xs btn-outline" onclick="lihatDetail(${i})">Detail</button>${isAdmin() ? ` <button class="icon-btn icon-btn-sm hover:!text-bad" title="Hapus nilai" onclick="hapusNilai(${n.id}, '${jsq(n.student_name)}')"><i class="fa fa-trash"></i></button>` : ''}</td></tr>`;
            }).join('') || `<tr><td colspan="9">${emptyBox('fa-filter', 'Tidak ada nilai yang cocok dengan filter.')}</td></tr>`}</tbody></table></div></div>`;
}

function renderAnalisis(data, mapel) {
    if (!mapel) { $('nilai-body').innerHTML = `<div class="card">${emptyBox('fa-list-ol', 'Pilih satu paket di filter untuk melihat analisis butir soal.')}</div>`; return; }
    if (!data.length) { $('nilai-body').innerHTML = `<div class="card">${emptyBox('fa-filter', 'Belum ada nilai untuk filter ini.')}</div>`; return; }
    const items = {};
    data.forEach(r => parseDetail(r).forEach(d => {
        const it = items[d.no] = items[d.no] || { no: d.no, tipe: d.tipe, tanya: d.tanya, kunci: d.kunci, n: 0, skor: 0, pilihan: {} };
        it.n++;
        const st = d.status || '';
        if (st === 'Benar') it.skor += 1;
        else if (st.startsWith('Sebagian')) { const f = st.match(/\((\d+)\/(\d+)/); it.skor += f ? (+f[1] / +f[2]) : .5; }
        if (d.tipe === 'PG') { const L = (d.jawab || '-').charAt(0); it.pilihan[L === '-' ? 'Kosong' : L] = (it.pilihan[L === '-' ? 'Kosong' : L] || 0) + 1; }
    }));
    const list = Object.values(items).sort((a, b) => a.no - b.no);
    const kat = p => p >= .7 ? ['Mudah', 'chip-ok'] : p >= .3 ? ['Sedang', 'chip-gold'] : ['Sukar', 'chip-bad'];
    const cnt = { Mudah: 0, Sedang: 0, Sukar: 0 }; list.forEach(it => cnt[kat(it.skor / it.n)[0]]++);
    $('nilai-body').innerHTML = `<div class="card p-4 mb-4 flex flex-wrap gap-x-6 gap-y-2 items-center text-sm">
        <span><b>${list.length}</b> butir dari <b>${data.length}</b> peserta</span>
        <span><span class="chip chip-ok">Mudah</span> ${cnt.Mudah}</span><span><span class="chip chip-gold">Sedang</span> ${cnt.Sedang}</span><span><span class="chip chip-bad">Sukar</span> ${cnt.Sukar}</span>
        <span class="text-muted text-xs w-full sm:w-auto sm:ml-auto">Tingkat kesukaran = proporsi jawaban benar (≥ 70% mudah, 30–69% sedang, &lt; 30% sukar)</span></div>
        <div class="card overflow-hidden"><div class="overflow-x-auto"><table class="tbl"><thead><tr><th class="w-12">No</th><th>Soal</th><th class="min-w-[180px]">Benar</th><th>Kategori</th><th class="min-w-[200px]">Sebaran pilihan (PG)</th></tr></thead><tbody>
        ${list.map(it => {
            const p = it.skor / it.n, [kl, kc] = kat(p), kunciL = (it.kunci || '').charAt(0);
            const totalPil = Object.values(it.pilihan).reduce((a, b) => a + b, 0);
            const sebaran = it.tipe === 'PG' ? ['A', 'B', 'C', 'D', 'E', 'Kosong'].filter(L => it.pilihan[L]).map(L => `<span class="inline-flex items-center gap-1 mr-2 text-xs ${L === kunciL ? 'font-extrabold text-ok' : 'text-muted'}" title="${L === kunciL ? 'Kunci' : ''}">${L === 'Kosong' ? '∅' : L}<span class="tabular-nums">${Math.round(it.pilihan[L] / totalPil * 100)}%</span></span>`).join('') : '<span class="text-xs text-muted">—</span>';
            return `<tr><td class="font-bold tabular-nums">${it.no}</td><td class="max-w-[420px]"><span class="chip chip-muted">${TIPE_LABEL[it.tipe] || esc(it.tipe)}</span><p class="text-sm line-clamp-2 mt-1">${esc((it.tanya || '').slice(0, 200))}</p></td>
                <td><div class="flex items-center gap-2"><div class="progress flex-1"><i style="width:${p * 100}%;background:${p >= .7 ? 'var(--ok)' : p >= .3 ? 'var(--gold)' : 'var(--bad)'}"></i></div><span class="tabular-nums text-sm font-bold w-10 text-right">${Math.round(p * 100)}%</span></div></td>
                <td><span class="chip ${kc}">${kl}</span></td><td>${sebaran}</td></tr>`;
        }).join('')}</tbody></table></div></div>`;
}

function colorizeAnswer(jawab, kunci, tipe, status) {
    if (!jawab || jawab === '-') return '<span class="text-muted">Tidak dijawab</span>';
    const ok = c => `<span class="text-ok font-bold">${formatMath(esc(c))}</span>`, bad = c => `<span class="text-bad font-bold">${formatMath(esc(c))}</span>`;
    if (status === 'Benar') return ok(jawab).replace(/, | \| /g, '<br>');
    const kParts = (kunci || '').split(/, | \| /);
    const parts = jawab.split(/, | \| /);
    if (parts.length > 1) return parts.map(p => kParts.includes(p) ? ok(p) : bad(p)).join('<br>');
    return bad(jawab);
}
function lihatDetail(i) {
    const n = window.filteredResultsData[i]; if (!n) return;
    const d = parseDetail(n); const kk = kkmFor(n.mapel), v = scoreNum(n.nilai);
    const title = `<h2 class="font-extrabold text-lg">${esc(n.student_name)}</h2><p class="text-sm text-muted">${esc(n.kelas || '-')} · ${esc(n.mapel)} · ${n.benar || 0} benar, ${n.salah || 0} salah · nilai <b class="${kk ? (v >= kk ? 'text-ok' : 'text-bad') : 'text-ink'}">${esc(String(n.nilai))}</b></p>`;
    if (!d.length) return openModal(title, emptyBox('fa-link', 'Ujian berbentuk Google Form — detail per butir tersedia di Google Form.'));
    openModal(title, `<div class="space-y-3">${d.map(x => {
        const c = x.status === 'Benar' ? 'chip-ok' : x.status.startsWith('Sebagian') ? 'chip-gold' : x.status === 'Salah' || x.status.startsWith('Salah') ? 'chip-bad' : 'chip-muted';
        return `<div class="card p-4"><div class="flex items-start gap-2 mb-2"><span class="font-extrabold">${x.no}.</span><span class="chip chip-muted">${TIPE_LABEL[x.tipe] || esc(x.tipe)}</span><span class="chip ${c} ml-auto">${esc(x.status)} · ${x.poin}</span></div>
            <div class="text-sm leading-relaxed mb-3">${formatMath(esc(x.tanya || '').replace(/\n/g, '<br>'))}</div>
            <div class="grid sm:grid-cols-2 gap-3 text-sm bg-paper rounded-xl p-3"><div><p class="text-xs text-muted mb-1">Jawaban siswa</p>${colorizeAnswer(x.jawab, x.kunci, x.tipe, x.status)}</div>
            <div><p class="text-xs text-muted mb-1">Kunci</p><span class="font-bold text-ok">${formatMath(esc(x.kunci || '-')).replace(/, | \| /g, '<br>')}</span></div></div></div>`;
    }).join('')}</div>`, { wide: true });
}
async function hapusNilai(id, nama) {
    if (!await confirmDanger('Hapus nilai?', `Nilai <b>${esc(nama)}</b> dihapus permanen.`)) return;
    await api('/admin/delete-result/' + id, { method: 'DELETE' }); toast('Nilai dihapus'); loadNilai();
}
async function clearResults() {
    if (!await confirmDanger('Hapus SEMUA nilai?', 'Seluruh nilai dari semua paket akan dihapus permanen. Unduh rekap dulu jika masih dibutuhkan.', 'HAPUS SEMUA')) return;
    await api('/admin/clear-results', { method: 'DELETE' }); toast('Semua nilai dihapus'); loadNilai();
}
function exportRekap() {
    const data = window.filteredResultsData; if (!data.length) return toast('Tidak ada data', 'info');
    const rows = data.map((n, i) => { const kk = kkmFor(n.mapel), v = scoreNum(n.nilai); return { No: i + 1, Nama: n.student_name, Kelas: n.kelas, Paket: n.mapel, Durasi: ((n.tanggal || '').split('|')[1] || '').trim(), Benar: n.benar || 0, Salah: n.salah || 0, Nilai: isNaN(v) ? n.nilai : v, KKM: kk || '', Status: kk ? (v >= kk ? 'Tuntas' : 'Remedial') : '' }; });
    const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 7 }, { wch: 14 }, { wch: 22 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 6 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `Rekap_Nilai_${($('filter-mapel-nilai').value || 'Semua').replace(/[^\w-]/g, '_')}.xlsx`);
}
async function exportExcelDetail() {
    const data = window.filteredResultsData; if (!data.length) return toast('Tidak ada data', 'info');
    loading('Menyiapkan file…');
    const maxSoal = Math.max(...data.map(n => parseDetail(n).length), 0);
    const sp = (t, c) => `<span style="color:${c};font-weight:bold;">${esc(t)}</span>`, B = '#1F8A5B', R = '#B42318';
    const hdr = ['Nama Siswa', 'Kelas', 'Paket', 'Durasi', 'Benar', 'Salah', 'Nilai'].concat(Array.from({ length: maxSoal }, (_, i) => 'Soal ' + (i + 1)));
    let rows = data.map(n => {
        const d = parseDetail(n);
        return '<tr>' + [n.student_name, n.kelas || '-', n.mapel, ((n.tanggal || '').split('|')[1] || '-').trim(), n.benar || 0, n.salah || 0].map(c => `<td>${esc(c)}</td>`).join('') + `<td style="font-weight:bold">${esc(n.nilai)}</td>`
            + Array.from({ length: maxSoal }, (_, i) => { const x = d[i]; if (!x || !x.jawab || x.jawab === '-') return '<td>-</td>'; return `<td>${sp(x.jawab, x.status === 'Benar' ? B : x.status.startsWith('Sebagian') ? '#8F6609' : R)}</td>`; }).join('') + '</tr>';
    }).join('');
    const mapel = $('filter-mapel-nilai').value;
    if (mapel) {
        try {
            const roster = await api('/admin/exam-roster?mapel=' + encodeURIComponent(mapel));
            const sudah = new Set(data.map(r => r.student_name)); const kelas = $('filter-kelas-nilai').value;
            (roster || []).filter(s => !sudah.has(s.name) && (!kelas || s.kelas === kelas)).forEach(s => {
                rows += `<tr><td>${esc(s.name)}</td><td>${esc(s.kelas)}</td><td>${esc(mapel)}</td><td>-</td><td>0</td><td>0</td><td style="color:${R};font-weight:bold">TIDAK HADIR</td>${'<td>-</td>'.repeat(maxSoal)}</tr>`;
            });
        } catch (e) {}
    }
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial;font-size:11px}td,th{border:1px solid #ccc;padding:5px 8px;vertical-align:top}th{background:#EEF2FA}</style></head><body><table><thead><tr>${hdr.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    Swal.close();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    a.download = `Detail_Jawaban_${(mapel || 'Semua').replace(/[^\w-]/g, '_')}.xls`; document.body.appendChild(a); a.click(); a.remove();
}

// =============================================================
// PESERTA & GURU
// =============================================================
async function loadUsers() {
    if (!$('user-body')) {
        $('page-users').innerHTML = pageHead('Peserta & guru', 'Kelola akun login. Kode kelas siswa (misal 7A) menentukan paket soal yang ia terima.',
            `<div class="flex flex-wrap gap-2"><button onclick="tambahUserManual()" class="btn btn-sm btn-primary"><i class="fa fa-user-plus"></i> Tambah</button>
             <button onclick="bukaImportUser()" class="btn btn-sm btn-outline"><i class="fa fa-file-import"></i> Impor Excel</button>
             <button onclick="cetakKartu()" class="btn btn-sm btn-outline"><i class="fa fa-id-card"></i> Kartu peserta</button>
             <button onclick="cetakDaftarHadir()" class="btn btn-sm btn-outline"><i class="fa fa-clipboard-list"></i> Daftar hadir</button></div>`)
            + `<div class="card p-3 mb-4 flex flex-wrap gap-2 items-center"><input id="user-search" class="field field-sm sm:w-60" placeholder="Cari nama atau username…" oninput="renderUsers()">
               <select id="user-role" class="field field-sm w-auto" onchange="renderUsers()"><option value="">Semua peran</option><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="admin">Admin</option></select>
               <select id="user-kelas" class="field field-sm w-auto" onchange="renderUsers()"><option value="">Semua kelas</option></select>
               <span id="user-count" class="text-sm text-muted ml-auto"></span>
               <button onclick="clearUsers()" class="btn btn-sm btn-danger"><i class="fa fa-trash"></i> Hapus semua non-admin</button></div>
             <div class="card overflow-hidden"><div class="overflow-x-auto max-h-[70vh]"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Password</th><th>Kelas / mapel</th><th>Peran</th><th></th></tr></thead><tbody id="user-body"></tbody></table></div></div>`;
    }
    allUsers = await api('/admin/users') || [];
    fillSelect('user-kelas', allUsers.filter(u => u.role === 'siswa').map(u => u.kelas), 'Semua kelas');
    renderUsers();
}
function filteredUsers() {
    const s = ($('user-search').value || '').toLowerCase(), r = $('user-role').value, k = $('user-kelas').value;
    return allUsers.filter(u => (!r || u.role === r) && (!k || u.kelas === k) && (!s || (u.name || '').toLowerCase().includes(s) || (u.username || '').toLowerCase().includes(s)))
        .sort((a, b) => String(a.kelas || '').localeCompare(String(b.kelas || ''), 'id', { numeric: true }) || String(a.name).localeCompare(String(b.name), 'id'));
}
function renderUsers() {
    const list = filteredUsers();
    $('user-count').textContent = `${list.length} akun`;
    const roleChip = { admin: 'chip-bad', guru: 'chip-gold', siswa: '' };
    $('user-body').innerHTML = list.map(u => `<tr><td class="font-semibold">${esc(u.name)}</td><td class="font-mono text-sm">${esc(u.username)}</td>
        <td><span class="pw text-sm text-muted cursor-pointer" onclick="this.textContent=this.dataset.p" data-p="${esc(u.password)}" title="Klik untuk menampilkan">••••••</span></td>
        <td>${esc(u.role === 'siswa' ? u.kelas : u.mapel || u.kelas || '-')}</td><td><span class="chip ${roleChip[u.role] || 'chip-muted'}">${esc(u.role)}</span></td>
        <td class="text-right whitespace-nowrap"><button class="btn btn-xs btn-outline" onclick="editUser('${jsq(u.username)}')"><i class="fa fa-pen"></i> Ubah</button> <button class="icon-btn icon-btn-sm hover:!text-bad" title="Hapus" onclick="hapusUser('${jsq(u.username)}')"><i class="fa fa-trash"></i></button></td></tr>`).join('')
        || `<tr><td colspan="6">${emptyBox('fa-user-group', 'Tidak ada akun yang cocok.')}</td></tr>`;
}
function userFormHtml(u = {}) {
    return `<div class="text-left space-y-3">
        <div><label class="field-label">Nama lengkap</label><input id="f_name" class="field" value="${esc(u.name || '')}"></div>
        <div class="grid grid-cols-2 gap-3"><div><label class="field-label">Username</label><input id="f_user" class="field" value="${esc(u.username || '')}" autocapitalize="none"></div>
        <div><label class="field-label">Password</label><input id="f_pass" class="field" value="${esc(u.password || '')}"></div></div>
        <div class="grid grid-cols-2 gap-3"><div><label class="field-label">Peran</label><select id="f_role" class="field" onchange="$('f_kelas_lbl').textContent=this.value==='siswa'?'Kelas':'Mapel / paket'">${['siswa', 'guru', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></div>
        <div><label class="field-label" id="f_kelas_lbl">${!u.role || u.role === 'siswa' ? 'Kelas' : 'Mapel / paket'}</label><input id="f_kelas" class="field" value="${esc(u.role && u.role !== 'siswa' ? (u.mapel || '') : (u.kelas || ''))}" placeholder="7A / MTK-7"></div></div></div>`;
}
const readUserForm = () => { const role = $('f_role').value, kv = $('f_kelas').value.trim(); return { name: $('f_name').value.trim(), username: $('f_user').value.trim(), password: $('f_pass').value.trim(), role, kelas: role === 'siswa' ? kv : '', mapel: role !== 'siswa' ? kv : '' }; };
async function tambahUserManual() {
    const r = await Swal.fire({ title: 'Tambah akun', html: userFormHtml({ password: String(Math.floor(1000 + Math.random() * 9000)) }), showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', preConfirm: () => { const v = readUserForm(); if (!v.name || !v.username || !v.password) { Swal.showValidationMessage('Nama, username, dan password wajib diisi'); return false; } return v; } });
    if (!r.isConfirmed) return;
    const d = await api('/admin/add-user', { body: r.value });
    if (d.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: d.message });
    toast('Akun ditambahkan'); loadUsers();
}
async function editUser(username) {
    const u = allUsers.find(x => x.username === username); if (!u) return;
    const r = await Swal.fire({ title: 'Ubah akun', html: userFormHtml(u), showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', preConfirm: () => readUserForm() });
    if (!r.isConfirmed) return;
    const d = await api('/admin/update-user', { method: 'PUT', body: { old_username: u.username, ...r.value } });
    if (d.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: d.message });
    toast('Akun disimpan'); loadUsers();
}
async function hapusUser(username) {
    if (!await confirmDanger('Hapus akun?', `Akun <b>${esc(username)}</b> dihapus. Nilai yang sudah ada tidak ikut terhapus.`)) return;
    const d = await api('/admin/delete-user/' + encodeURIComponent(username), { method: 'DELETE' });
    if (d.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: d.message });
    toast('Akun dihapus'); loadUsers();
}
async function clearUsers() {
    if (!await confirmDanger('Hapus semua siswa & guru?', 'Semua akun selain admin akan dihapus.', 'HAPUS SEMUA')) return;
    await api('/admin/clear-users', { method: 'DELETE' }); toast('Akun dihapus'); loadUsers();
}

function bukaImportUser() {
    openModal('<h2 class="font-extrabold text-lg">Impor akun dari Excel</h2>', `
        <p class="text-sm">Baris judul harus memuat kolom <b>nama</b> dan <b>username</b> (atau NIS/NISN). Kolom opsional: <b>password</b>, <b>kelas</b>, <b>role</b>, <b>mapel</b>. Jika password kosong, username dipakai sebagai password. Username yang sudah ada akan diperbarui.</p>
        <button class="btn btn-xs btn-outline mt-3" onclick="downloadTemplateUser()"><i class="fa fa-download"></i> Unduh template</button>
        <label class="dropzone mt-4"><i class="fa fa-cloud-arrow-up text-xl text-muted"></i><span class="text-sm flex-1"><b>Pilih file</b><br><span class="text-muted" id="iu_name">.xlsx, .xls, atau .csv</span></span><input type="file" id="file-import-user" accept=".xlsx,.xls,.csv" class="sr-only" onchange="$('iu_name').textContent=this.files[0]?.name||''"></label>`,
        { foot: `<button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="prosesImportUser()"><i class="fa fa-file-import"></i> Impor</button>` });
}
function downloadTemplateUser() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { username: '7a001', nama: 'Andi Saputra', password: '4821', kelas: '7A', role: 'siswa', mapel: '' },
        { username: '7a002', nama: 'Budi Prasetyo', password: '1937', kelas: '7A', role: 'siswa', mapel: '' },
        { username: 'guru.mtk', nama: 'Ibu Sri Wahyuni', password: 'ganti123', kelas: '', role: 'guru', mapel: 'MTK-7' },
    ]), 'Akun');
    XLSX.writeFile(wb, 'TEMPLATE_AKUN_CBT.xlsx');
}
async function prosesImportUser() {
    const file = ($('file-import-user').files || [])[0];
    if (!file) return toast('Pilih file dulu', 'warning');
    const buf = await file.arrayBuffer();
    let parsed = [];
    if (file.name.toLowerCase().endsWith('.csv')) parsed = parseCSV(new TextDecoder().decode(buf)).map(r => ({ username: r.username || r.nis || r.nisn, nama: r.nama || r.name, password: r.password || r.pass || r.username, role: (r.role || 'siswa').toLowerCase(), kelas: r.kelas || r.rombel || '', mapel: r.mapel || '' }));
    else {
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        let hi = -1; const c = { u: -1, n: -1, p: -1, r: -1, k: -1, m: -1 };
        for (let i = 0; i < Math.min(raw.length, 20) && hi < 0; i++) {
            (raw[i] || []).forEach((cell, idx) => {
                const s = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (['username', 'user', 'nis', 'nisn'].includes(s)) c.u = idx; if (['nama', 'name', 'namasiswa', 'namalengkap'].includes(s)) c.n = idx;
                if (['password', 'pass', 'sandi'].includes(s)) c.p = idx; if (['role', 'peran'].includes(s)) c.r = idx;
                if (['kelas', 'rombel'].includes(s)) c.k = idx; if (['mapel', 'matapelajaran'].includes(s)) c.m = idx;
            });
            if (c.u >= 0 && c.n >= 0) hi = i;
        }
        if (hi < 0) return Swal.fire({ icon: 'error', title: 'Kolom tidak ditemukan', text: 'File harus memiliki kolom "nama" dan "username" (atau NIS/NISN).' });
        for (let i = hi + 1; i < raw.length; i++) {
            const r = raw[i] || []; const un = r[c.u], nm = r[c.n]; if (!un || !nm) continue;
            parsed.push({ username: String(un).trim(), nama: String(nm).trim(), password: String(c.p >= 0 && r[c.p] ? r[c.p] : un).trim(), role: c.r >= 0 && r[c.r] ? String(r[c.r]).toLowerCase().trim() : 'siswa', kelas: c.k >= 0 && r[c.k] ? String(r[c.k]).trim() : '', mapel: c.m >= 0 && r[c.m] ? String(r[c.m]).trim() : '' });
        }
    }
    const seen = new Set(); parsed = parsed.filter(x => x.username && !seen.has(x.username) && seen.add(x.username));
    if (!parsed.length) return Swal.fire({ icon: 'error', title: 'Data kosong', text: 'Tidak ada baris yang bisa dibaca.' });
    const kelasCount = {}; parsed.forEach(p => { kelasCount[p.kelas || '—'] = (kelasCount[p.kelas || '—'] || 0) + 1; });
    const ok = await Swal.fire({ icon: 'question', title: `Impor ${parsed.length} akun?`, html: `<p class="text-sm">${Object.entries(kelasCount).map(([k, n]) => `<span class="chip mr-1 mb-1">${esc(k)}: ${n}</span>`).join('')}</p><p class="text-sm text-muted mt-3">Contoh: ${esc(parsed[0].nama)} · ${esc(parsed[0].username)}</p>`, showCancelButton: true, confirmButtonText: 'Impor', cancelButtonText: 'Batal' });
    if (!ok.isConfirmed) return;
    let ins = 0, upd = 0;
    for (let i = 0; i < parsed.length; i += 100) {
        loading(`Menyimpan ${Math.min(i + 100, parsed.length)} dari ${parsed.length}…`);
        const r = await api('/admin/import-users', { body: { data: parsed.slice(i, i + 100) } });
        if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
        ins += r.inserted || 0; upd += r.updated || 0;
    }
    closeModal(); Swal.fire({ icon: 'success', title: 'Impor selesai', text: `${ins} akun baru, ${upd} akun diperbarui.` }); loadUsers();
}

function cetakKartu() {
    const list = filteredUsers().filter(u => u.role === 'siswa');
    if (!list.length) return toast('Tidak ada siswa pada filter ini', 'info');
    const logo = LOGO_DATA.sekolah || location.origin + logoUrl();
    const cards = list.map(u => `<div class="k"><div class="h"><i class="lg"></i><div><b>KARTU PESERTA UJIAN</b><br><span>${esc(SEKOLAH.nama_sekolah)}${SEKOLAH.tahun_pelajaran ? ' · TP ' + esc(SEKOLAH.tahun_pelajaran) : ''}</span></div></div>
        <table><tr><td>Nama</td><td>: <b>${esc(u.name)}</b></td></tr><tr><td>Kelas</td><td>: ${esc(u.kelas || '-')}</td></tr><tr><td>Username</td><td>: <b class="m">${esc(u.username)}</b></td></tr><tr><td>Password</td><td>: <b class="m">${esc(u.password)}</b></td></tr></table>
        <p class="n">Simpan kartu ini. Jangan berikan password kepada orang lain.</p></div>`).join('');
    const w = window.open('', '_blank');
    if (!w) return toast('Izinkan pop-up untuk mencetak', 'error');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kartu Peserta ${esc($('user-kelas').value || '')}</title><style>
        @page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;margin:0}.g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
        .k{border:1.5px solid #14306B;border-radius:8px;padding:10px 12px;break-inside:avoid;font-size:12px}.h{display:flex;gap:8px;align-items:center;border-bottom:2px solid #D9A21B;padding-bottom:6px;margin-bottom:6px;color:#14306B}
        .h .lg{width:34px;height:34px;flex-shrink:0;background:url('${logo}') center/contain no-repeat;-webkit-print-color-adjust:exact;print-color-adjust:exact}.h span{font-size:11px;color:#444}table{border-collapse:collapse}td{padding:2px 4px 2px 0;vertical-align:top}.m{font-family:Consolas,monospace;font-size:13px;letter-spacing:.04em}.n{font-size:9.5px;color:#666;margin:6px 0 0}
        </style></head><body><div class="g">${cards}</div><script>Promise.race([Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))),new Promise(r=>setTimeout(r,4000))]).then(()=>setTimeout(()=>window.print(),250))<\/script></body></html>`);
    w.document.close();
}

// =============================================================
// AKUN
// =============================================================
function renderAkun() {
    $('page-akun').innerHTML = pageHead('Akun saya', esc(activeUser.name) + ' · ' + esc(activeUser.username)) + `
        <form class="card p-5 max-w-md space-y-4" onsubmit="event.preventDefault(); gantiPassword();">
            <h3 class="section-title">Ganti password</h3>
            <div><label class="field-label" for="pw_old">Password lama</label><input id="pw_old" type="password" class="field" autocomplete="current-password" required></div>
            <div><label class="field-label" for="pw_new">Password baru</label><input id="pw_new" type="password" class="field" autocomplete="new-password" minlength="4" required></div>
            <div><label class="field-label" for="pw_new2">Ulangi password baru</label><input id="pw_new2" type="password" class="field" autocomplete="new-password" required></div>
            <button class="btn btn-primary w-full">Simpan password</button></form>`;
}
async function gantiPassword() {
    if ($('pw_new').value !== $('pw_new2').value) return toast('Password baru tidak sama', 'warning');
    const r = await api('/account/password', { body: { old_password: $('pw_old').value, new_password: $('pw_new').value } });
    if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal', text: r.message });
    toast('Password diganti'); renderAkun();
}

// =============================================================
// PROFIL SEKOLAH & KOP SURAT
// =============================================================
let skDraft = null;
const SK_GROUPS = [
    ['Identitas sekolah', [['nama_sekolah', 'Nama sekolah', 'SMP Negeri 2 Soyo Jaya', 2], ['singkatan', 'Nama singkat aplikasi', 'Spenda'], ['npsn', 'NPSN', '4020xxxx'], ['tahun_pelajaran', 'Tahun pelajaran', '2026/2027']]],
    ['Baris instansi di kop', [['instansi_1', 'Baris 1', 'PEMERINTAH KABUPATEN …', 2], ['instansi_2', 'Baris 2', 'DINAS PENDIDIKAN DAN KEBUDAYAAN', 2]]],
    ['Alamat & kontak', [['alamat', 'Jalan / desa', 'Jl. …, Desa …', 2], ['kecamatan', 'Kecamatan'], ['kabupaten', 'Kabupaten / kota'], ['provinsi', 'Provinsi'], ['kode_pos', 'Kode pos'], ['telepon', 'Telepon'], ['email', 'Email'], ['website', 'Website', '', 2]]],
    ['Penandatangan dokumen', [['kepala_sekolah', 'Nama kepala sekolah', 'Nama lengkap & gelar', 2], ['nip_kepala', 'NIP kepala sekolah'], ['tempat_ttd', 'Tempat tanda tangan', 'Contoh: Soyo Jaya']]],
];

async function renderSekolah() {
    await loadSekolah();
    skDraft = { ...SEKOLAH, _logo_sekolah: undefined, _logo_pemda: undefined };
    const field = ([k, label, ph = '', span = 1]) => `<div class="${span === 2 ? 'sm:col-span-2' : ''}"><label class="field-label" for="sk_${k}">${label}</label><input id="sk_${k}" class="field" value="${esc(SEKOLAH[k] || '')}" placeholder="${esc(ph)}" oninput="skInput('${k}', this.value)"></div>`;
    const logoBox = (jenis, label, note) => `<div class="card p-4"><p class="font-bold">${label}</p><p class="text-xs text-muted mb-3">${note}</p>
        <div class="flex items-center gap-4"><div class="w-20 h-20 rounded-xl border border-line grid place-items-center bg-paper overflow-hidden"><img id="sk_prev_${jenis}" class="max-w-full max-h-full object-contain" alt=""></div>
        <div class="flex flex-col gap-2"><label class="btn btn-sm btn-outline cursor-pointer"><i class="fa fa-upload"></i> Pilih gambar<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" onchange="skLogo('${jenis}', this.files[0]); this.value=''"></label>
        <button class="btn btn-sm btn-ghost" onclick="skLogo('${jenis}', null)"><i class="fa fa-xmark"></i> ${jenis === 'sekolah' ? 'Pakai logo bawaan' : 'Hapus'}</button></div></div></div>`;
    $('page-sekolah').innerHTML = pageHead('Profil sekolah', 'Data ini dipakai di seluruh aplikasi dan sebagai kop surat pada dokumen cetak (rekap nilai, daftar hadir, kartu peserta).',
        `<div class="flex gap-2"><button class="btn btn-sm btn-outline" onclick="contohKop()"><i class="fa fa-print"></i> Cetak contoh</button><button class="btn btn-sm btn-primary" id="sk_simpan" onclick="simpanSekolah()"><i class="fa fa-floppy-disk"></i> Simpan</button></div>`)
        + `<div class="grid xl:grid-cols-[1fr_520px] gap-5 items-start">
            <div class="space-y-4">${SK_GROUPS.map(([t, fs]) => `<div class="card p-5"><h3 class="section-title mb-3">${t}</h3><div class="grid sm:grid-cols-2 gap-3">${fs.map(field).join('')}</div></div>`).join('')}</div>
            <div class="space-y-4 xl:sticky xl:top-0">
                <div class="grid sm:grid-cols-2 gap-4">${logoBox('sekolah', 'Logo sekolah', 'Tampil di aplikasi & kanan kop. PNG transparan, persegi.')}${logoBox('pemda', 'Logo pemda (opsional)', 'Tampil di kiri kop surat.')}</div>
                <div class="card p-4"><p class="font-bold mb-3">Pratinjau kop surat</p><div class="kop-preview" id="sk_preview"></div></div>
            </div></div>`;
    skPreview();
}
function skInput(k, v) { skDraft[k] = v; skPreview(); }
function skLogoSrc(jenis) {
    const d = skDraft['_logo_' + jenis];
    if (d !== undefined) return d || (jenis === 'sekolah' ? '/logo-sekolah.png' : '');
    return logoUrl(jenis);
}
function skPreview() {
    if (!$('sk_preview')) return;
    $('sk_preview').innerHTML = kopSuratHtml(skDraft, { sekolah: skLogoSrc('sekolah'), pemda: skLogoSrc('pemda') });
    ['sekolah', 'pemda'].forEach(j => { const img = $('sk_prev_' + j), src = skLogoSrc(j); img.src = src || ''; img.style.visibility = src ? 'visible' : 'hidden'; });
}

// Kecilkan logo di browser (maks 400 px, tetap transparan) sebelum disimpan
async function skLogo(jenis, file) {
    if (!file) { skDraft['_logo_' + jenis] = ''; skPreview(); return; }
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return toast('Gunakan gambar PNG, JPG, WEBP, atau SVG', 'warning');
    const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    if (file.type === 'image/svg+xml') {
        if (dataUrl.length > 500 * 1024) return toast('File SVG terlalu besar', 'warning');
        skDraft['_logo_' + jenis] = dataUrl; return skPreview();
    }
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = dataUrl; });
    const max = 400, sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/png');
    if (out.length > 300 * 1024) out = c.toDataURL('image/webp', 0.9);
    skDraft['_logo_' + jenis] = out; skPreview();
    toast(`Logo siap (${Math.round(out.length * 0.75 / 1024)} KB). Klik Simpan.`, 'info');
}
async function simpanSekolah() {
    const body = {};
    SK_GROUPS.forEach(([, fs]) => fs.forEach(([k]) => { body[k] = $('sk_' + k).value; }));
    ['sekolah', 'pemda'].forEach(j => { if (skDraft['_logo_' + j] !== undefined) body['logo_' + j] = skDraft['_logo_' + j]; });
    if (!body.nama_sekolah.trim()) return toast('Nama sekolah wajib diisi', 'warning');
    const btn = $('sk_simpan'); btn.disabled = true;
    try {
        const r = await api('/admin/sekolah', { method: 'PUT', body });
        if (r.status !== 'success') return Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: r.message });
        toast('Profil sekolah disimpan'); await renderSekolah();
    } finally { btn.disabled = false; }
}
function contohKop() {
    cetakDokumen('Contoh kop surat', `<h1>CONTOH DOKUMEN</h1><p class="sub">Tahun Pelajaran ${esc(SEKOLAH.tahun_pelajaran || '….')}</p><p>Ini adalah contoh tampilan kop surat dan tanda tangan yang dipakai pada dokumen cetak aplikasi CBT.</p>${ttdHtml()}`);
}

// ---------- Dokumen cetak berkop ----------
function cetakRekapNilai() {
    const data = window.filteredResultsData;
    if (!data.length) return toast('Tidak ada data untuk dicetak', 'info');
    const m = $('filter-mapel-nilai').value, k = $('filter-kelas-nilai').value, kkm = m ? kkmFor(m) : 0;
    const nums = data.map(r => scoreNum(r.nilai));
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const rows = data.map((n, i) => { const v = scoreNum(n.nilai), kk = kkmFor(n.mapel); return `<tr><td class="c">${i + 1}</td><td>${esc(n.student_name)}</td><td class="c">${esc(n.kelas || '-')}</td>${m ? '' : `<td>${esc(n.mapel)}</td>`}<td class="c">${n.benar || 0}</td><td class="c">${n.salah || 0}</td><td class="c"><b>${esc(String(n.nilai))}</b></td><td class="c">${kk ? (v >= kk ? 'Tuntas' : 'Remedial') : ''}</td></tr>`; }).join('');
    cetakDokumen('Rekap nilai ' + (m || ''), `<h1>REKAP NILAI UJIAN</h1><p class="sub">Tahun Pelajaran ${esc(SEKOLAH.tahun_pelajaran || '….')}</p>
        <table class="meta"><tr><td>Paket / mapel</td><td>: ${esc(m || 'Semua paket')}</td></tr><tr><td>Kelas</td><td>: ${esc(k || 'Semua kelas')}</td></tr>${kkm ? `<tr><td>KKM</td><td>: ${kkm}</td></tr>` : ''}<tr><td>Jumlah peserta</td><td>: ${data.length}</td></tr></table><br>
        <table class="data"><thead><tr><th>No</th><th>Nama peserta</th><th>Kelas</th>${m ? '' : '<th>Paket</th>'}<th>Benar</th><th>Salah</th><th>Nilai</th><th>Ket.</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td colspan="${m ? 5 : 6}" class="r">Rata-rata / tertinggi / terendah</td><td class="c" colspan="2"><b>${avg.toFixed(1)}</b> / ${Math.max(...nums)} / ${Math.min(...nums)}</td></tr></tfoot></table>
        ${ttdHtml({ kiri: { jabatan: 'Guru Mata Pelajaran', nama: '', nip: '' } })}`);
}
function cetakDaftarHadir() {
    const list = filteredUsers().filter(u => u.role === 'siswa');
    if (!list.length) return toast('Tidak ada siswa pada filter ini', 'info');
    const kelas = $('user-kelas').value;
    const rows = list.map((u, i) => `<tr><td class="c">${i + 1}</td><td>${esc(u.name)}</td><td class="c">${esc(u.kelas || '-')}</td><td style="height:30px">${i % 2 === 0 ? `${i + 1}.` : ''}</td><td>${i % 2 === 1 ? `${i + 1}.` : ''}</td><td></td></tr>`).join('');
    cetakDokumen('Daftar hadir ' + (kelas || ''), `<h1>DAFTAR HADIR PESERTA UJIAN</h1><p class="sub">Tahun Pelajaran ${esc(SEKOLAH.tahun_pelajaran || '….')}</p>
        <table class="meta"><tr><td>Mata pelajaran</td><td>: ..............................................</td></tr><tr><td>Kelas / ruang</td><td>: ${esc(kelas || '..............')} / ..............</td></tr><tr><td>Hari, tanggal</td><td>: ..............................................</td></tr><tr><td>Waktu</td><td>: .......... s.d. ..........</td></tr></table><br>
        <table class="data"><thead><tr><th style="width:34px">No</th><th>Nama peserta</th><th style="width:60px">Kelas</th><th colspan="2">Tanda tangan</th><th style="width:80px">Ket.</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="font-size:10.5pt;margin-top:8px">Jumlah peserta: ${list.length} · Hadir: ........ · Tidak hadir: ........</p>
        ${ttdHtml({ kiri: { jabatan: 'Pengawas Ujian', nama: '', nip: '' } })}`);
}
