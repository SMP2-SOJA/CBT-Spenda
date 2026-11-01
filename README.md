# CBT Spenda v4 — SMP Negeri 2 Soyo Jaya

Aplikasi ujian berbasis komputer & smartphone (Express + Supabase, di-deploy ke Vercel).
Versi 4 adalah pengembangan dari "CBT-Ujian-Sekolah" dengan **database yang sama** — tidak ada data yang perlu dipindah.

---

## Yang baru

### Keamanan (penting)
| Masalah di versi lama | Perbaikan v4 |
|---|---|
| Kunci jawaban ikut terkirim ke HP siswa (bisa dilihat lewat *Inspect → Network*) | Kunci **tidak pernah** dikirim ke siswa. Penilaian dihitung di server (`lib/scoring.js`). |
| Nilai dihitung di browser → bisa dipalsukan | Siswa hanya mengirim jawaban; server yang menghitung nilai. |
| Semua `/api/admin/*` bisa dipanggil siapa saja tanpa login (termasuk hapus semua nilai) | Login menghasilkan token; endpoint admin/guru dicek perannya. |
| `/api/admin/darurat` mereset password admin ke `123` untuk siapa pun | Wajib `?key=RECOVERY_KEY` (environment variable). Nonaktif bila tidak di-set. |
| Respons login mengirim password | Password tidak lagi dikirim balik. |
| Tombol "Bersihkan semua soal/nilai/jadwal" langsung menghapus tanpa konfirmasi | Konfirmasi; untuk hapus massal wajib mengetik kata konfirmasi. |
| Siswa bisa mengambil soal paket lain | Soal hanya bisa diambil dengan *tiket ujian* dari PIN yang valid, khusus siswa itu. |

### Siswa
- Tampilan baru bertema lembar LJK (bulatan "diarsir" saat dipilih), nyaman di HP murah.
- Layar **konfirmasi data & tata tertib** sebelum mulai.
- Tombol **Ragu-ragu** + lembar jawaban berwarna (dijawab / ragu / belum).
- **Ringkasan sebelum kumpul**: jumlah dijawab/ragu/kosong, ketuk nomor untuk langsung membuka soal.
- **Acak urutan soal & pilihan jawaban** per siswa (diatur per jadwal).
- Ukuran huruf soal bisa diperbesar/diperkecil; navigasi keyboard (← →, A–E).
- Timer berubah warna di 5 menit & 1 menit terakhir.
- **Lanjutkan setelah refresh**: jawaban tetap tersimpan, PIN terisi otomatis.
- Offline saat mengumpulkan → jawaban disimpan di HP dan **terkirim otomatis** saat online.
- Halaman hasil (nilai) dan halaman "akun terkunci" yang jelas langkahnya.
- Klik di dalam Google Form tidak lagi dihitung sebagai pelanggaran; satu kali keluar layar = satu pelanggaran (dulu terhitung dua).

### Admin & guru
- **Pemantauan**: kartu PIN aktif (salin sekali klik), bilah progres per siswa, kelompok *Perlu tindakan / Mengerjakan / Selesai*, pencarian nama, "Izinkan ulang dari awal".
- **Jadwal & PIN**: buka/tutup ujian dengan sakelar, buat PIN baru, salin PIN, jumlah soal per jadwal.
- **Bank soal**: pratinjau paket seperti tampilan siswa (kunci ditandai), **ubah soal lengkap** (tipe, teks, pilihan, kunci, bobot, gambar), ganti kode paket, pencarian, tulis soal satu per satu, **template Excel** siap unduh, pratinjau **seluruh** soal hasil impor sebelum disimpan.
- **Hasil & analisis**: rata-rata/tertinggi/terendah/tuntas KKM, grafik sebaran nilai, urutkan kolom, **analisis butir soal** (tingkat kesukaran + sebaran pilihan jawaban PG untuk melihat pengecoh), unduh rekap `.xlsx`, detail jawaban `.xls` (dengan siswa TIDAK HADIR), cetak.
- **Peserta & guru**: filter peran/kelas, **cetak kartu peserta** (nama, kelas, username, password), impor Excel dengan template.
- **Akun saya**: ganti password.

### Papan skor langsung
- Bisa dibuka dari tombol di halaman login, dari tombol **Papan skor** di Pemantauan, atau langsung lewat alamat **`/skor`** (contoh: `/skor?paket=MTK-7&kelas=7A`, `&mode=kelas`).
- Tema gelap untuk proyektor/TV, **podium 3 besar**, peringkat bergeser beranimasi saat siswa naik/turun, skor yang naik berkilau emas.
- Mode **Antar kelas**: peringkat kelas berdasarkan rata-rata skor.
- Tombol **layar penuh (mode TV)**: kontrol disembunyikan, huruf diperbesar. Tombol salin tautan untuk dibagikan.
- Status pelanggaran (peringatan/terkunci) **tidak ditampilkan** ke publik — hanya "Mengerjakan" atau "Selesai".
- Otomatis memilih paket yang paling banyak pesertanya (ranking lintas paket tidak adil).
- Diatur lewat env `PUBLIC_SCORE`: `on` (bawaan), `final` (skor baru tampil setelah siswa selesai), `off` (papan skor dimatikan).

### Profil sekolah & kop surat (menu **Profil sekolah**, khusus admin)
- Ubah nama sekolah, NPSN, baris instansi kop, alamat, kontak, tahun pelajaran, nama & NIP kepala sekolah, tempat tanda tangan.
- Unggah **logo sekolah** dan **logo pemda** langsung dari aplikasi (otomatis dikecilkan ±15–60 KB). Pratinjau kop tampil langsung.
- Logo & nama sekolah otomatis berganti di halaman login, panel admin, halaman siswa, dan papan skor.
- Dokumen cetak berkop + tanda tangan kepala sekolah: **Rekap nilai** (Hasil & analisis → Cetak berkop), **Daftar hadir peserta** dan **Kartu peserta** (Peserta & guru).
- Butuh tabel `config` → jalankan `supabase-migration.sql` sekali.

### Teknis
- `package.json` diperbaiki (di arsip lama berukuran 0 byte).
- Tailwind dibangun sekali (17 KB), tidak lagi memakai Tailwind CDN yang mengompilasi CSS di HP siswa.
- Tampilan & server masing-masing jadi **satu file** (`index.html`, `server.js`), jadi deploy tidak bergantung pada subfolder.
- Logo dikecilkan 437 KB → 55 KB; ikon PWA 192/512.
- Service worker *network-first*: pembaruan langsung sampai ke siswa (versi lama *cache-first* dan tidak terdaftar).
- Jam aktivitas memakai zona WITA (dulu UTC di server Vercel).
- Tampilan "Rp30.000" tidak lagi berubah jadi pangkat; H2O/CO2 tidak dijadikan pangkat.
- Perbaikan `applyMathRendering` yang dulu dipanggil tapi tidak ada; rumus LaTeX `$...$` kini dirender KaTeX.

---

## Cara deploy (Vercel)

File yang **wajib** ada di halaman utama repositori GitHub (semuanya file, tanpa subfolder):

```
index.html      ← seluruh tampilan (CSS + JavaScript sudah digabung di dalamnya)
server.js       ← seluruh server + mesin penilaian
vercel.json
package.json
manifest.json
sw.js
logo-sekolah.png   icon-192.png   icon-512.png
```

Folder `src/`, `scripts/`, `dev/` dan file `tailwind.config.js` **tidak wajib** untuk deploy. Folder itu hanya dipakai kalau Anda ingin mengubah kode (lihat "Mengubah tampilan").

1. Di GitHub: **Add file → Upload files** → pilih file-file di atas → **Commit changes**. File lama dengan nama sama otomatis tertimpa. File `app.js` lama boleh dihapus.
2. Vercel akan deploy ulang otomatis. Setelah selesai, tekan **Ctrl + Shift + R** di laptop. Di HP: ikon gembok → *Setelan situs* → *Hapus & reset*.
3. **Environment Variables** (Vercel → Project → Settings → Environment Variables), semuanya opsional:

| Nama | Fungsi |
|---|---|
| `APP_SECRET` | Kunci rahasia token login (isi teks acak panjang). **Disarankan.** |
| `SUPABASE_URL`, `SUPABASE_KEY` | Jika ingin memindahkan kredensial Supabase dari kode ke env. Default = nilai lama. |
| `RECOVERY_KEY` | Mengaktifkan `/api/admin/darurat?key=...` untuk memulihkan akun admin. |
| `SHOW_SCORE` | Isi `0` jika nilai tidak boleh ditampilkan ke siswa setelah selesai. |
| `PUBLIC_SCORE` | Papan skor: `on` (bawaan), `final` (skor tampil setelah selesai), `off` (dimatikan). |

4. **Migrasi database** (sekali saja): Supabase → SQL Editor → tempel isi `supabase-migration.sql` → Run. Ini mengaktifkan fitur acak soal/opsi, kolom kelas pada nilai, dan tabel `config` untuk Profil sekolah.

> Setelah deploy, siswa/guru yang sedang login cukup login ulang sekali.

## Mengganti logo sekolah

**Cara 1 — dari aplikasi (disarankan):** login admin → **Profil sekolah** → *Pilih gambar* pada "Logo sekolah" → **Simpan**. Gunakan PNG persegi berlatar transparan (min. 300×300 px). Tombol *Pakai logo bawaan* mengembalikan ke file `logo-sekolah.png`.

**Cara 2 — ganti file (logo bawaan):** ganti file berikut dengan logo baru, nama file harus sama, lalu push ke GitHub:
| File | Ukuran | Dipakai untuk |
|---|---|---|
| `logo-sekolah.png` | 160×160 px | Logo bawaan di aplikasi & kop (jika belum unggah lewat aplikasi) |
| `icon-192.png` | 192×192 px | Ikon aplikasi saat dipasang di HP (PWA) |
| `icon-512.png` | 512×512 px | Ikon aplikasi ukuran besar (PWA) |

Lalu ubah nama di `manifest.json` (`name`, `short_name`) agar nama ikon di HP ikut berganti. Ikon PWA di HP siswa baru berubah setelah aplikasi dipasang ulang.

## Uji coba lokal tanpa Supabase

```bash
npm install
MOCK_DB=1 npm run dev     # Windows PowerShell: $env:MOCK_DB=1; npm run dev
```
Buka http://localhost:3000 — data contoh ada di `dev/seed.json`:
admin `admin`/`123` · guru `guru1`/`guru1` · siswa `7a03`…`7b16` / `1234` · PIN `4821`.

## Mengubah tampilan / kode

Kode sumber ada di folder `src/`. **Jangan edit `index.html` dan `server.js` di folder utama**, karena keduanya dibuat otomatis. Alurnya:

1. Edit file di `src/` (misal `src/css/app.css`, `src/js/siswa.js`, `src/server.js`).
2. Jalankan:
   ```bash
   npm install
   npm run build
   ```
3. Upload ulang `index.html` dan `server.js` hasil build ke GitHub.

Warna & komponen utama ada di `src/css/app.css` (variabel di bagian `:root`).

## Struktur
```
index.html, server.js   HASIL BUILD — ini yang di-deploy
src/index.html          Kerangka halaman
src/server.js           API (Express) — auth, ujian, admin, profil sekolah
src/lib/scoring.js      Mesin penilaian (server)
src/css/app.css         Desain & komponen
src/css/tailwind.css    Hasil build Tailwind
src/js/core.js          API, sesi, utilitas, branding & kop surat
src/js/siswa.js         PIN, konfirmasi, ruang ujian, anti-curang
src/js/skor.js          Papan skor langsung (/skor)
src/js/admin.js         Panel admin & guru
src/js/import.js        Impor soal Excel/Word
scripts/build.js        Penggabung src/ → index.html + server.js
dev/                    Database tiruan untuk uji lokal
supabase-migration.sql
```

## Catatan untuk ke depan
- Password masih disimpan sebagai teks biasa (agar data lama tetap bisa login & kartu peserta bisa dicetak). Pertimbangkan hashing bila kartu tidak lagi dibutuhkan.
- Kunci Supabase saat ini adalah *publishable key* di kode. Sebaiknya pindahkan ke env `SUPABASE_KEY` memakai **service_role key** dan aktifkan **Row Level Security** pada semua tabel, supaya database tidak bisa diakses langsung dengan kunci publik.
