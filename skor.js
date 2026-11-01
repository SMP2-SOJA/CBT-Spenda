// ============================================================
// CBT SPENDA — PAPAN SKOR LANGSUNG
// Bisa dibuka dari halaman login atau langsung lewat /skor
//   /skor?paket=MTK-7&kelas=7A&mode=kelas
// Cocok ditayangkan di proyektor/TV (tombol layar penuh).
// ============================================================
let publicInterval = null, publicActivityData = [], pubMode = 'siswa', pubUserChose = false, pubConfig = { live_score: 'on' };
let pubPrevPos = {}, pubPrevScore = {};

async function showPublicScore() {
    showView('view-public-score');
    const q = new URLSearchParams(location.search);
    if (q.get('mode') === 'kelas') pubMode = 'kelas';
    window._pubInit = { paket: q.get('paket') || '', kelas: q.get('kelas') || '' };
    pubUserChose = !!(q.get('paket') || q.get('kelas'));
    try { pubConfig = await (await fetch(API + '/public/config')).json(); } catch (e) {}
    await loadPublicData();
    clearInterval(publicInterval);
    publicInterval = setInterval(() => { if (document.visibilityState === 'visible') loadPublicData(); }, 5000);
}
function keluarPublic() {
    clearInterval(publicInterval);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (location.pathname.replace(/\/$/, '') === '/skor') { location.href = '/'; return; }
    showView('view-login');
}

async function loadPublicData() {
    try {
        const res = await fetch(API + '/public/live-score', { cache: 'no-store' });
        if (res.status === 403) { renderPubOff(); return; }
        publicActivityData = await res.json();
        fillSelect('pub-filter-mapel', publicActivityData.map(a => a.exam_name), 'Semua paket');
        fillSelect('pub-filter-kelas', publicActivityData.map(a => a.kelas).filter(k => k && k !== '-'), 'Semua kelas');
        if (window._pubInit) {
            if (window._pubInit.paket) $('pub-filter-mapel').value = window._pubInit.paket;
            if (window._pubInit.kelas) $('pub-filter-kelas').value = window._pubInit.kelas;
            window._pubInit = null;
        }
        // Tanpa pilihan, tampilkan paket yang paling banyak pesertanya (ranking lintas paket tidak adil)
        if (!pubUserChose && !$('pub-filter-mapel').value) {
            const cnt = {}; publicActivityData.forEach(a => { cnt[a.exam_name] = (cnt[a.exam_name] || 0) + 1; });
            const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
            if (top) $('pub-filter-mapel').value = top[0];
        }
        $('pub-updated').textContent = 'Pembaruan terakhir ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        renderPublicTable();
    } catch (e) {
        $('pub-updated').textContent = 'Koneksi terputus — mencoba lagi…';
    }
}
function onPubFilter() { pubUserChose = true; pubPrevPos = {}; renderPublicTable(); }
function setPubMode(m) { pubMode = m; pubPrevPos = {}; renderPublicTable(); }

function renderPubOff() {
    $('pub-stats').innerHTML = ''; $('pub-podium').innerHTML = ''; $('pub-note').textContent = '';
    $('public-list').innerHTML = `<li class="board-empty"><i class="fa fa-eye-slash"></i>Papan skor sedang dinonaktifkan oleh sekolah.</li>`;
}

// Peringkat kompetisi: nilai sama → peringkat sama (1, 1, 3)
function rankList(list, key) {
    let last = null, rank = 0;
    return list.map((x, i) => { const v = x[key]; if (v === null || v !== last) { rank = i + 1; last = v; } return { ...x, rank: v === null ? null : rank }; });
}
const fmtSkor = v => v === null || v === undefined || isNaN(v) ? '—' : (Math.round(v * 10) / 10).toLocaleString('id-ID');

function renderPublicTable() {
    document.querySelectorAll('.board-tab').forEach(b => b.classList.toggle('is-active', b.dataset.mode === pubMode));
    const k = $('pub-filter-kelas').value, m = $('pub-filter-mapel').value;
    $('pub-judul-paket').textContent = m ? '· ' + m + (k ? ' · ' + k : '') : (k ? '· ' + k : '');
    const data = publicActivityData.filter(a => (!k || a.kelas === k) && (!m || a.exam_name === m));

    const nilai = data.map(a => a.score).filter(v => v !== null && !isNaN(v));
    const avg = nilai.length ? nilai.reduce((a, b) => a + b, 0) / nilai.length : null;
    const stat = (n, l) => `<div><b>${n}</b><span>${l}</span></div>`;
    $('pub-stats').innerHTML = stat(data.length, 'Peserta') + stat(data.filter(a => a.status !== 'Selesai').length, 'Sedang mengerjakan') + stat(data.filter(a => a.status === 'Selesai').length, 'Selesai') + stat(fmtSkor(avg), 'Rata-rata');

    if (!data.length) {
        $('pub-podium').innerHTML = '';
        $('public-list').innerHTML = `<li class="board-empty"><i class="fa fa-hourglass-half"></i>Belum ada peserta yang mulai. Papan ini terisi otomatis begitu ujian dimulai.</li>`;
        $('pub-note').textContent = ''; return;
    }

    let rows;
    if (pubMode === 'kelas') {
        const g = {};
        data.forEach(a => { const kk = a.kelas || '-'; (g[kk] = g[kk] || []).push(a); });
        rows = Object.entries(g).map(([kelas, arr]) => {
            const sk = arr.map(a => a.score).filter(v => v !== null && !isNaN(v));
            return { key: 'k|' + kelas, title: 'Kelas ' + kelas, sub: `${arr.length} peserta · ${arr.filter(a => a.status === 'Selesai').length} selesai`, score: sk.length ? sk.reduce((a, b) => a + b, 0) / sk.length : null, top: sk.length ? Math.max(...sk) : null, done: arr.filter(a => a.status === 'Selesai').length, total: arr.length, selesai: false };
        });
    } else {
        rows = data.map(a => ({ key: a.student_name + '|' + a.exam_name, title: a.student_name, sub: `${a.kelas || '-'}${m ? '' : ' · ' + a.exam_name}`, score: a.score, done: a.done, total: a.total, selesai: a.status === 'Selesai' }));
    }
    rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.selesai - a.selesai) || ((b.done || 0) - (a.done || 0)) || String(a.title).localeCompare(String(b.title), 'id'));
    rows = rankList(rows, 'score');

    // Simpan posisi lama untuk animasi perpindahan peringkat (FLIP)
    const oldPos = {};
    document.querySelectorAll('#public-list [data-key], #pub-podium [data-key]').forEach(el => { oldPos[el.dataset.key] = el.getBoundingClientRect().top; });

    const podium = rows.filter(r => r.rank !== null && r.rank <= 3).slice(0, 3);
    const rest = rows.slice(podium.length);
    const scoreCls = r => (pubPrevScore[r.key] !== undefined && r.score !== null && r.score > pubPrevScore[r.key]) ? 'is-up' : '';
    $('pub-podium').innerHTML = podium.map((r, i) => `<div class="pod pod-${i + 1} ${r.rank === 1 ? 'is-first' : ''}" data-key="${esc(r.key)}">
        <span class="pod-rank" aria-label="Peringkat ${r.rank}">${r.rank}</span>
        <p class="pod-name" title="${esc(r.title)}">${esc(r.title)}</p><p class="pod-sub">${esc(r.sub)}</p>
        <p class="pod-score ${scoreCls(r)}">${fmtSkor(r.score)}</p>
        ${pubMode === 'siswa' ? `<p class="pod-sub">${r.selesai ? '<i class="fa fa-check"></i> Selesai' : r.total ? `${r.done}/${r.total} soal` : 'Baru mulai'}</p>` : `<p class="pod-sub">Tertinggi ${fmtSkor(r.top)}</p>`}
    </div>`).join('');

    $('public-list').innerHTML = rest.map(r => {
        const pct = r.total ? Math.round((r.done || 0) / r.total * 100) : 0;
        return `<li class="row" data-key="${esc(r.key)}">
            <span class="row-rank">${r.rank ?? '–'}</span>
            <div class="min-w-0"><p class="row-name">${esc(r.title)}</p><p class="row-sub">${esc(r.sub)}</p></div>
            <div class="row-prog">${r.selesai ? '<span class="row-done"><i class="fa fa-check"></i> Selesai</span>' : `<div class="bar"><i style="width:${pct}%"></i></div><small>${r.total ? (r.done || 0) + '/' + r.total : ''}</small>`}</div>
            <span class="row-score ${scoreCls(r)}">${fmtSkor(r.score)}</span></li>`;
    }).join('');

    // Animasi: baris yang naik/turun peringkat bergeser dari posisi lamanya
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
        document.querySelectorAll('#public-list [data-key], #pub-podium [data-key]').forEach(el => {
            const before = oldPos[el.dataset.key]; if (before === undefined) return;
            const dy = before - el.getBoundingClientRect().top; if (Math.abs(dy) < 2) return;
            el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`;
            requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; }));
        });
    }
    pubPrevScore = {}; rows.forEach(r => { pubPrevScore[r.key] = r.score; });

    const notes = [];
    if (pubConfig.live_score === 'final') notes.push('Skor ditampilkan setelah peserta selesai mengerjakan.');
    else if (pubMode === 'siswa') notes.push('Skor peserta yang masih mengerjakan bersifat sementara.');
    if (pubMode === 'kelas') notes.push('Peringkat kelas berdasarkan rata-rata skor peserta.');
    $('pub-note').textContent = notes.join(' ');
}

function bagikanPapan() {
    const p = new URLSearchParams();
    if ($('pub-filter-mapel').value) p.set('paket', $('pub-filter-mapel').value);
    if ($('pub-filter-kelas').value) p.set('kelas', $('pub-filter-kelas').value);
    if (pubMode === 'kelas') p.set('mode', 'kelas');
    copyText(location.origin + '/skor' + (p.toString() ? '?' + p : ''));
}
function layarPenuhPapan() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => toast('Browser tidak mendukung layar penuh', 'info'));
}
document.addEventListener('fullscreenchange', () => {
    document.body.classList.toggle('tv', !!document.fullscreenElement && !$('view-public-score').classList.contains('hidden'));
});
