<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CBT Online - SMPN 2 SOYO JAYA</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <style> 
        body { font-family: 'Inter', sans-serif; } .hidden { display: none !important; } ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; } .drawer-transition { transition: transform 0.3s ease-in-out; } .gform-container { position: relative; width: 100%; height: 75vh; overflow: hidden; border-radius: 1rem; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06); } .gform-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        .anti-copas { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
    </style>
</head>
<body class="bg-slate-100 font-sans text-slate-800 selection:bg-blue-200 overflow-x-hidden" oncontextmenu="return false;">

    <div id="view-login" class="min-h-screen flex items-center justify-center p-4 bg-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
        <div class="w-full max-w-md bg-white p-6 md:p-8 rounded-3xl shadow-2xl relative z-10 border-t-8 border-blue-600">
            <div class="text-center mb-6"><img src="logo-sekolah.png" onerror="this.src='https://via.placeholder.com/150'" class="w-16 h-16 mx-auto mb-4 object-contain"><h2 class="text-xl md:text-2xl font-black text-slate-800 uppercase">CBT EXAM V.3</h2></div>
            <div class="space-y-4">
                <div><label class="text-xs font-bold text-slate-500">USERNAME</label><div class="relative mt-1"><span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"><i class="fa fa-user"></i></span><input type="text" id="login-user" class="w-full pl-11 p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div></div>
                <div><label class="text-xs font-bold text-slate-500">PASSWORD</label><div class="relative mt-1"><span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"><i class="fa fa-lock"></i></span><input type="password" id="login-pass" class="w-full pl-11 p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div></div>
                <button onclick="prosesLogin()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-blue-700">MASUK APLIKASI</button>
            </div>
            <p class="text-center text-[10px] md:text-xs text-slate-400 mt-6 font-medium tracking-wide">SMP Negeri 2 Soyo Jaya | @Copyright Rahmat Hidayat H.</p>
        </div>
    </div>

    <div id="view-siswa-token" class="hidden min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <div class="w-full max-w-sm bg-white p-6 md:p-8 rounded-3xl shadow-xl text-center border-t-8 border-emerald-500">
            <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fa fa-unlock-alt text-xl"></i></div>
            <h2 class="text-lg font-bold text-slate-800">Halo, <span id="nama-siswa-welcome" class="text-emerald-600 font-black">Siswa</span>!</h2>
            <p class="text-xs text-slate-500 mb-6">Masukkan PIN ujian dari pengawas</p>
            <input type="text" id="input-pin" class="w-full p-3 border-2 border-emerald-200 bg-emerald-50 rounded-xl text-center text-2xl font-black uppercase mb-6 tracking-widest outline-none">
            <button onclick="mulaiUjian()" class="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700">MULAI UJIAN</button>
            <button onclick="logout()" class="w-full mt-4 text-slate-400 text-xs hover:text-red-500"><i class="fa fa-sign-out-alt"></i> Keluar</button>
        </div>
    </div>

    <div id="view-siswa-ujian" class="hidden h-screen flex flex-col bg-slate-100 overflow-hidden relative anti-copas">
        <header class="bg-blue-800 text-white shadow-md flex justify-between items-center px-4 py-3 flex-shrink-0 z-20 relative">
            <div class="truncate"><h1 id="ujian-mapel-title" class="font-black text-sm md:text-lg tracking-wider uppercase">MAPEL</h1><p class="text-[10px] md:text-xs text-blue-200">Peserta: <span id="ujian-nama-siswa" class="font-bold text-white">Siswa</span></p></div>
            <div class="flex items-center space-x-2"><div class="bg-blue-900 rounded-lg px-2 py-1 text-center shadow-inner relative overflow-hidden"><div id="network-status" class="bg-emerald-500 text-white text-[8px] font-bold uppercase mb-1 rounded-sm text-center">ONLINE</div><div id="exam-countdown" class="font-mono font-black text-sm text-yellow-400">00:00:00</div></div><button onclick="toggleCbtNav()" class="md:hidden bg-blue-700 hover:bg-blue-600 text-white p-2 rounded-lg shadow"><i class="fa fa-th-large"></i></button></div>
        </header>
        <div class="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full relative">
            <div class="flex-1 bg-white md:rounded-xl md:my-4 md:ml-4 shadow-sm border flex flex-col overflow-hidden relative z-10">
                <div id="offline-pending-alert" class="hidden bg-orange-100 border-b border-orange-200 p-2 text-center flex justify-between items-center px-4"><p class="text-xs text-orange-800 font-bold"><i class="fa fa-wifi text-red-500"></i> Offline! Jawaban tertunda.</p><button onclick="checkPendingSubmit(true)" class="bg-orange-500 text-white text-[10px] px-3 py-1 rounded">Coba Kirim</button></div>
                <div class="flex justify-between items-center p-3 border-b bg-slate-50"><div class="font-bold text-blue-800 text-sm">Soal <span id="cbt-no-soal" class="text-xl font-black">1</span></div><span id="cbt-tipe-soal" class="bg-blue-100 text-blue-800 text-[10px] font-bold px-3 py-1 rounded-full">PG</span></div>
                <div class="flex-1 overflow-y-auto p-4 flex flex-col">
                    <div id="cbt-media-area" class="w-full mb-4 text-center"></div>
                    <div id="cbt-tanya" class="prose max-w-none text-base text-slate-800 mb-6 font-medium whitespace-pre-wrap"></div>
                    <div id="cbt-opsi-area" class="space-y-3 w-full mt-auto"></div>
                </div>
                <div class="bg-slate-50 border-t p-3 flex justify-between items-center"><button onclick="cbtPrev()" class="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-xs"><i class="fa fa-arrow-left"></i> KEMBALI</button><label class="flex items-center bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg font-bold text-xs"><input type="checkbox" id="cbt-ragu" onchange="cbtToggleRagu()" class="w-4 h-4 mr-1 accent-yellow-600"> RAGU</label><button onclick="cbtNext()" class="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-xs">LANJUT <i class="fa fa-arrow-right"></i></button></div>
            </div>
            <div id="cbt-nav-overlay" onclick="toggleCbtNav()" class="fixed inset-0 bg-slate-900/50 z-30 hidden md:hidden"></div>
            <div id="cbt-nav-panel" class="fixed inset-y-0 right-0 w-64 bg-white shadow-2xl transform translate-x-full md:translate-x-0 md:relative md:flex flex-col h-full z-40 md:my-4 md:mr-4 md:rounded-xl md:border drawer-transition"><div class="p-4 border-b bg-slate-50 flex justify-between items-center"><h3 class="font-bold text-slate-700 text-sm"><i class="fa fa-th mr-2 text-blue-500"></i> Navigasi</h3><button onclick="toggleCbtNav()" class="md:hidden text-slate-400 hover:text-red-500"><i class="fa fa-times text-lg"></i></button></div><div class="flex-1 overflow-y-auto p-4"><div id="cbt-grid" class="grid grid-cols-4 gap-2"></div></div><div class="p-4 border-t bg-slate-50"><button id="btn-submit-ujian" onclick="submitUjian(true)" class="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-sm shadow-md">SELESAI UJIAN</button></div></div>
        </div>
    </div>

    <div id="view-admin" class="hidden h-screen flex overflow-hidden relative">
        <div id="admin-overlay" onclick="toggleAdminSidebar()" class="fixed inset-0 bg-slate-900/50 z-30 hidden md:hidden"></div>
        <aside id="admin-sidebar" class="fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transform -translate-x-full md:translate-x-0 md:relative z-40 drawer-transition h-full"><div class="p-6 text-center border-b border-slate-800"><h2 id="app-name-display" class="text-white font-bold text-xs tracking-widest uppercase">CBT ADMIN</h2></div><nav class="p-4 space-y-1 flex-1 overflow-y-auto text-sm"><button onclick="showPage('dashboard')" class="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 hover:text-white transition"><i class="fa fa-home w-6"></i> Dashboard</button><button onclick="showPage('jadwal')" class="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 hover:text-white transition"><i class="fa fa-calendar-alt w-6"></i> Jadwal Ujian</button><button onclick="showPage('banksoal')" class="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 hover:text-white transition"><i class="fa fa-database w-6"></i> Bank Soal</button><button onclick="showPage('nilai')" class="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 hover:text-white transition"><i class="fa fa-chart-bar w-6"></i> Hasil Nilai</button><button id="menu-users" onclick="showPage('users')" class="w-full flex items-center p-3 rounded-lg hover:bg-blue-600 hover:text-white transition"><i class="fa fa-users w-6"></i> Manajemen Siswa</button></nav><div class="p-4 border-t border-slate-800"><button onclick="logout()" class="w-full flex justify-center p-3 rounded-lg bg-red-600/10 text-red-500 font-bold text-sm">Keluar</button></div></aside>
        <main class="flex-1 flex flex-col overflow-hidden relative w-full">
            <header class="h-16 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 flex-shrink-0"><div class="flex items-center"><button onclick="toggleAdminSidebar()" class="md:hidden mr-3 text-slate-600 p-2"><i class="fa fa-bars text-xl"></i></button><h3 id="page-title" class="font-bold text-slate-700 uppercase tracking-widest text-xs">Dashboard</h3><span id="role-badge" class="ml-3 bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold uppercase hidden">Guru</span></div></header>
            <div class="flex-1 overflow-y-auto p-4 md:p-8" id="content">
                <div id="page-dashboard" class="page-content space-y-4"><div class="grid grid-cols-2 md:grid-cols-4 gap-3"><div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500"><p class="text-[8px] font-bold text-slate-400">TOTAL SISWA</p><h1 id="stat-siswa" class="text-xl font-black text-slate-700">0</h1></div><div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500"><p class="text-[8px] font-bold text-slate-400">MENGERJAKAN</p><h1 id="stat-kerja" class="text-xl font-black text-orange-500">0</h1></div><div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-emerald-500"><p class="text-[8px] font-bold text-slate-400">SELESAI</p><h1 id="stat-selesai" class="text-xl font-black text-emerald-500">0</h1></div><div class="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500"><p class="text-[8px] font-bold text-slate-400">CURANG</p><h1 id="stat-curang" class="text-xl font-black text-red-500">0</h1></div></div>
                
                <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                    <div class="bg-slate-50 p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <h3 class="font-bold text-slate-700 text-sm flex items-center">
                            <i class="fa fa-desktop mr-2 text-blue-500"></i> Live Monitoring 
                            <span class="ml-2 flex h-3 w-3 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                        </h3>
                        <div class="flex flex-wrap gap-2 w-full md:w-auto">
                            <select id="filter-mapel" class="p-2 border rounded-lg text-xs font-bold text-blue-800 bg-white outline-none flex-1 md:flex-none" onchange="renderActivityTable()"><option value="">Semua Mapel</option></select>
                            <select id="filter-kelas" class="p-2 border rounded-lg text-xs font-bold text-blue-800 bg-white outline-none flex-1 md:flex-none" onchange="renderActivityTable()"><option value="">Semua Kelas</option></select>
                        </div>
                    </div>
                    <div class="overflow-x-auto"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-slate-100 text-[9px] text-slate-500 uppercase"><tr><th class="p-3">Nama Siswa</th><th>Ujian</th><th>Status (Aksi)</th><th>Skor</th><th>Jam Update</th></tr></thead><tbody id="monitor-table" class="divide-y bg-white"></tbody></table></div>
                </div>
                </div>
                
                <div id="page-jadwal" class="page-content hidden space-y-4">
                    <div class="flex justify-between items-center mb-2"><h3 class="font-bold text-slate-700 text-sm">Daftar Jadwal Ujian</h3><button onclick="clearSchedules()" class="text-xs bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-200"><i class="fa fa-trash"></i> Bersihkan Semua Jadwal</button></div>
                    <div class="bg-white p-4 rounded-xl shadow-sm border"><div class="grid grid-cols-1 md:grid-cols-4 gap-3"><select id="j_mapel" class="p-3 border rounded-lg text-sm"></select><input type="date" id="j_tgl" class="p-3 border rounded-lg text-sm"><input type="number" id="j_durasi" placeholder="Durasi (Menit)" class="p-3 border rounded-lg text-sm"><button onclick="saveJadwal()" class="bg-blue-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-blue-700">BUAT JADWAL</button></div></div><div id="list-jadwal" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
                </div>
                
                <div id="page-banksoal" class="page-content hidden space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm relative">
                            <span class="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg">PALING DISARANKAN</span>
                            <h3 class="font-bold text-emerald-800 text-xs mb-3">Import Template Excel</h3>
                            <input type="text" id="ex_judul" placeholder="Kode Ujian" class="w-full p-2 mb-2 border rounded bg-white text-xs">
                            <input type="file" id="ex_file" accept=".xlsx, .xls" class="w-full p-2 mb-2 border rounded bg-white text-[10px]">
                            <button onclick="importExcelSoal()" class="w-full bg-emerald-600 text-white font-bold py-2 rounded text-xs shadow hover:bg-emerald-700">GENERATE DARI EXCEL</button>
                        </div>
                        <div class="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                            <h3 class="font-bold text-blue-800 text-xs mb-3">Import File Word (.docx)</h3>
                            <input type="text" id="w_judul" placeholder="Kode Ujian" class="w-full p-2 mb-2 border rounded bg-white text-xs font-bold">
                            <input type="file" id="w_file" accept=".docx" class="w-full p-2 mb-2 border rounded bg-white text-[10px]">
                            <button onclick="importWord()" class="w-full bg-blue-600 text-white font-bold py-2 rounded text-xs shadow hover:bg-blue-700">EKSTRAK SOAL WORD</button>
                        </div>
                    </div>
                    
                    <div class="bg-white p-4 md:p-8 rounded-xl shadow-sm border mt-4">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-3 mb-4 gap-2">
                            <h3 class="font-bold text-slate-700 text-sm md:text-base">Input Soal Manual Beruntun</h3>
                            <div class="w-full md:w-1/3"><input type="text" id="s_judul_bulk" placeholder="KODE UJIAN (Cth: MTK-UAS)" class="w-full p-2 border-2 border-blue-200 bg-blue-50 rounded-lg outline-none text-sm font-bold focus:border-blue-500"></div>
                        </div>

                        <div id="bulk-questions-container" class="space-y-6">
                            <div class="question-item bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 relative" data-no="1">
                                <div class="absolute -left-3 -top-3 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-black shadow-lg">1</div>
                                <div class="grid grid-cols-1 gap-3">
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div><label class="text-[10px] font-bold text-slate-500">TIPE SOAL</label><select class="q-tipe w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500"><option value="PG">1 - Pilihan Ganda Biasa</option><option value="PGK">2 - PG Kompleks (Kotak Centang)</option><option value="JODOH">3 - Menjodohkan (Dropdown)</option><option value="ISIAN">4 - Isian Singkat</option><option value="ESAI">5 - Uraian (Esai)</option><option value="BS" class="font-bold text-emerald-600">7 - Benar/Salah (Tabel)</option><option value="GFORM" class="font-bold text-purple-600">8 - Link G-Form</option></select></div>
                                        <div><label class="text-[10px] font-bold text-slate-500">KUNCI JAWABAN</label><input type="text" class="q-kunci w-full p-2 border rounded-lg text-xs" placeholder="Misal: A, atau A,C, atau 1B,2C"></div>
                                        <div><label class="text-[10px] font-bold text-blue-600">SKOR BOBOT</label><input type="number" class="q-skor w-full p-2 border border-blue-300 bg-blue-50 rounded-lg text-xs font-bold" value="1"></div>
                                    </div>
                                    <div><label class="text-[10px] font-bold text-blue-500"><i class="fa fa-image"></i> LINK GAMBAR DRIVE</label><input type="text" class="q-image w-full p-2 border rounded-lg text-xs" placeholder="http://..."></div>
                                    <div><label class="text-[10px] font-bold text-slate-500">PERTANYAAN (Awali dgn angka misal "1. Teks" lalu enter untuk B-S/Jodoh)</label><textarea class="q-tanya w-full p-2 border rounded-lg text-sm h-16"></textarea></div>
                                    <div class="q-area-opsi"><label class="text-[10px] font-bold text-orange-600">OPSI / PILIHAN JAWABAN (Gunakan ||| sebagai pemisah)</label><input type="text" class="q-opsi w-full p-2 border border-orange-200 rounded-lg text-xs" placeholder="Pilihan A ||| Pilihan B"></div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 flex flex-col md:flex-row gap-3">
                            <button onclick="tambahBarisSoal()" class="flex-1 bg-blue-50 text-blue-600 border-2 border-dashed border-blue-200 py-3 rounded-xl font-bold hover:bg-blue-100 transition"><i class="fa fa-plus-circle mr-2"></i> TAMBAH NOMOR BERIKUTNYA</button>
                            <button onclick="simpanSoalBulk()" class="flex-1 bg-slate-800 text-white py-3 rounded-xl font-black shadow-xl hover:bg-slate-900 transition"><i class="fa fa-save mr-2"></i> SIMPAN SEMUA SOAL</button>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center mb-2 mt-8"><h3 class="font-bold text-slate-700 text-sm">Daftar Soal Tersimpan</h3><button onclick="clearQuestions()" class="text-xs bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-200"><i class="fa fa-trash"></i> Bersihkan Semua Soal</button></div>
                    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto"><table class="w-full text-left text-xs whitespace-nowrap"><thead class="bg-slate-50 text-[9px] text-slate-400 uppercase"><tr><th class="p-3">Kode</th><th>Tipe</th><th>Detail Pertanyaan, Kunci & Skor</th><th>Aksi</th></tr></thead><tbody id="banksoal-table" class="divide-y"></tbody></table></div>
                </div>

                <div id="page-nilai" class="page-content hidden space-y-4">
                    <div class="flex justify-between items-center mb-2">
                        <button onclick="exportExcelDetail()" class="text-xs bg-emerald-600 text-white px-4 py-3 rounded-lg font-bold shadow-lg hover:bg-emerald-700 transition"><i class="fa fa-file-excel mr-1"></i> Download Excel Lengkap</button>
                        <button onclick="clearResults()" class="text-xs bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-200"><i class="fa fa-trash"></i> Bersihkan Semua Nilai</button>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm overflow-x-auto"><table class="w-full text-left text-xs whitespace-nowrap" id="nilai-table"><thead class="bg-slate-50 text-[9px] text-slate-400 uppercase"><tr><th class="p-3">Nama Siswa</th><th>Mapel</th><th>Benar</th><th>Salah</th><th>Nilai (100)</th><th>Aksi</th></tr></thead><tbody id="nilai-body" class="divide-y"></tbody></table></div>
                </div>
                <div id="page-users" class="page-content hidden space-y-4">
                    <div class="flex justify-between items-center mb-2">
                        <label class="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] cursor-pointer shadow hover:bg-blue-700 transition"><i class="fa fa-upload mr-1"></i> Import Data Dari Excel<input type="file" class="hidden" onchange="importUsers(this)"></label>
                        <button onclick="clearUsers()" class="text-xs bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-200 transition"><i class="fa fa-trash"></i> Bersihkan Semua Pengguna</button>
                    </div>
                    <div class="bg-white rounded-xl shadow-sm border overflow-x-auto"><table class="w-full text-left text-xs"><thead class="bg-slate-50 text-[9px] text-slate-400 uppercase"><tr><th class="p-3">Nama</th><th>Username</th><th>Kelas/Mapel</th><th>Role</th></tr></thead><tbody id="user-body" class="divide-y"></tbody></table></div>
                </div>
            </div>
        </main>
    </div>

    <div id="modal-detail" class="hidden fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
            <div class="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-2xl"><h3 class="font-bold text-blue-800">Detail Analisis Butir Soal</h3><button onclick="document.getElementById('modal-detail').classList.add('hidden')" class="text-slate-400 hover:text-red-500"><i class="fa fa-times text-xl"></i></button></div>
            <div class="p-4 flex-1 overflow-y-auto bg-slate-100"><div id="detail-content" class="space-y-3"></div></div>
        </div>
    </div>

    <script>
        const API = "/api";
        let activeUser = null; let currentExam = null; let examTimerInterval = null;
        let cbtQuestions = []; let cbtAnswers = []; let cbtCurrentIndex = 0; let curangCount = 0;
        let isExamActive = false; let allActivityData = [];
        window.allResultsData = []; 

        function getAuthParams() { return !activeUser ? "" : `?role=${activeUser.role}&mapel=${activeUser.mapel || ''}`; }
        function toggleAdminSidebar() { document.getElementById('admin-sidebar').classList.toggle('-translate-x-full'); document.getElementById('admin-overlay').classList.toggle('hidden'); }
        function toggleCbtNav() { document.getElementById('cbt-nav-panel').classList.toggle('translate-x-full'); document.getElementById('cbt-nav-overlay').classList.toggle('hidden'); }

        document.addEventListener('keydown', function(e) { if(isExamActive && (e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); } });

        function deteksiKecurangan() {
            if (!isExamActive || !navigator.onLine) return;
            curangCount++; 
            fetch(API + '/siswa/flag-curang', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: activeUser.name, mapel: currentExam.mapel, count: curangCount}) });
            
            if (curangCount >= 3) { 
                isExamActive = false;
                Swal.fire({title: 'UJIAN DIBATALKAN!', text: 'Anda terdeteksi keluar dari layar ujian lebih dari 3 kali. Ujian otomatis dikunci!', icon: 'error', allowOutsideClick: false}).then(() => { submitUjian(false, true); }); 
            } else { 
                Swal.fire('PERINGATAN KECURANGAN!', `Sistem mendeteksi Anda meminimalkan layar/membuka tab lain! DILARANG KERAS KELUAR DARI HALAMAN UJIAN! (Peringatan ${curangCount}/3)`, 'warning'); 
            }
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
                    else { document.getElementById('view-admin').classList.remove('hidden'); if (activeUser.role.toLowerCase() === 'guru') { document.getElementById('menu-users').classList.add('hidden'); document.getElementById('role-badge').classList.remove('hidden'); document.getElementById('role-badge').innerText = `GURU: ${activeUser.mapel}`; } loadMaster(); showPage('dashboard'); }
                } else Swal.fire('Gagal', data.message, 'error');
            } catch (e) { Swal.fire('Error', 'Server mati.', 'error'); }
        }
        function logout() { location.reload(); }
        function saveToLocal() { if(currentExam && activeUser) localStorage.setItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`, JSON.stringify(cbtAnswers)); }
        function loadFromLocal() { if(currentExam && activeUser) { const saved = localStorage.getItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); if(saved) cbtAnswers = JSON.parse(saved); } }

        async function mulaiUjian() {
            const pin = document.getElementById('input-pin').value; if(!pin) return Swal.fire('Error', 'PIN!', 'warning'); Swal.fire({ title: 'Menyiapkan...', didOpen: () => Swal.showLoading() });
            try {
                const res = await fetch(API + '/siswa/cek-pin', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pin: pin, student_name: activeUser.name}) }); const data = await res.json();
                if(data.status === "success") {
                    currentExam = data.exam; const resSoal = await fetch(API + '/siswa/get-soal', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({exam_id: currentExam.mapel}) }); const dataSoal = await resSoal.json();
                    if(!dataSoal.questions || dataSoal.questions.length === 0) return Swal.fire('Oops', 'Kosong!', 'error');
                    document.getElementById('view-siswa-token').classList.add('hidden'); document.getElementById('view-siswa-ujian').classList.remove('hidden');
                    document.getElementById('ujian-mapel-title').innerText = currentExam.mapel; document.getElementById('ujian-nama-siswa').innerText = activeUser.name;
                    
                    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
                    
                    cbtQuestions = dataSoal.questions; cbtAnswers = new Array(cbtQuestions.length).fill(null).map(() => ({ ans: '', ragu: false })); cbtCurrentIndex = 0;
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

        function renderCbtGrid() {
            let html = "";
            for(let i = 0; i < cbtQuestions.length; i++) {
                let statusClass = "bg-white text-slate-600 border-slate-300"; 
                let isAnswered = false;
                if (cbtAnswers[i].ans !== "") {
                    if (cbtQuestions[i].tipe === 'BS') { isAnswered = cbtAnswers[i].ans.indexOf('-') === -1; } 
                    else if(cbtQuestions[i].tipe === 'JODOH') { let h = (cbtQuestions[i].kunci||"").split(',').length; isAnswered = cbtAnswers[i].ans.split(',').length >= h; }
                    else { isAnswered = true; }
                }
                if(cbtAnswers[i].ragu) statusClass = "bg-yellow-400 text-yellow-900 border-yellow-500 shadow-inner"; 
                else if(isAnswered) statusClass = "bg-blue-600 text-white border-blue-700 shadow-md"; 
                let activeRing = (i === cbtCurrentIndex) ? "ring-4 ring-blue-300 scale-105" : "";
                html += `<button onclick="showCbtQuestion(${i}); if(window.innerWidth < 768) toggleCbtNav();" class="w-full aspect-square flex items-center justify-center rounded-lg font-black text-sm md:text-lg border-2 transition transform active:scale-95 ${statusClass} ${activeRing}">${i+1}</button>`;
            }
            document.getElementById('cbt-grid').innerHTML = html;
        }

        function showCbtQuestion(index) {
            cbtCurrentIndex = index; const q = cbtQuestions[index]; const savedAns = cbtAnswers[index].ans || "";
            document.getElementById('cbt-no-soal').innerText = index + 1; document.getElementById('cbt-tipe-soal').innerText = q.tipe; document.getElementById('cbt-ragu').checked = cbtAnswers[index].ragu;
            const divMedia = document.getElementById('cbt-media-area'); const divTanya = document.getElementById('cbt-tanya'); const divOpsi = document.getElementById('cbt-opsi-area');
            divMedia.innerHTML = ""; divTanya.innerHTML = ""; divOpsi.innerHTML = "";

            let imgUrl = q.gform_url;
            if(imgUrl && imgUrl.includes('drive.google.com')) {
                let idMatch = imgUrl.match(/id=([^&]+)/) || imgUrl.match(/\/d\/([^\/]+)/);
                if(idMatch && idMatch[1]) { imgUrl = `https://lh3.googleusercontent.com/d/${idMatch[1]}`; }
            }
            if (imgUrl && q.tipe !== 'GFORM' && imgUrl.startsWith('http')) { divMedia.innerHTML = `<img src="${imgUrl}" class="max-w-full md:max-w-xl h-auto rounded-xl border shadow-sm mx-auto mb-4 object-contain">`; }

            if(q.tipe === 'GFORM') {
                divOpsi.innerHTML = `<div class="gform-container"><iframe src="${q.tanya || q.gform_url}"></iframe></div>`; cbtSaveAnswer("COMPLETED"); 
            } else {
                let htmlOpsi = ""; let opsiArray = q.opsi_json ? q.opsi_json.split(/\|\|\|/).map(o=>o.trim()).filter(o=>o) : []; const abjad = ['A', 'B', 'C', 'D', 'E'];
                
                if (q.tipe === 'JODOH') {
                    let lines = (q.tanya||"").split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(l => l); let premises = []; let mainTanya = [];
                    lines.forEach(l => { if (/^\d+[\.\)]\s?/.test(l)) { premises.push(l); } else { mainTanya.push(l); } });
                    divTanya.innerHTML = mainTanya.join('<br>'); 
                    
                    let totalPairs = q.kunci ? q.kunci.split(',').length : (premises.length || 4); let savedArr = savedAns ? savedAns.split(',') : [];

                    htmlOpsi += `<div class="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-2 mb-4"><p class="text-xs font-bold text-blue-800 mb-3"><i class="fa fa-mouse-pointer"></i> PILIH PASANGAN JAWABAN YANG TEPAT:</p><div class="space-y-3">`;
                    for(let i=0; i<totalPairs; i++) {
                        let currentSaved = savedArr[i] ? savedArr[i].replace(/[0-9]/g, '') : ''; let labelText = premises[i] ? premises[i] : `Pertanyaan/Pasangan Nomor ${i+1}`;
                        htmlOpsi += `<div class="flex flex-col md:flex-row items-start md:items-center justify-between p-3 bg-white border border-blue-100 rounded-lg shadow-sm gap-2"><span class="font-bold text-slate-700 text-sm md:w-1/2 leading-snug">${labelText}</span><select class="jodoh-select p-3 border-2 border-emerald-300 rounded-lg text-sm font-bold text-emerald-800 bg-emerald-50 outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-1/2 cursor-pointer" onchange="cbtSaveJodoh(${totalPairs})"><option value="">- Silakan Pilih Jawaban -</option>`;
                        opsiArray.forEach((val, idx) => { let huruf = abjad[idx]; let isSel = (currentSaved === huruf) ? "selected" : ""; htmlOpsi += `<option value="${huruf}" ${isSel}>${val}</option>`; });
                        htmlOpsi += `</select></div>`;
                    }
                    htmlOpsi += `</div></div>`;
                }
                else {
                    divTanya.innerHTML = q.tanya || "";
                    if (q.tipe === 'PG') { 
                        htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = (savedAns === huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-blue-300"><input type="radio" name="cbt_ans" value="${huruf}" ${isChecked} onchange="cbtSaveAnswer(this.value)" class="w-5 h-5 text-blue-600 mr-3 accent-blue-600"><span class="font-black text-sm mr-3 bg-slate-100 border border-slate-200 w-7 h-7 flex items-center justify-center rounded-full text-slate-600 shadow-sm">${huruf}</span><span class="text-sm font-medium text-slate-700">${val}</span></label>`; }); htmlOpsi += `</div>`; 
                    }
                    else if (q.tipe === 'PGK') {
                        let savedArr = savedAns ? savedAns.split(',') : []; htmlOpsi += `<div class="space-y-2 md:space-y-3">`; opsiArray.forEach((val, idx) => { let huruf = abjad[idx] || ''; let isChecked = savedArr.includes(huruf) ? "checked" : ""; htmlOpsi += `<label class="flex items-center p-3 border-2 rounded-xl cursor-pointer bg-white transition hover:border-purple-300"><input type="checkbox" value="${huruf}" ${isChecked} onchange="cbtSaveCheckbox()" class="cbt-pgk-cb w-6 h-6 text-purple-600 mr-4 rounded accent-purple-600 shadow-sm"><span class="text-sm font-medium text-slate-700">${val}</span></label>`; }); htmlOpsi += `</div>`;
                    }
                    else if (q.tipe === 'BS') {
                        let savedArr = savedAns ? savedAns.split(',') : []; htmlOpsi += `<div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm"><table class="w-full text-sm text-left"><thead class="bg-slate-100 text-slate-600"><tr><th class="p-4 border-b">Pernyataan</th><th class="p-4 border-b text-center w-24">Benar</th><th class="p-4 border-b text-center w-24">Salah</th></tr></thead><tbody class="divide-y divide-slate-100 bg-white">`;
                        opsiArray.forEach((val, idx) => { let isB = savedArr[idx] === 'B' ? 'checked' : ''; let isS = savedArr[idx] === 'S' ? 'checked' : ''; htmlOpsi += `<tr class="hover:bg-slate-50 transition"><td class="p-4 text-slate-700 font-medium">${val}</td><td class="p-4 text-center bg-emerald-50/30 border-l"><input type="radio" name="bs_${idx}" value="B" ${isB} onchange="cbtSaveBS(${opsiArray.length})" class="w-6 h-6 accent-emerald-600 cursor-pointer"></td><td class="p-4 text-center bg-red-50/30 border-l"><input type="radio" name="bs_${idx}" value="S" ${isS} onchange="cbtSaveBS(${opsiArray.length})" class="w-6 h-6 accent-red-600 cursor-pointer"></td></tr>`; }); htmlOpsi += `</tbody></table></div>`;
                    }
                    else if (q.tipe === 'ISIAN') { htmlOpsi += `<input type="text" onkeyup="cbtSaveAnswer(this.value)" value="${savedAns}" class="w-full p-4 border-2 rounded-xl text-sm font-bold bg-white focus:border-blue-500 outline-none" placeholder="Ketik jawaban Anda di sini...">`; }
                    else if (q.tipe === 'ESAI') { htmlOpsi += `<textarea onkeyup="cbtSaveAnswer(this.value)" class="w-full p-4 border-2 rounded-xl h-32 text-sm bg-white focus:border-blue-500 outline-none" placeholder="Uraikan jawaban Anda di sini...">${savedAns}</textarea>`; }
                }
                divOpsi.innerHTML = htmlOpsi; 
            }
            renderCbtGrid();
        }

        function cbtSaveCheckbox() { let checked = []; document.querySelectorAll('.cbt-pgk-cb:checked').forEach(cb => checked.push(cb.value)); cbtSaveAnswer(checked.join(',')); }
        function cbtSaveBS(length) { let arr = []; for(let i=0; i<length; i++) { let selected = document.querySelector(`input[name="bs_${i}"]:checked`); arr.push(selected ? selected.value : '-'); } cbtSaveAnswer(arr.join(',')); }
        function cbtSaveJodoh(totalPairs) { let arr = []; let selects = document.querySelectorAll('.jodoh-select'); selects.forEach((sel, idx) => { if(sel.value) arr.push(`${idx+1}${sel.value}`); }); cbtSaveAnswer(arr.join(',')); }
        function cbtSaveAnswer(val) { cbtAnswers[cbtCurrentIndex].ans = val; saveToLocal(); renderCbtGrid(); }
        function cbtToggleRagu() { cbtAnswers[cbtCurrentIndex].ragu = document.getElementById('cbt-ragu').checked; saveToLocal(); renderCbtGrid(); }
        function cbtNext() { if(cbtCurrentIndex < cbtQuestions.length - 1) showCbtQuestion(cbtCurrentIndex + 1); }
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
                        Swal.fire('Berhasil!', 'Jawaban terkirim.', 'success').then(() => location.reload());
                    } catch(e) { if(showFeedback) Swal.fire('Gagal', 'Sinyal belum stabil.', 'error'); }
                } else { if(showFeedback) Swal.fire('Offline', 'Cari sinyal lalu coba lagi.', 'warning'); }
            }
        }

        // UPDATE MESIN PENILAI (SKOR PARSIAL & KEYWORD MATCHING)
        async function submitUjian(showConfirm = true, isForceCurang = false) {
            let benar = 0; let salah = 0; let detail = []; let isGformOnly = cbtQuestions.length > 0 && cbtQuestions[0].tipe === 'GFORM'; let nilaiAkhir = 0; let totalSkorMaksimal = 0; let totalSkorDiperoleh = 0;

            if(!isGformOnly) {
                cbtQuestions.forEach((q, index) => {
                    let ans = cbtAnswers[index].ans; let status = 'Salah'; let bobot = q.skor ? parseFloat(q.skor) : 1; let poin = 0;
                    
                    if (q.tipe === 'PG') {
                        totalSkorMaksimal += bobot; let kunciBersih = (q.kunci || "").replace(/\s/g, '').toLowerCase(); let ansBersih = (ans || "").replace(/\s/g, '').toLowerCase();
                        if(ansBersih && ansBersih === kunciBersih) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } else { salah++; }
                    } 
                    else if (q.tipe === 'PGK') {
                        totalSkorMaksimal += bobot; 
                        let kunciArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x); 
                        let ansArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x);
                        if(kunciArr.length > 0) {
                            let betul = 0;
                            ansArr.forEach(a => { if(kunciArr.includes(a)) betul++; });
                            if(betul === kunciArr.length && ansArr.length === kunciArr.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; }
                            else if(betul > 0) { status = `Sebagian Benar (${betul}/${kunciArr.length})`; poin = (betul / kunciArr.length) * bobot; totalSkorDiperoleh += poin; benar++; }
                            else { salah++; }
                        } else { salah++; }
                    } 
                    else if (q.tipe === 'BS') {
                        totalSkorMaksimal += bobot;
                        let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x);
                        let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',');
                        let correctCount = 0; let totalItems = kArr.length;
                        for(let j=0; j<totalItems; j++) { if(aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== "") { correctCount++; } }
                        
                        if(correctCount === totalItems && totalItems > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } 
                        else if (correctCount > 0) { status = `Sebagian Benar (${correctCount}/${totalItems})`; poin = (correctCount / totalItems) * bobot; totalSkorDiperoleh += poin; benar++; } 
                        else { salah++; }
                    }
                    else if (q.tipe === 'JODOH') {
                        totalSkorMaksimal += bobot;
                        let kArr = (q.kunci||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x);
                        let aArr = (ans||"").replace(/\s/g, '').toLowerCase().split(',').filter(x=>x);
                        let correctCount = 0; let totalItems = kArr.length;
                        kArr.forEach(k => { if(aArr.includes(k)) correctCount++; });
                        
                        if(correctCount === totalItems && totalItems > 0) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; } 
                        else if (correctCount > 0) { status = `Sebagian Benar (${correctCount}/${totalItems})`; poin = (correctCount / totalItems) * bobot; totalSkorDiperoleh += poin; benar++; } 
                        else { salah++; }
                    }
                    else if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') {
                        let kWords = (q.kunci || "").toLowerCase().match(/[a-z0-9]+/gi) || [];
                        let aWords = (ans || "").toLowerCase().match(/[a-z0-9]+/gi) || [];
                        
                        if (kWords.length > 0) {
                            totalSkorMaksimal += bobot; 
                            let matchWords = 0; let aWordsUnique = [...new Set(aWords)];
                            kWords.forEach(kw => { if(aWordsUnique.includes(kw)) matchWords++; });
                            
                            if(matchWords === kWords.length) { status = 'Benar'; poin = bobot; totalSkorDiperoleh += bobot; benar++; }
                            else if(matchWords > 0) { status = `Sebagian Benar (${matchWords}/${kWords.length} kata)`; poin = (matchWords / kWords.length) * bobot; totalSkorDiperoleh += poin; benar++; }
                            else { salah++; }
                        } else { status = 'Menunggu Koreksi Guru'; poin = 0; }
                    }
                    
                    poin = Math.round(poin * 100) / 100;
                    detail.push({ no: index+1, tanya: q.tanya, jawab: ans.replace(/\|\|\|/g, ', '), kunci: q.kunci, status: status, poin: poin });
                });
                nilaiAkhir = totalSkorMaksimal > 0 ? Math.round((totalSkorDiperoleh / totalSkorMaksimal) * 100) : 0;
            } else { nilaiAkhir = 'Cek G-Form'; }

            const payload = { student_name: activeUser.name, mapel: currentExam.mapel, nilai: nilaiAkhir, benar: benar, salah: salah, detail_jawaban: JSON.stringify(detail), is_curang: isForceCurang };

            const sendLogic = async () => {
                clearInterval(examTimerInterval); isExamActive = false;
                if(!navigator.onLine) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); Swal.fire('Sinyal Terputus!', 'Jawaban disimpan di HP.', 'warning'); document.getElementById('offline-pending-alert').classList.remove('hidden'); return; }
                Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
                try {
                    await fetch(API + '/siswa/submit', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                    if(document.exitFullscreen) document.exitFullscreen(); 
                    if(!isForceCurang) { localStorage.removeItem(`cbt_ans_${currentExam.mapel}_${activeUser.username}`); localStorage.removeItem(`cbt_time_${currentExam.mapel}_${activeUser.username}`); }
                    Swal.fire('Selesai!', isGformOnly ? 'Terkirim.' : `Nilai Anda: ${nilaiAkhir}`, 'success').then(() => location.reload());
                } catch(e) { localStorage.setItem(`pending_submit_${activeUser.username}`, JSON.stringify(payload)); document.getElementById('offline-pending-alert').classList.remove('hidden'); Swal.fire('Error Server', 'Disimpan di HP.', 'warning'); }
            };

            if (showConfirm && !isForceCurang) {
                let kosong = cbtQuestions.filter((q, i) => { let a = cbtAnswers[i].ans; if(q.tipe === 'BS') return a === "" || a.indexOf('-') !== -1; if(q.tipe === 'JODOH') { let h = (q.kunci||"").split(',').length; return a.split(',').length < h; } return a === ""; }).length;
                let text = isGformOnly ? "Pastikan sudah Submit G-Form!" : (kosong > 0 ? `<b class='text-red-500'>${kosong} soal</b> belum dijawab! Yakin?` : "Kirim sekarang?");
                Swal.fire({ title: 'Kumpulkan Ujian?', html: text, icon: 'warning', showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'Ya!' }).then((r) => { if(r.isConfirmed) sendLogic(); });
            } else sendLogic();
        }

        // --- FUNGSI ADMIN / GURU ---
        function showPage(p) { document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden')); document.getElementById('page-'+p).classList.remove('hidden'); if(window.innerWidth < 768) { document.getElementById('admin-sidebar').classList.add('-translate-x-full'); document.getElementById('admin-overlay').classList.add('hidden'); } if(p === 'dashboard') loadStats(); if(p === 'jadwal') loadJadwal(); if(p === 'nilai') loadNilai(); if(p === 'banksoal') loadBankSoal(); }
        
        async function loadStats() { 
            if(!activeUser || activeUser.role === 'siswa') return; 
            const res = await fetch(API + '/admin/stats' + getAuthParams()); const data = await res.json(); 
            document.getElementById('stat-siswa').innerText = data.total_siswa; document.getElementById('stat-kerja').innerText = data.sedang_kerja; document.getElementById('stat-selesai').innerText = data.selesai; document.getElementById('stat-curang').innerText = data.curang; 
            
            const resA = await fetch(API + '/admin/recent-activity' + getAuthParams()); allActivityData = await resA.json(); 
            if(document.getElementById('filter-kelas').options.length === 1) {
                let kelasSet = new Set(); let mapelSet = new Set();
                allActivityData.forEach(a => { if(a.kelas && a.kelas !== '-') kelasSet.add(a.kelas); if(a.exam_name) mapelSet.add(a.exam_name); });
                const fKelas = document.getElementById('filter-kelas'); kelasSet.forEach(k => { fKelas.add(new Option(k, k)); });
                const fMapel = document.getElementById('filter-mapel'); mapelSet.forEach(m => { fMapel.add(new Option(m, m)); });
            }
            renderActivityTable();
        }

        async function resetSiswa(nama, mapel) {
            Swal.fire({ title: 'Buka Akses Ujian?', text: `Akses ujian ${nama} akan direset agar bisa login kembali tanpa menghapus jawabannya.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Buka Akses!' }).then(async (result) => {
                if (result.isConfirmed) {
                    Swal.fire({title: 'Membuka akses...', didOpen: () => Swal.showLoading()});
                    await fetch(API + '/admin/reset-siswa', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({student_name: nama, mapel: mapel}) });
                    loadStats(); Swal.fire('Berhasil', 'Akses telah dibuka. Silakan suruh siswa login kembali.', 'success');
                }
            });
        }

        function renderActivityTable() {
            const selKelas = document.getElementById('filter-kelas').value; const selMapel = document.getElementById('filter-mapel').value;
            let filtered = allActivityData.filter(a => { return (selKelas === "" || a.kelas === selKelas) && (selMapel === "" || a.exam_name === selMapel); });
            document.getElementById('monitor-table').innerHTML = filtered.map(a => {
                let statusColor = 'bg-orange-100 text-orange-600'; let textColor = 'text-slate-800'; let aksiBtn = '';
                if(a.status === 'Selesai') statusColor = 'bg-emerald-100 text-emerald-600';
                else if(a.status && a.status.includes('Curang')) { 
                    statusColor = 'bg-red-500 text-white font-black animate-pulse shadow-md'; textColor = 'text-red-600 font-bold'; 
                    aksiBtn = `<button onclick="resetSiswa('${a.student_name}', '${a.exam_name}')" class="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[9px] shadow cursor-pointer"><i class="fa fa-unlock"></i> Buka Akses</button>`;
                }
                return `<tr class="hover:bg-slate-50"><td class="p-3 font-bold ${textColor}">${a.student_name} <br><span class="text-[9px] text-slate-400">Kelas: ${a.kelas||'-'}</span></td><td class="p-3 font-medium">${a.exam_name}</td><td class="p-3"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${statusColor}">${a.status}</span> ${aksiBtn}</td><td class="p-3 font-black">${a.score||'-'}</td><td class="p-3 text-[10px]">${a.last_seen}</td></tr>`;
            }).join(''); 
        }

        async function loadMaster() { const resC = await fetch(API + '/admin/config'); const conf = await resC.json(); document.getElementById('app-name-display').innerText = conf.find(c => c.key === 'app_name').value; }
        
        async function loadNilai() { 
            const res = await fetch(API + '/admin/results' + getAuthParams()); 
            const data = await res.json(); window.allResultsData = data; 
            document.getElementById('nilai-body').innerHTML = data.map(n => `<tr><td class="p-3 font-medium">${n.student_name}</td><td>${n.mapel}</td><td class="text-emerald-600 font-bold">${n.benar || 0}</td><td class="text-red-500 font-bold">${n.salah || 0}</td><td class="font-black">${n.nilai}</td><td><button onclick='lihatDetail(${JSON.stringify(n.detail_jawaban || "[]")})' class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-[10px] font-bold">Detail</button></td></tr>`).join(''); 
        }
        
        function lihatDetail(detailJson) { 
            let details = []; try { details = JSON.parse(detailJson); } catch(e) { details = []; } 
            if(details.length === 0) return Swal.fire('Info', 'Bentuk GForm', 'info'); 
            let html = details.map(d => {
                let jawabTampil = d.jawab || '-'; if(jawabTampil.includes(',')) jawabTampil = jawabTampil.split(',').join(', ');
                return `<div class="bg-white p-4 rounded-xl border shadow-sm"><div class="flex justify-between items-start mb-2"><span class="font-bold text-slate-700">Soal No. ${d.no}</span><span class="px-2 py-1 text-[10px] font-bold rounded-full ${d.status.includes('Benar') ? 'bg-emerald-100 text-emerald-700' : (d.status==='Salah' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}">${d.status} (Skor: ${d.poin})</span></div><div class="text-sm text-slate-600 mb-3">${d.tanya.substring(0, 100)}...</div><div class="flex gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100"><div class="flex-1"><span class="text-slate-400 block mb-1">Jawaban Siswa:</span><strong class="${d.status==='Salah'?'text-red-600':'text-slate-800'}">${jawabTampil}</strong></div><div class="flex-1 border-l pl-4"><span class="text-slate-400 block mb-1">Kunci Jawaban:</span><strong class="text-emerald-600">${d.kunci || '-'}</strong></div></div></div>`
            }).join(''); 
            document.getElementById('detail-content').innerHTML = html; document.getElementById('modal-detail').classList.remove('hidden'); 
        }

        function exportExcelDetail() {
            if(!window.allResultsData || window.allResultsData.length === 0) return Swal.fire('Kosong', 'Belum ada data nilai', 'warning');
            let maxQ = 0; window.allResultsData.forEach(r => { try { let details = JSON.parse(r.detail_jawaban); if(details.length > maxQ) maxQ = details.length; } catch(e){} });
            let tableHtml = `<table border="1"><thead><tr><th style="background-color: #f8fafc; font-weight: bold;">Nama Siswa</th><th style="background-color: #f8fafc; font-weight: bold;">Mapel</th><th style="background-color: #f8fafc; font-weight: bold;">Benar</th><th style="background-color: #f8fafc; font-weight: bold;">Salah</th><th style="background-color: #f8fafc; font-weight: bold;">Nilai Akhir</th>`;
            for(let i=1; i<=maxQ; i++) { tableHtml += `<th style="background-color: #f8fafc; font-weight: bold;">Soal No.${i}</th>`; } tableHtml += `</tr></thead><tbody>`;
            window.allResultsData.forEach(r => {
                let details = []; try { details = JSON.parse(r.detail_jawaban); } catch(e){}
                tableHtml += `<tr><td>${r.student_name}</td><td>${r.mapel}</td><td>${r.benar}</td><td>${r.salah}</td><td style="font-weight: bold;">${r.nilai}</td>`;
                let detMap = {}; details.forEach(d => { detMap[d.no] = d; });
                for(let i=1; i<=maxQ; i++) {
                    let d = detMap[i];
                    if(d) {
                        let color = d.status.includes('Benar') ? '#2563eb' : (d.status === 'Salah' ? '#dc2626' : '#000000');
                        let jawabText = d.jawab || '-'; tableHtml += `<td style="color: ${color}; font-weight: bold;">${jawabText}</td>`;
                    } else { tableHtml += `<td>-</td>`; }
                } tableHtml += `</tr>`;
            }); tableHtml += `</tbody></table>`;
            let blob = new Blob([tableHtml], {type: 'application/vnd.ms-excel'}); let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Hasil_Ujian_Lengkap_Berwarna.xls'; a.click();
        }

        async function clearResults() { Swal.fire({title: 'Hapus Semua Nilai?', icon: 'warning', showCancelButton: true}).then(async (r) => { if(r.isConfirmed) { await fetch(API + '/admin/clear-results', {method:'DELETE'}); loadNilai(); loadStats(); Swal.fire('Bersih!', '', 'success'); } }); }
        async function clearSchedules() { Swal.fire({title: 'Hapus Semua Jadwal?', icon: 'warning', showCancelButton: true}).then(async (r) => { if(r.isConfirmed) { await fetch(API + '/admin/clear-schedules', {method:'DELETE'}); loadJadwal(); Swal.fire('Bersih!', '', 'success'); } }); }
        async function clearQuestions() { Swal.fire({title: 'Kosongkan Bank Soal?', text: 'Seluruh soal akan hilang!', icon: 'warning', showCancelButton: true}).then(async (r) => { if(r.isConfirmed) { await fetch(API + '/admin/clear-questions', {method:'DELETE'}); loadBankSoal(); Swal.fire('Bersih!', '', 'success'); } }); }
        async function clearUsers() { Swal.fire({title: 'Hapus Semua Siswa?', icon: 'warning', showCancelButton: true}).then(async (r) => { if(r.isConfirmed) { await fetch(API + '/admin/clear-users', {method:'DELETE'}); loadUsers(); Swal.fire('Bersih!', '', 'success'); } }); }

        async function importExcelSoal() { const file = document.getElementById('ex_file').files[0]; const exam_id = document.getElementById('ex_judul').value; if(!file || !exam_id) return Swal.fire('Oops', 'Isi KODE UJIAN dan pilih File Excel!', 'warning'); const fd = new FormData(); fd.append('file_excel', file); fd.append('exam_id', exam_id); Swal.fire({ title: 'Importing Excel...', didOpen: () => Swal.showLoading() }); try { const res = await fetch(API + '/admin/import-soal', { method: 'POST', body: fd }); const data = await res.json(); if(data.status === 'success') { Swal.fire('Berhasil', data.message, 'success'); loadBankSoal(); } else Swal.fire('Gagal', data.message, 'error'); } catch(e) { Swal.fire('Error', 'Gagal', 'error'); } }
        async function importWord() { const file = document.getElementById('w_file').files[0]; const exam_id = document.getElementById('w_judul').value; if(!file || !exam_id) return Swal.fire('Oops', 'Isi KODE UJIAN dan pilih File Word!', 'warning'); const fd = new FormData(); fd.append('file_word', file); fd.append('exam_id', exam_id); Swal.fire({ title: 'Mengekstrak...', didOpen: () => Swal.showLoading() }); try { const res = await fetch(API + '/admin/import-word', { method: 'POST', body: fd }); const data = await res.json(); if(data.status === 'success') { Swal.fire('Berhasil', data.message, 'success'); loadBankSoal(); } else Swal.fire('Gagal', data.message, 'error'); } catch(e) { Swal.fire('Error', 'Gagal', 'error'); } }

        let questionCount = 1;
        function tambahBarisSoal() { questionCount++; const container = document.getElementById('bulk-questions-container'); const html = `<div class="question-item bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 relative mt-6" data-no="${questionCount}"><div class="absolute -left-3 -top-3 w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center font-black shadow-lg">${questionCount}</div><button onclick="this.parentElement.remove()" class="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs shadow-md"><i class="fa fa-times"></i></button><div class="grid grid-cols-1 gap-3"><div class="grid grid-cols-1 md:grid-cols-3 gap-2"><div><label class="text-[10px] font-bold text-slate-500">TIPE SOAL</label><select class="q-tipe w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500"><option value="PG">1 - Pilihan Ganda Biasa</option><option value="PGK">2 - PG Kompleks (Kotak Centang)</option><option value="JODOH">3 - Menjodohkan (Dropdown)</option><option value="ISIAN">4 - Isian Singkat</option><option value="ESAI">5 - Uraian (Esai)</option><option value="BS" class="font-bold text-emerald-600">7 - Benar/Salah (Tabel)</option><option value="GFORM" class="font-bold text-purple-600">8 - Link G-Form</option></select></div><div><label class="text-[10px] font-bold text-slate-500">KUNCI JAWABAN</label><input type="text" class="q-kunci w-full p-2 border rounded-lg text-xs" placeholder="Misal: A, atau A,C, atau 1B,2C"></div><div><label class="text-[10px] font-bold text-blue-600">SKOR BOBOT</label><input type="number" class="q-skor w-full p-2 border border-blue-300 bg-blue-50 rounded-lg text-xs font-bold" value="1"></div></div><div><label class="text-[10px] font-bold text-blue-500"><i class="fa fa-image"></i> LINK GAMBAR DRIVE</label><input type="text" class="q-image w-full p-2 border rounded-lg text-xs" placeholder="http://..."></div><div><label class="text-[10px] font-bold text-slate-500">PERTANYAAN (Awali dgn angka misal "1. Teks" lalu enter untuk B-S/Jodoh)</label><textarea class="q-tanya w-full p-2 border rounded-lg text-sm h-16"></textarea></div><div class="q-area-opsi"><label class="text-[10px] font-bold text-orange-600">OPSI / PILIHAN JAWABAN (Gunakan ||| sebagai pemisah)</label><input type="text" class="q-opsi w-full p-2 border border-orange-200 rounded-lg text-xs" placeholder="Pilihan A ||| Pilihan B"></div></div></div>`; container.insertAdjacentHTML('beforeend', html); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }

        async function simpanSoalBulk() { const kodeUjian = document.getElementById('s_judul_bulk').value; if(!kodeUjian) return Swal.fire('Error', 'Isi KODE UJIAN!', 'warning'); const items = document.querySelectorAll('.question-item'); let dataSoal = []; items.forEach(el => { dataSoal.push({ exam_id: kodeUjian, tipe: el.querySelector('.q-tipe').value, tanya: el.querySelector('.q-tanya').value, opsi_json: el.querySelector('.q-opsi').value, kunci: el.querySelector('.q-kunci').value.toUpperCase(), gform_url: el.querySelector('.q-image').value, skor: parseFloat(el.querySelector('.q-skor').value) || 1 }); }); if(dataSoal.length === 0) return; Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() }); try { const res = await fetch(API + '/admin/add-soal-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: dataSoal }) }); const data = await res.json(); if(data.status === 'success') { Swal.fire('Berhasil!', `${dataSoal.length} Soal disimpan.`, 'success').then(() => location.reload()); } else Swal.fire('Gagal', data.message, 'error'); } catch(e) { Swal.fire('Error', 'Gagal', 'error'); } }

        async function loadBankSoal() { const res = await fetch(API + '/admin/questions' + getAuthParams()); const data = await res.json(); document.getElementById('banksoal-table').innerHTML = data.map(q => { let det = q.tipe === 'GFORM' ? `<span class="text-purple-600 font-bold">Link G-Form: ${q.tanya || q.gform_url}</span>` : (q.tanya ? q.tanya.substring(0,60)+'...' : '-'); det += `<br><span class="text-[10px] font-bold text-emerald-600 mt-2 inline-block p-1 bg-emerald-50 border border-emerald-200 rounded"><i class="fa fa-key"></i> KUNCI: <b class="text-emerald-900">${q.kunci || '-'}</b></span> <span class="text-[10px] font-bold text-blue-600 mt-2 inline-block p-1 bg-blue-50 border border-blue-200 rounded ml-1"><i class="fa fa-star"></i> SKOR: <b class="text-blue-900">${q.skor || 1}</b></span>`; return `<tr><td class="p-3 font-bold text-blue-900 align-top">${q.exam_id}</td><td class="align-top pt-3"><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[8px] font-black">${q.tipe}</span></td><td class="text-xs text-slate-700 py-3">${det}</td><td class="p-3 align-top"><button onclick="hapusSoal(${q.id})" class="text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-3 py-2 rounded-lg transition shadow-sm"><i class="fa fa-trash"></i> Hapus</button></td></tr>`; }).join(''); }

        async function hapusSoal(id) { Swal.fire({title: 'Hapus Soal?', icon:'warning', showCancelButton: true}).then(async (r) => { if(r.isConfirmed) { await fetch(API + '/admin/delete-soal/'+id, {method:'DELETE'}); loadBankSoal(); loadJadwal(); } }); }
        async function saveJadwal() { const b = { mapel: document.getElementById('j_mapel').value, tanggal: document.getElementById('j_tgl').value, durasi: document.getElementById('j_durasi').value }; if(!b.mapel) return Swal.fire('Oops','Pilih Mapel!','warning'); await fetch(API + '/admin/add-schedule', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b) }); Swal.fire('Sukses!', '', 'success'); loadJadwal(); }
        
        async function loadJadwal() { 
            const res = await fetch(API + '/admin/schedules' + getAuthParams()); const data = await res.json(); 
            document.getElementById('list-jadwal').innerHTML = data.map(j => `<div class="bg-white p-4 rounded-xl border border-l-4 border-blue-500 shadow-sm flex justify-between items-center"><div><h4 class="font-bold text-sm text-blue-900">${j.mapel}</h4><p class="text-[10px] text-slate-400">${j.tanggal} • ${j.durasi} Menit</p></div><div class="text-center"><p class="text-[8px] font-bold text-slate-400">PIN UJIAN</p><p class="text-lg font-black text-blue-600 font-mono tracking-widest">${j.pin}</p></div></div>`).join(''); 
            
            const resExams = await fetch(API + '/admin/available-exams' + getAuthParams()); const exams = await resExams.json(); const selectMapel = document.getElementById('j_mapel');
            selectMapel.innerHTML = '<option value="">-- Pilih Kode Soal --</option>' + exams.map(e => `<option value="${e}">${e}</option>`).join('');
        }
        
        async function importUsers(inp) { if(!inp.files[0]) return; Swal.fire({ title: 'Importing...', didOpen: () => Swal.showLoading() }); const fd = new FormData(); fd.append('file_excel', inp.files[0]); await fetch(API + '/admin/import-users', { method: 'POST', body: fd }); Swal.fire('Selesai', 'Import berhasil', 'success'); loadUsers(); }
        async function loadUsers() { const res = await fetch(API + '/admin/users'); const data = await res.json(); document.getElementById('user-body').innerHTML = data.map(u => `<tr><td class="p-3 font-medium">${u.name}</td><td>${u.username}</td><td>${u.kelas || u.mapel || '-'}</td><td><span class="px-2 py-1 bg-slate-100 rounded text-[10px]">${u.role}</span></td></tr>`).join(''); }

        setInterval(() => { if(activeUser && activeUser.role !== 'siswa' && !document.getElementById('page-dashboard').classList.contains('hidden')) loadStats(); }, 3000);
    </script>
</body>
</html>