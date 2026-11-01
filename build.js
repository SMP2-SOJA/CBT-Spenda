// ============================================================
// BUILD: menggabungkan sumber di src/ menjadi file siap-deploy
//   src/index.html + src/css/*.css + src/js/*.js  →  index.html
//   src/server.js  + src/lib/scoring.js            →  server.js
// Hasilnya cukup beberapa file di folder utama (tanpa subfolder),
// sehingga aman di-upload lewat GitHub web maupun Vercel.
// Jalankan: npm run build
// ============================================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const src = p => path.join(root, 'src', p);

// 1. Tailwind
execSync('npx tailwindcss -i src/css/tailwind.src.css -o src/css/tailwind.css --minify', { cwd: root, stdio: 'inherit' });

// 2. index.html dengan CSS & JS inline
let html = fs.readFileSync(src('index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="\/css\/([\w.-]+)">/g, (m, f) =>
    `<style>/* ${f} */\n${fs.readFileSync(src('css/' + f), 'utf8')}\n</style>`);
html = html.replace(/<script src="\/js\/([\w.-]+)"><\/script>/g, (m, f) => {
    const code = fs.readFileSync(src('js/' + f), 'utf8');
    if (/<\/script/i.test(code)) throw new Error(`${f} mengandung "</script" — tulis sebagai "<\\/script"`);
    return `<script>/* ${f} */\n${code}\n</script>`;
});
if (/href="\/css\/|src="\/js\//.test(html)) throw new Error('Masih ada referensi /css atau /js yang belum digabung');
const banner = '<!-- DIBANGUN OTOMATIS dari folder src/ — jangan edit file ini; edit src/ lalu jalankan: npm run build -->\n';
fs.writeFileSync(path.join(root, 'index.html'), html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner));

// 3. server.js dengan mesin penilaian inline
const scoring = fs.readFileSync(src('lib/scoring.js'), 'utf8').replace(/module\.exports\s*=\s*\{[^}]*\};?\s*$/, '');
let server = fs.readFileSync(src('server.js'), 'utf8');
const req = "const { scoreExam, sanitizeQuestion } = require('./lib/scoring');";
if (!server.includes(req)) throw new Error('Baris require scoring tidak ditemukan di src/server.js');
server = server.replace(req, '// ---- Mesin penilaian (digabung dari src/lib/scoring.js) ----\n' + scoring.replace(/^\/\/ =+[\s\S]*?=+\n/, ''));
fs.writeFileSync(path.join(root, 'server.js'), '// DIBANGUN OTOMATIS dari src/server.js + src/lib/scoring.js — edit di src/ lalu jalankan: npm run build\n' + server);

const kb = f => (fs.statSync(path.join(root, f)).size / 1024).toFixed(0) + ' KB';
console.log(`[build] index.html ${kb('index.html')} · server.js ${kb('server.js')}`);
