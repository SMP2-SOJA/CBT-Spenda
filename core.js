// ============================================================
// CBT SPENDA — CORE (API, sesi, utilitas tampilan)
// ============================================================
const API = '/api';
let activeUser = null;

// ---------- Sesi ----------
const Session = {
    get token() { try { return sessionStorage.getItem('cbt_token') || ''; } catch (e) { return ''; } },
    save(token, user) { try { sessionStorage.setItem('cbt_token', token); sessionStorage.setItem('cbt_user', JSON.stringify(user)); } catch (e) {} },
    load() { try { return JSON.parse(sessionStorage.getItem('cbt_user') || 'null'); } catch (e) { return null; } },
    clear() { try { sessionStorage.removeItem('cbt_token'); sessionStorage.removeItem('cbt_user'); } catch (e) {} },
};

// ---------- API ----------
async function api(path, opts = {}) {
    const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
    if (Session.token) init.headers.Authorization = 'Bearer ' + Session.token;
    if (opts.body instanceof FormData) init.body = opts.body;
    else if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    const res = await fetch(API + path, init);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && !opts.allow401) {
        if (activeUser && !(typeof isExamActive !== 'undefined' && isExamActive)) {
            await Swal.fire({ icon: 'info', title: 'Sesi berakhir', text: 'Silakan masuk kembali.', confirmButtonText: 'Masuk' });
            logout();
        }
        throw new Error((data && data.message) || 'Sesi berakhir');
    }
    if (res.status === 403 && data && data.message && !opts.quiet) toast(data.message, 'error');
    if (!res.ok && !data) throw new Error('Server tidak merespons (' + res.status + ')');
    return data;
}

// ---------- Utilitas ----------
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsq = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    $(id).classList.remove('hidden');
    window.scrollTo(0, 0);
}

function toast(msg, icon = 'success') {
    Swal.fire({ toast: true, position: 'top-end', icon, title: msg, showConfirmButton: false, timer: 2600, timerProgressBar: true });
}

function loading(title = 'Memproses…') { Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); }

// Konfirmasi tindakan berbahaya; opsional wajib mengetik kata tertentu
async function confirmDanger(title, html, typeWord) {
    const r = await Swal.fire({
        icon: 'warning', title, html: html + (typeWord ? `<p class="mt-4 text-sm">Ketik <b>${esc(typeWord)}</b> untuk melanjutkan.</p>` : ''),
        input: typeWord ? 'text' : undefined, inputAttributes: { autocapitalize: 'off', autocomplete: 'off' },
        showCancelButton: true, confirmButtonText: 'Ya, hapus', cancelButtonText: 'Batal', focusCancel: true,
        customClass: { confirmButton: 'swal2-deny' },
        preConfirm: v => { if (typeWord && String(v).trim().toUpperCase() !== typeWord.toUpperCase()) { Swal.showValidationMessage(`Ketik "${typeWord}" dengan benar`); return false; } return true; },
    });
    return r.isConfirmed;
}

function togglePass(id, btn) {
    const el = $(id); const show = el.type === 'password';
    el.type = show ? 'text' : 'password';
    btn.querySelector('i').className = show ? 'fa fa-eye-slash' : 'fa fa-eye';
}

async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast('Disalin: ' + t); } catch (e) { toast('Gagal menyalin', 'error'); }
}

// ---------- Modal ----------
function openModal(titleHtml, bodyHtml, { wide = false, foot = '' } = {}) {
    $('modal-title').innerHTML = titleHtml;
    $('modal-body').innerHTML = bodyHtml;
    $('modal-foot').innerHTML = foot;
    $('modal-foot').classList.toggle('hidden', !foot);
    document.querySelector('.modal-panel').classList.toggle('is-wide', wide);
    $('modal').classList.remove('hidden');
    applyMathRendering($('modal-body'));
}
function closeModal() { $('modal').classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal(); });

// ---------- Matematika ----------
// Pecahan (a/b), pangkat ^, indeks _, dan pangkat implisit dari Word (x2 → x²)
function formatMath(text) {
    if (typeof text !== 'string') return text ?? '';
    text = text.replace(/\(([^()\/]+)\/([^()\/]+)\)/g, (m, num, den) => {
        if (num.length > 30 || den.length > 30) return m;
        return `<span class="frac"><span>${num}</span><span>${den}</span></span>`;
    });
    text = text
        .replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>')
        .replace(/\^([a-zA-Z0-9]{1,2})(?=[^a-zA-Z0-9]|$)/g, '<sup>$1</sup>')
        .replace(/_\(([^)]*)\)/g, '<sub>$1</sub>')
        .replace(/_([a-zA-Z0-9]{1,2})(?=[^a-zA-Z0-9]|$)/g, '<sub>$1</sub>');
    // Pangkat implisit dari Word: hanya variabel huruf kecil (x2 → x², 4x2y, cm2).
    // Tidak menyentuh: Rp30.000, H2O/CO2 (huruf besar), 7A, angka ribuan, URL.
    text = text.replace(/([a-z])(\d{1,2})(?=[a-zA-Z\s\+\-\*\/\=\.\,\;\:\!\?\)\(\[\]\{\}<]|$)/g, (m, v, exp, off, str) => {
        const after = str.slice(off + v.length + exp.length);
        if (/^\d/.test(after) || /^[.,]\d/.test(after)) return m;
        if (off > 0 && /[A-Z]/.test(str[off - 1])) return m;
        if (/https?:\/\/\S*$/.test(str.slice(0, off)) || /<[^>]*$/.test(str.slice(0, off))) return m;
        return v + '<sup>' + exp + '</sup>';
    });
    return text;
}

// Rumus LaTeX ($...$ atau \(...\)) dirender dengan KaTeX jika tersedia
function applyMathRendering(el) {
    if (!el || typeof renderMathInElement !== 'function') return;
    try {
        renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });
    } catch (e) {}
}

// Konversi link Google Drive menjadi URL gambar langsung
function driveImg(url, size = 1200) {
    url = String(url || '').trim();
    if (!url.startsWith('http')) return { src: '', fallback: '' };
    if (url.includes('drive.google.com')) {
        const m = url.match(/[?&]id=([^&\s]+)/) || url.match(/\/d\/([^\/\s?]+)/);
        if (m) return { src: `https://lh3.googleusercontent.com/d/${m[1]}=s${size}`, fallback: `https://drive.google.com/uc?export=view&id=${m[1]}` };
    }
    return { src: url, fallback: url };
}
function isImageUrl(v) {
    return typeof v === 'string' && v.startsWith('http') && (v.includes('drive.google.com') || v.includes('googleusercontent') || /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(v));
}
function imgTag(url, size, cls = '') {
    const { src, fallback } = driveImg(url, size);
    if (!src) return '';
    return `<img src="${esc(src)}" data-fb="${esc(fallback)}" class="${cls}" alt="Gambar soal" loading="lazy" onerror="if(!this.dataset.tried){this.dataset.tried=1;this.src=this.dataset.fb}else{this.outerHTML='<p class=\\'text-sm text-muted py-3\\'>Gambar tidak dapat dimuat. Periksa koneksi internet.</p>'}">`;
}

const TIPE_LABEL = { PG: 'Pilihan ganda', PGK: 'PG kompleks', BS: 'Benar / salah', TS: 'Sesuai / tidak', NK: 'Numerik / kategorik', SIFAT: 'Sifat', ISIAN: 'Isian singkat', ESAI: 'Uraian', JODOH: 'Menjodohkan', GFORM: 'Google Form' };
const splitOpsi = q => (q.opsi_json ? String(q.opsi_json).split(/\|\|\|/).map(o => o.trim()).filter(o => o) : []);

// ---------- Login / logout ----------
async function prosesLogin() {
    const username = $('login-user').value.trim(), password = $('login-pass').value;
    if (!username || !password) return toast('Isi username dan password', 'warning');
    const btn = $('btn-login'); btn.disabled = true; btn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> Memeriksa…';
    try {
        const data = await api('/login', { body: { username, password }, allow401: true });
        if (data && data.status === 'success') {
            Session.save(data.token, data.user);
            activeUser = data.user;
            routeUser();
        } else {
            Swal.fire({ icon: 'error', title: 'Gagal masuk', text: (data && data.message) || 'Username atau password salah.' });
        }
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Tidak bisa terhubung', text: 'Periksa koneksi internet lalu coba lagi.' });
    } finally { btn.disabled = false; btn.textContent = 'Masuk'; }
}

function routeUser() {
    if (!activeUser) return showView('view-login');
    if (activeUser.role === 'siswa') bukaHalamanPin();
    else bukaPanelAdmin();
}

function logout() {
    Session.clear();
    location.href = '/';
}

// Pulihkan sesi saat halaman dimuat ulang
window.addEventListener('DOMContentLoaded', () => {
    if (location.pathname.replace(/\/$/, '') === '/skor') { showPublicScore(); return registerSW(); }
    const u = Session.load();
    if (u && Session.token) { activeUser = u; routeUser(); }
    else showView('view-login');
    registerSW();
    fetch(API + '/public/config').then(r => r.json()).then(c => { if (c.live_score === 'off') document.querySelectorAll('[data-live-btn]').forEach(b => b.remove()); }).catch(() => {});
});
function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }

const scoreNum = s => parseFloat(String(s ?? '').split('|')[0]) || 0;

function fillSelect(id, values, allLabel) {
    const el = $(id); const cur = el.value;
    const uniq = [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id', { numeric: true }));
    el.innerHTML = `<option value="">${allLabel}</option>` + uniq.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (uniq.includes(cur)) el.value = cur;
}

// Status aktivitas → label & warna
function statusInfo(s) {
    s = s || '';
    if (s.includes('Terkunci')) return { key: 'locked', label: 'Terkunci', chip: 'chip-bad', dot: 'var(--bad)' };
    if (s.includes('Peringatan')) { const n = (s.match(/(\d+)x/) || [])[1]; return { key: 'warned', label: `Peringatan ${n || ''}×`.trim(), chip: 'chip-gold', dot: 'var(--gold)' }; }
    if (s === 'Selesai') return { key: 'done', label: 'Selesai', chip: 'chip-ok', dot: 'var(--ok)' };
    return { key: 'work', label: 'Mengerjakan', chip: '', dot: 'var(--navy)' };
}
// "08:12:01 (12m 3s | 8/20 Soal)" → { jam, durasi, done, total }
function parseProgress(lastSeen) {
    const m = String(lastSeen || '').match(/^([^()]*)\(([^|)]*)\|?\s*(\d+)?\/?(\d+)?/);
    if (!m) return null;
    return { jam: m[1].trim(), durasi: (m[2] || '').trim(), done: m[3] ? +m[3] : null, total: m[4] ? +m[4] : null };
}

// ============================================================
// PROFIL SEKOLAH, BRANDING & KOP SURAT
// ============================================================
let SEKOLAH = { nama_sekolah: 'SMP Negeri 2 Soyo Jaya', singkatan: 'Spenda', kabupaten: 'Morowali Utara', provinsi: 'Sulawesi Tengah' };
const logoUrl = (jenis = 'sekolah') => {
    if (jenis === 'pemda') return SEKOLAH.has_logo_pemda ? `/api/public/logo?jenis=pemda&v=${SEKOLAH.updated_at || 0}` : '';
    return SEKOLAH.has_logo_sekolah ? `/api/public/logo?v=${SEKOLAH.updated_at || 0}` : '/logo-sekolah.png';
};
// Logo disimpan juga sebagai data URL agar dokumen cetak tidak perlu mengunduh ulang gambar
const LOGO_DATA = { sekolah: '', pemda: '' };
async function toDataUrl(url) {
    try { const b = await (await fetch(url)).blob(); if (!b.type.startsWith('image/')) return ''; return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(''); r.readAsDataURL(b); }); } catch (e) { return ''; }
}
async function loadSekolah() {
    try { const r = await fetch(API + '/public/sekolah', { cache: 'no-store' }); if (r.ok) SEKOLAH = await r.json(); } catch (e) {}
    applyBranding();
    LOGO_DATA.sekolah = await toDataUrl(logoUrl());
    LOGO_DATA.pemda = SEKOLAH.has_logo_pemda ? await toDataUrl(logoUrl('pemda')) : '';
    return SEKOLAH;
}
function applyBranding() {
    const s = SEKOLAH, wilayah = [s.kabupaten, s.provinsi].filter(Boolean).join(', ');
    document.title = `CBT ${s.singkatan || ''} — ${s.nama_sekolah}`.replace('CBT  —', 'CBT —');
    document.querySelectorAll('[data-sk="nama"]').forEach(el => { el.textContent = s.nama_sekolah; });
    document.querySelectorAll('[data-sk="wilayah"]').forEach(el => { el.textContent = wilayah; });
    document.querySelectorAll('[data-sk="aplikasi"]').forEach(el => { el.textContent = 'CBT ' + (s.singkatan || ''); });
    document.querySelectorAll('img[data-logo]').forEach(img => { img.src = logoUrl(); img.alt = 'Logo ' + s.nama_sekolah; img.onerror = () => { img.onerror = null; img.src = '/logo-sekolah.png'; }; });
}
window.addEventListener('DOMContentLoaded', () => { loadSekolah(); });

function tanggalIndo(d = new Date()) { return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }

// Kop surat resmi: [logo pemda] instansi + nama sekolah + alamat [logo sekolah], garis ganda
function kopSuratHtml(s = SEKOLAH, logos = null) {
    const abs = u => !u ? '' : (u.startsWith('data:') ? u : location.origin + u);
    const kontak = [s.telepon && 'Telp. ' + s.telepon, s.email && 'Email: ' + s.email, s.website && s.website].filter(Boolean).join(' · ');
    const alamat = [s.alamat, s.kecamatan && 'Kec. ' + s.kecamatan, s.kabupaten && 'Kab. ' + s.kabupaten, s.provinsi, s.kode_pos].filter(Boolean).join(', ');
    if (!logos) logos = { sekolah: LOGO_DATA.sekolah || logoUrl(), pemda: SEKOLAH.has_logo_pemda ? (LOGO_DATA.pemda || logoUrl('pemda')) : '' };
    const pemda = logos.pemda;
    return `<div class="kop"><div class="kop-logo">${pemda ? `<img src="${abs(pemda)}" alt="">` : ''}</div>
        <div class="kop-teks">${s.instansi_1 ? `<p class="k1">${esc(s.instansi_1)}</p>` : ''}${s.instansi_2 ? `<p class="k1">${esc(s.instansi_2)}</p>` : ''}
        <p class="k2">${esc(String(s.nama_sekolah || '').toUpperCase())}</p>
        ${s.npsn ? `<p class="k4">NPSN: ${esc(s.npsn)}</p>` : ''}
        ${alamat ? `<p class="k3">${esc(alamat)}</p>` : ''}${kontak ? `<p class="k3">${esc(kontak)}</p>` : ''}</div>
        <div class="kop-logo"><img src="${abs(logos.sekolah || '/logo-sekolah.png')}" alt=""></div></div>`;
}

// Blok tanda tangan: kanan = kepala sekolah; kiri opsional (mis. guru mapel/pengawas)
function ttdHtml({ kiri = null } = {}) {
    const s = SEKOLAH, tempat = s.tempat_ttd || s.kecamatan || s.kabupaten || '';
    const blok = (atas, jabatan, nama, nip) => `<div class="ttd"><p>${atas || '&nbsp;'}</p><p>${jabatan}</p><div class="ttd-ruang"></div><p class="ttd-nama">${nama ? esc(nama) : '.......................................'}</p><p>NIP. ${nip ? esc(nip) : '.......................................'}</p></div>`;
    return `<div class="ttd-wrap">${kiri ? blok('', esc(kiri.jabatan), kiri.nama, kiri.nip) : '<div></div>'}${blok(`${esc(tempat)}, ${tanggalIndo()}`, 'Kepala Sekolah', s.kepala_sekolah, s.nip_kepala)}</div>`;
}

// Buka jendela cetak dengan kop surat. body = HTML isi dokumen.
function cetakDokumen(judul, body, { landscape = false, kop = true } = {}) {
    const w = window.open('', '_blank');
    if (!w) { toast('Izinkan pop-up untuk mencetak', 'error'); return; }
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 14mm; }
        * { box-sizing: border-box; } body { font-family: "Times New Roman", Times, serif; color: #000; margin: 0; font-size: 12pt; }
        .kop { display: grid; grid-template-columns: 78px 1fr 78px; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 3px double #000; margin-bottom: 14px; }
        .kop-logo img { width: 74px; height: 74px; object-fit: contain; display: block; margin: 0 auto; }
        .kop-teks { text-align: center; line-height: 1.25; } .kop-teks p { margin: 0; }
        .k1 { font-size: 13pt; font-weight: bold; letter-spacing: .02em; } .k2 { font-size: 17pt; font-weight: bold; letter-spacing: .03em; margin: 2px 0 !important; }
        .k3 { font-size: 10pt; } .k4 { font-size: 10.5pt; font-weight: bold; }
        h1 { text-align: center; font-size: 13pt; margin: 4px 0 2px; text-decoration: underline; } .sub { text-align: center; margin: 0 0 12px; font-size: 11pt; }
        table.data { width: 100%; border-collapse: collapse; font-size: 10.5pt; } .data th, .data td { border: 1px solid #000; padding: 4px 6px; }
        .data th { background: #eee; } .c { text-align: center; } .r { text-align: right; }
        .meta td { padding: 1px 8px 1px 0; font-size: 11pt; }
        .ttd-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 26px; break-inside: avoid; }
        .ttd { text-align: left; padding-left: 20%; } .ttd p { margin: 0; } .ttd-ruang { height: 64px; } .ttd-nama { font-weight: bold; text-decoration: underline; }
        tr { break-inside: avoid; }
    </style></head><body>${kop ? kopSuratHtml() : ''}${body}
    <script>
        // cetak setelah semua gambar (logo) selesai dimuat, maksimal tunggu 4 detik
        Promise.race([Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 4000))])
            .then(() => setTimeout(() => window.print(), 250));
    <\/script></body></html>`);
    w.document.close();
}
