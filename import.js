// ============================================================
// CBT SPENDA — IMPOR SOAL (Excel & Word)
// Parser dipertahankan dari versi sebelumnya (sudah teruji dengan
// format soal guru), hanya penyimpanan & pratinjau yang diperbarui.
// ============================================================

// Pratinjau seluruh soal hasil impor, lalu simpan
async function konfirmasiSimpanImpor(questions, kodeUjian, onDone) {
    const tipeCounts = {};
    questions.forEach(q => { tipeCounts[q.tipe] = (tipeCounts[q.tipe] || 0) + 1; });
    const tanpaKunci = questions.filter(q => !q.kunci && !['ESAI', 'GFORM'].includes(q.tipe)).length;
    openModal(`<h2 class="font-extrabold text-lg">${questions.length} soal terbaca</h2><p class="text-sm text-muted">Paket <b>${esc(kodeUjian)}</b> · ${Object.entries(tipeCounts).map(([t, n]) => `${TIPE_LABEL[t] || t} ${n}`).join(', ')}</p>`,
        (tanpaKunci ? `<div class="rounded-xl bg-gold-50 text-gold-700 text-sm p-3 mb-4"><i class="fa fa-triangle-exclamation"></i> ${tanpaKunci} soal belum memiliki kunci jawaban. Anda bisa melengkapinya nanti lewat tombol <b>Ubah</b>.</div>` : '')
        + `<div class="space-y-3">${questions.map((q, i) => renderPreviewSoal(q, i + 1)).join('')}</div>`,
        { wide: true, foot: `<button class="btn btn-ghost" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="btn-simpan-impor"><i class="fa fa-floppy-disk"></i> Simpan ${questions.length} soal</button>` });
    $('btn-simpan-impor').onclick = async () => {
        loading('Menyimpan ke bank soal…');
        try {
            for (let i = 0; i < questions.length; i += 200) {
                const r = await api('/admin/add-soal-bulk', { body: { questions: questions.slice(i, i + 200) } });
                if (r.status !== 'success') throw new Error(r.message);
            }
            closeModal();
            Swal.fire({ icon: 'success', title: 'Tersimpan', text: `${questions.length} soal masuk ke paket ${kodeUjian}.` });
            if (onDone) onDone();
            bankTab = 'paket'; setBankTab('paket');
        } catch (e) { Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: e.message }); }
    };
}

async function importExcelSoal() {
    const kodeUjian = (document.getElementById('ex_judul')?.value || '').trim();
    const fileInput = document.getElementById('ex_file');
    const file      = fileInput ? fileInput.files[0] : null;

    if (!kodeUjian) return Swal.fire('Isi Kode Ujian', 'Kode Ujian (exam_id) wajib diisi. Contoh: MTK-7A-2026', 'warning');
    if (!file)      return Swal.fire('Oops', 'Pilih file Excel (.xlsx) terlebih dahulu!', 'warning');

    Swal.fire({ title: 'Membaca File Excel...', didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const workbook  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            // Cari sheet utama: skip sheet yang hanya berisi panduan (kolom <= 2)
            let targetSheet = null;
            for (const name of workbook.SheetNames) {
                const ws   = workbook.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                if (rows.length > 1 && rows[0] && rows[0].length >= 3) { targetSheet = name; break; }
            }
            if (!targetSheet) return Swal.fire('Gagal', 'Sheet soal tidak ditemukan. Pastikan sheet utama berisi tabel dengan minimal 3 kolom.', 'error');

            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { defval: '' });
            if (!rawData.length) return Swal.fire('Gagal', 'Sheet kosong atau tidak ada data.', 'error');

            // Normalisasi header: lowercase + hapus spasi/underscore untuk matching fleksibel
            const norm = s => String(s || '').toLowerCase().replace(/[\s_\-]/g, '');
            const findKey = (row, ...aliases) => {
                for (const key of Object.keys(row)) {
                    if (aliases.some(a => norm(key) === norm(a) || norm(key).startsWith(norm(a)))) return key;
                }
                return null;
            };

            const questions = [];
            const tipePeta = {
                'ESSAY':'ESAI','URAIAN':'ESAI','ISIAN SINGKAT':'ISIAN','SHORT ANSWER':'ISIAN',
                'BENAR/SALAH':'BS','TRUE/FALSE':'BS','BENARSALAH':'BS','TRUEFALSE':'BS',
                'SESUAI/TIDAKSESUAI':'TS','NUMERIK/KATEGORIK':'NK','NUMERIKKATEGORIK':'NK','NK':'NK','MENJODOHKAN':'JODOH','MATCHING':'JODOH',
                'PILIHAN GANDA KOMPLEKS':'PGK','PILIHAN GANDA':'PG','GOOGLE FORM':'GFORM',
            };

            rawData.forEach((row, idx) => {
                // Ambil tiap field dengan alias yang fleksibel
                const kTanya  = findKey(row, 'Pertanyaan', 'Soal', 'Tanya', 'Question');
                const kTipe   = findKey(row, 'Tipe', 'Type', 'Jenis');
                const kA      = findKey(row, 'Opsi_A', 'OpsiA', 'PilihanA', 'A');
                const kB      = findKey(row, 'Opsi_B', 'OpsiB', 'PilihanB', 'B');
                const kC      = findKey(row, 'Opsi_C', 'OpsiC', 'PilihanC', 'C');
                const kD      = findKey(row, 'Opsi_D', 'OpsiD', 'PilihanD', 'D');
                const kE      = findKey(row, 'Opsi_E', 'OpsiE', 'PilihanE', 'E');
                const kF      = findKey(row, 'Opsi_F', 'OpsiF', 'PilihanF', 'F');
                const kG      = findKey(row, 'Opsi_G', 'OpsiG', 'PilihanG', 'G');
                const kKunci  = findKey(row, 'Kunci', 'Jawaban', 'Answer', 'Kunci_Jawaban', 'KunciJawaban');
                const kSkor   = findKey(row, 'Skor', 'Bobot', 'Nilai', 'Poin', 'Score');
                const kGambar = findKey(row, 'Link_Gambar', 'LinkGambar', 'Gambar', 'Image', 'Foto', 'Link', 'gform_url');
                const kOpsiGbg= findKey(row, 'Opsi', 'Pilihan', 'OpsiJson', 'opsi_json'); // kolom gabungan (fallback)

                const tanya = String(row[kTanya] || '').trim();
                if (!tanya) return; // skip baris kosong

                // Kumpulkan opsi dari kolom terpisah
                const opsiArr = [kA, kB, kC, kD, kE, kF, kG]
                    .map(k => k ? String(row[k] || '').trim() : '')
                    .filter(v => v);

                // Fallback: jika tidak ada kolom Opsi_A dst, cek kolom gabungan 'opsi'/'pilihan'
                let opsiJson = '';
                if (opsiArr.length > 0) {
                    opsiJson = opsiArr.join('|||');
                } else if (kOpsiGbg) {
                    opsiJson = String(row[kOpsiGbg] || '').trim();
                }

                let tipeRaw = String(row[kTipe] || 'PG').trim().toUpperCase();
                tipeRaw = tipePeta[tipeRaw] || tipeRaw;

                // Auto-detect tipe jika kosong / tidak dikenali
                const validTipe = ['PG','PGK','BS','TS','NK','SIFAT','ISIAN','ESAI','JODOH','GFORM'];
                if (!validTipe.includes(tipeRaw)) {
                    if (opsiArr.length === 0) tipeRaw = 'ESAI';
                    else {
                        const kArr = String(row[kKunci] || '').replace(/\s/g,'').split(',').filter(k=>k);
                        tipeRaw = kArr.length > 1 ? 'PGK' : 'PG';
                    }
                }

                const kunci   = String(row[kKunci]  || '').trim().toUpperCase().replace(/\s+/g,'');
                const skor    = parseFloat(String(row[kSkor] || '1').replace(',','.')) || 1;
                const gambar  = String(row[kGambar] || '').trim();

                // ── TS/BS: auto-inject HEADER[...] jika opsi ke-1 & ke-2 adalah header pendek ──
                if ((tipeRaw === 'TS' || tipeRaw === 'BS') && opsiJson) {
                    const parts = opsiJson.split('|||').map(p => p.trim()).filter(p => p);
                    if (parts.length >= 3 && !parts[0].match(/^HEADER\[/i)) {
                        const col1 = parts[0], col2 = parts[1];
                        if (col1.length <= 30 && col2.length <= 30) {
                            opsiJson = `HEADER[${col1},${col2}]|||` + parts.slice(2).join('|||');
                        }
                    }
                }

                questions.push({
                    exam_id  : kodeUjian,
                    tipe     : tipeRaw,
                    tanya    : tanya,
                    opsi_json: opsiJson,
                    kunci    : kunci,
                    skor     : skor,
                    gform_url: gambar,
                    media_path: gambar
                });
            });

            if (questions.length === 0) {
                return Swal.fire('Gagal', 'Tidak ada soal ditemukan. Pastikan header kolom sesuai:<br><b>Tipe | Pertanyaan | Opsi_A..E | Kunci | Skor | Link_Gambar</b>', 'error');
            }

            Swal.close();
            konfirmasiSimpanImpor(questions, kodeUjian, () => { fileInput.value = ''; $('ex_judul').value = ''; });
        } catch (err) {
            Swal.fire('Error Lokal', 'Gagal memproses file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// HELPER: Baca file docx sebagai ZIP & patch OMML fraction
// docx adalah ZIP biasa — kita baca word/document.xml lalu
// replace semua <m:f> (Word Equation fraction) dengan teks
// "num/den" sebelum dikirim ke mammoth, sehingga pecahan
// seperti 2/3 tampil benar (bukan "23" atau "2 3")
// ============================================================
function patchDocxFractions(arrayBuffer) {
    return new Promise(function(resolve) {
        try {
            const bytes   = new Uint8Array(arrayBuffer);
            const str     = String.fromCharCode.apply(null, bytes);

            // Cari word/document.xml di dalam ZIP
            // Signature entry: local file header = 0x504B0304
            // Kita scan untuk nama file "word/document.xml"
            const TARGET  = 'word/document.xml';
            let xmlStart  = -1;
            let xmlBytes  = null;

            // Parse ZIP central directory untuk cari offset entry
            // Scan dari belakang: end of central directory = 0x504B0506
            let eocd = -1;
            for (let i = bytes.length - 22; i >= 0; i--) {
                if (bytes[i]===0x50 && bytes[i+1]===0x4B && bytes[i+2]===0x05 && bytes[i+3]===0x06) {
                    eocd = i; break;
                }
            }
            if (eocd < 0) { resolve(arrayBuffer); return; }

            const cdOffset = bytes[eocd+16] | (bytes[eocd+17]<<8) | (bytes[eocd+18]<<16) | (bytes[eocd+19]<<24);
            const cdSize   = bytes[eocd+12] | (bytes[eocd+13]<<8) | (bytes[eocd+14]<<16) | (bytes[eocd+15]<<24);

            // Scan central directory entries
            let pos = cdOffset;
            while (pos < cdOffset + cdSize) {
                if (bytes[pos]!==0x50||bytes[pos+1]!==0x4B||bytes[pos+2]!==0x01||bytes[pos+3]!==0x02) break;
                const fnLen     = bytes[pos+28] | (bytes[pos+29]<<8);
                const extraLen  = bytes[pos+30] | (bytes[pos+31]<<8);
                const commentLen= bytes[pos+32] | (bytes[pos+33]<<8);
                const localOff  = bytes[pos+42] | (bytes[pos+43]<<8) | (bytes[pos+44]<<16) | (bytes[pos+45]<<24);
                const fname     = String.fromCharCode(...bytes.slice(pos+46, pos+46+fnLen));

                if (fname === TARGET) {
                    // Baca local file header untuk cari data
                    const lhExtraLen = bytes[localOff+28] | (bytes[localOff+29]<<8);
                    const dataStart  = localOff + 30 + fnLen + lhExtraLen;
                    const compSize   = bytes[localOff+18] | (bytes[localOff+19]<<8) | (bytes[localOff+20]<<16) | (bytes[localOff+21]<<24);
                    const compMethod = bytes[localOff+8] | (bytes[localOff+9]<<8);

                    if (compMethod === 0) {
                        // Stored (uncompressed)
                        xmlBytes = bytes.slice(dataStart, dataStart + compSize);
                    } else if (compMethod === 8) {
                        // Deflate — gunakan DecompressionStream jika tersedia
                        try {
                            const ds = new DecompressionStream('deflate-raw');
                            const writer = ds.writable.getWriter();
                            const reader = ds.readable.getReader();
                            writer.write(bytes.slice(dataStart, dataStart + compSize));
                            writer.close();
                            const chunks = [];
                            const pump = () => reader.read().then(({done, value}) => {
                                if (done) {
                                    xmlBytes = new Uint8Array(chunks.reduce((a,c)=>[...a,...c],[]));
                                    patchAndResolve();
                                } else { chunks.push(value); pump(); }
                            });
                            pump(); return;
                        } catch(e) { resolve(arrayBuffer); return; }
                    }
                    break;
                }
                pos += 46 + fnLen + extraLen + commentLen;
            }

            patchAndResolve();

            function patchAndResolve() {
                if (!xmlBytes) { resolve(arrayBuffer); return; }
                try {
                    const decoder = new TextDecoder('utf-8');
                    let xmlStr = decoder.decode(xmlBytes);

                    // ── Replace <m:f> (fraction) dengan teks (num/den) ──
                    xmlStr = xmlStr.replace(/<m:f>[\s\S]*?<\/m:f>/g, function(frac) {
                        const numMatch = frac.match(/<m:num>([\s\S]*?)<\/m:num>/);
                        const denMatch = frac.match(/<m:den>([\s\S]*?)<\/m:den>/);
                        const numText  = numMatch ? (numMatch[1].match(/<m:t[^>]*>([^<]*)<\/m:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('') : '?';
                        const denText  = denMatch ? (denMatch[1].match(/<m:t[^>]*>([^<]*)<\/m:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('') : '?';
                        return `<w:r><w:t xml:space="preserve">(${numText}/${denText})</w:t></w:r>`;
                    });

                    // ── Patch superscript dalam equation: <m:sSup> ──
                    // Contoh: x² dalam equation → x^2
                    xmlStr = xmlStr.replace(/<m:sSup>([\s\S]*?)<\/m:sSup>/g, function(sup) {
                        const eMatch  = sup.match(/<m:e>([\s\S]*?)<\/m:e>/);
                        const supMatch= sup.match(/<m:sup>([\s\S]*?)<\/m:sup>/);
                        const base    = eMatch  ? (eMatch[1].match(/<m:t[^>]*>([^<]*)<\/m:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('') : '';
                        const exp2    = supMatch? (supMatch[1].match(/<m:t[^>]*>([^<]*)<\/m:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join('') : '';
                        return `<w:r><w:t xml:space="preserve">${base}^(${exp2})</w:t></w:r>`;
                    });

                    // Encode kembali ke bytes dan rebuild ArrayBuffer
                    const encoder   = new TextEncoder();
                    const newXml    = encoder.encode(xmlStr);

                    // Rebuild ZIP: ganti entry lama dengan yang baru
                    // Strategi sederhana: cari & ganti raw bytes entry
                    // (hanya works untuk stored/method=0; untuk deflate kita sudah
                    //  decompress di atas jadi sekarang tinggal stored kembali)
                    // Rebuild full ZIP dengan entry baru (stored, uncompressed)
                    // Ini kompleks — gunakan pendekatan alternatif:
                    // Kembalikan xmlStr sebagai text untuk diproses langsung
                    resolve({ _patchedXml: xmlStr, _original: arrayBuffer });
                } catch(e) { resolve(arrayBuffer); }
            }
        } catch(e) { resolve(arrayBuffer); }
    });
}

function importWord() {
    const kodeUjian = document.getElementById('w_judul').value.trim();
    const fileInput = document.getElementById('w_file');
    const file      = fileInput.files[0];

    if (!kodeUjian) return Swal.fire('Oops', 'Isi Kode Ujian terlebih dahulu!', 'warning');
    if (!file)      return Swal.fire('Oops', 'Pilih file Word (.docx) terlebih dahulu!', 'warning');

    Swal.fire({ title: 'Mengekstrak & Memproses Soal...', didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = async function(event) {
        if (typeof mammoth === 'undefined') {
            return Swal.fire('Error', 'Library ekstrak Word belum termuat. Pastikan koneksi internet stabil lalu refresh halaman.', 'error');
        }

        try {
            // ── LANGKAH 1: Pre-process XML — perbaiki pecahan & superscript OMML ──
            const patched = await patchDocxFractions(event.target.result);

            let htmlValue = '';
            let rawText   = '';

            if (patched && patched._patchedXml) {
                // Gunakan patched XML — parse tabel langsung dari XML (tanpa mammoth)
                // karena ZIP rebuild terlalu kompleks; kita parse tabel dari XML sendiri
                htmlValue = patchedXmlToHtml(patched._patchedXml);
                rawText   = patchedXmlToText(patched._patchedXml);
            } else {
                // Fallback: langsung pakai mammoth tanpa patch
                const htmlResult = await mammoth.convertToHtml({ arrayBuffer: event.target.result });
                htmlValue = htmlResult.value;
                const textResult = await mammoth.extractRawText({ arrayBuffer: event.target.result });
                rawText = textResult.value;
            }

            // ── LANGKAH 2: Parse tabel dari HTML ──
            let questions = parseWordTable(htmlValue, kodeUjian);

            // ── LANGKAH 3: Fallback ke parser teks ──
            if (questions.length === 0) {
                questions = parseWordText(rawText, kodeUjian);
            }

            handleWordQuestions(questions, kodeUjian, fileInput, htmlValue.substring(0, 600));

        } catch(err) {
            Swal.fire('Gagal Membaca File',
                'Format tidak didukung. Pastikan berekstensi .docx (bukan .doc). Detail: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ── Konversi patched XML ke HTML tabel (untuk parseWordTable) ──
function patchedXmlToHtml(xmlStr) {
    // Parse tabel dari XML word/document.xml
    // Kita buat HTML tabel yang bisa dibaca parseWordTable
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

    // Ambil semua tabel (w:tbl)
    const tables = xmlDoc.querySelectorAll('tbl');
    if (!tables.length) return '';

    let html = '';
    tables.forEach(tbl => {
        html += '<table>';
        const rows = tbl.querySelectorAll('tr');
        rows.forEach(row => {
            html += '<tr>';
            const cells = row.querySelectorAll('tc');
            cells.forEach(cell => {
                // Ambil semua teks dari cell (w:t elements)
                const texts = cell.querySelectorAll('t');
                let cellText = '';
                texts.forEach(t => { cellText += t.textContent; });
                html += `<td>${cellText.trim()}</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
    });
    return html;
}

// ── Konversi patched XML ke plain text (untuk parseWordText fallback) ──
function patchedXmlToText(xmlStr) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const texts  = xmlDoc.querySelectorAll('t');
    const lines  = [];
    texts.forEach(t => { if (t.textContent.trim()) lines.push(t.textContent); });
    return lines.join('\n');
}

function handleWordQuestions(questions, kodeUjian, fileInput, rawPreview) {
    if (questions.length === 0) {
        return Swal.fire({
            title: 'Gagal Parsing Otomatis',
            html: `<p class="text-xs text-red-600 font-bold mb-3">
                     Sistem tidak dapat mendeteksi soal secara otomatis.<br>
                     Pastikan format file Word menggunakan <b>tabel</b> dengan header:<br>
                     <code>No | Tipe | Pertanyaan | Link_Gambar | Opsi_A..E | Kunci | Skor</code>
                   </p>
                   <p class="text-[10px] text-slate-500 font-bold mb-1">Cuplikan HTML yang diekstrak:</p>
                   <textarea class="w-full h-28 p-2 border rounded text-[10px] outline-none bg-white font-mono" readonly>${esc(rawPreview)}</textarea>`,
            width: '85%', confirmButtonColor: '#3085d6', confirmButtonText: 'Tutup'
        });
    }

    Swal.close();
    konfirmasiSimpanImpor(questions, kodeUjian, () => { if (fileInput) fileInput.value = ''; const wj = $('w_judul'); if (wj) wj.value = ''; });
}


// ================================================================
// PARSER FORMAT TABEL WORD  (Format utama — sesuai template)
// ================================================================
// Kolom: No | Tipe | Pertanyaan | Link_Gambar | Opsi_A..E | Kunci | Skor
// Tipe: PG, PGK, BS, TS, SIFAT, ISIAN, ESAI, JODOH, GFORM
// ================================================================
function parseWordTable(htmlContent, kodeUjian) {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(htmlContent, 'text/html');
    const tables = doc.querySelectorAll('table');
    if (!tables.length) return [];

    const questions = [];
    const norm = s => (s || '').toLowerCase().replace(/[\s_\-]/g, '');

    tables.forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return;

        const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
        const headers     = headerCells.map(c => norm(c.textContent));

        const findCol = (...aliases) => {
            for (let i = 0; i < headers.length; i++) {
                if (aliases.some(a => headers[i] === norm(a) || headers[i].startsWith(norm(a)))) return i;
            }
            return -1;
        };

        const iNo    = findCol('no','nomor');
        const iTipe  = findCol('tipe','type','jenis');
        const iTanya = findCol('pertanyaan','soal','question','tanya');
        const iGbr   = findCol('linkgambar','link_gambar','gambar','image','foto','link');
        const iA     = findCol('opsia','opsi_a');
        const iB     = findCol('opsib','opsi_b');
        const iC     = findCol('opsic','opsi_c');
        const iD     = findCol('opsid','opsi_d');
        const iE     = findCol('opsie','opsi_e');
        const iKunci = findCol('kunci','jawaban','answer','kuncijawaban');
        const iSkor  = findCol('skor','bobot','nilai','poin','score');

        if (iTanya === -1) return;

        const tipePeta = {
            'ESSAY':'ESAI','URAIAN':'ESAI','ISIAN SINGKAT':'ISIAN',
            'BENAR/SALAH':'BS','TRUE/FALSE':'BS','BENARSALAH':'BS',
            'SESUAI/TIDAKSESUAI':'TS','MENJODOHKAN':'JODOH','MATCHING':'JODOH',
            'PILIHANGANDAKOMPLEKS':'PGK','PILIHANGANDA':'PG','GOOGLEFORM':'GFORM',
        };

        for (let r = 1; r < rows.length; r++) {
            const cells = Array.from(rows[r].querySelectorAll('td, th'));
            const get   = i => (i >= 0 && cells[i]) ? cells[i].textContent.trim() : '';

            const tanya = get(iTanya);
            if (!tanya) continue;

            const opsiArr = [get(iA), get(iB), get(iC), get(iD), get(iE)].filter(v => v);
            const kunciRaw = get(iKunci).trim().toUpperCase();
            const skorRaw  = get(iSkor);
            const gform_url = get(iGbr).trim();

            let tipe = get(iTipe).trim().toUpperCase();
            tipe = tipePeta[tipe] || tipe;
            if (!tipe || tipe === '-') {
                if (opsiArr.length === 0) tipe = 'ESAI';
                else {
                    const kArr = kunciRaw.replace(/\s/g,'').split(',').filter(k=>k);
                    tipe = kArr.length > 1 ? 'PGK' : 'PG';
                }
            }

            questions.push({
                exam_id  : kodeUjian,
                tipe     : tipe,
                tanya    : tanya,
                opsi_json: opsiArr.join('|||'),
                kunci    : kunciRaw.replace(/\s+/g,''),
                skor     : parseFloat((skorRaw||'1').replace(',','.')) || 1,
                gform_url: gform_url,
                media_path: gform_url  // simpan juga ke media_path agar gambar muncul di soal siswa
            });
        }
    });

    return questions;
}

// ================================================================
// PARSER FORMAT TEKS WORD  (Fallback — jika bukan tabel)
// ================================================================
function parseWordText(rawText, kodeUjian) {
    const lines = rawText
        .replace(/\uFEFF/g,'')
        .replace(/\r\n|\r/g,'\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const questions = [];
    const rSoal  = /^(\d{1,3})\s*[.)]\s+(.{2,})/;
    const rOpsi  = /^([A-Ea-e])\s*[.)]\s+(.+)/;
    const rKunci = /^(?:kunci(?:\s*jawaban)?|jawaban(?:\s*benar)?|jwb)\s*[:\-=]?\s*([A-Ea-e,\s]+)\s*$/i;
    const rTipe  = /^tipe\s*[:\-=]\s*(\w+(?:\s+\w+)?)\s*$/i;
    const rSkor  = /^(?:skor|bobot|nilai|poin)\s*[:\-=]\s*(\d+(?:[.,]\d+)?)\s*$/i;
    const rGbr   = /^(?:gambar|image|foto|link)\s*[:\-=]\s*(https?:\/\/.+)\s*$/i;

    let soal = null, opsi = [], kunci = '', skor = 1, tipe = '', gform_url = '';

    function flush() {
        if (!soal || !soal.tanya.trim()) return;
        let t = tipe.toUpperCase().trim();
        if (!t) {
            if (opsi.length === 0) t = 'ESAI';
            else {
                const kArr = kunci.replace(/\s/g,'').split(',').filter(k=>k);
                t = kArr.length > 1 ? 'PGK' : 'PG';
            }
        }
        questions.push({
            exam_id: kodeUjian, tipe: t,
            tanya: soal.tanya.trim(),
            opsi_json: opsi.map(o=>o.text).join('|||'),
            kunci: kunci.trim().toUpperCase().replace(/\s+/g,''),
            skor: skor, gform_url: gform_url, media_path: gform_url
        });
        soal = null; opsi = []; kunci = ''; skor = 1; tipe = ''; gform_url = '';
    }

    for (const line of lines) {
        const mSoal  = line.match(rSoal);
        const mOpsi  = line.match(rOpsi);
        const mKunci = line.match(rKunci);
        const mTipe  = line.match(rTipe);
        const mSkor  = line.match(rSkor);
        const mGbr   = line.match(rGbr);

        if (mSoal)                                     { flush(); soal = { tanya: mSoal[2] }; }
        else if (mKunci && soal)                         kunci     = mKunci[1];
        else if (mTipe  && soal)                         tipe      = mTipe[1];
        else if (mSkor  && soal)                         skor      = parseFloat(mSkor[1].replace(',','.')) || 1;
        else if (mGbr   && soal)                         gform_url = mGbr[1];
        else if (mOpsi  && soal && !kunci)               opsi.push({ label: mOpsi[1].toUpperCase(), text: mOpsi[2].trim() });
        else if (soal && opsi.length===0 && !kunci && !mOpsi) soal.tanya += ' ' + line;
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
