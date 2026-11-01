// ============================================================
// MESIN PENILAIAN (SERVER-SIDE)
// Dipindahkan dari app.js lama (submitUjian & getLiveScore) agar:
//   1. Kunci jawaban TIDAK pernah dikirim ke browser siswa
//   2. Nilai tidak bisa dimanipulasi dari sisi siswa
// Logika perhitungan identik dengan versi sebelumnya.
// ============================================================

const ABJAD = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const MATRIX_TYPES = ['BS', 'TS', 'NK', 'SIFAT'];

const splitOpsi = q => (q.opsi_json ? String(q.opsi_json).split(/\|\|\|/).map(o => o.trim()).filter(o => o) : []);

// Jumlah pasangan menjodohkan (dipakai klien tanpa perlu tahu kunci)
function jodohPairCount(q) {
    if (q.kunci && String(q.kunci).trim()) return String(q.kunci).split(',').filter(x => x.trim()).length;
    const premises = String(q.tanya || '').split(/\r?\n|<br\s*\/?>/i).filter(l => /^\s*\d+[.)]\s?/.test(l));
    return premises.length || 4;
}

// Apakah sebuah jawaban dianggap "terjawab lengkap"
function isAnswered(q, ans) {
    const a = ans || '';
    if (a === '') return false;
    if (MATRIX_TYPES.includes(q.tipe)) return a.indexOf('-') === -1;
    if (q.tipe === 'JODOH') return a.split(',').filter(x => x).length >= jodohPairCount(q);
    return true;
}

function getFullAnswerText(q, rawAnswer, isKey) {
    if (!rawAnswer || rawAnswer === '-') return '-';
    rawAnswer = String(rawAnswer);
    const opsiArray = splitOpsi(q);
    if (q.tipe === 'PG') { const idx = ABJAD.indexOf(rawAnswer); return idx !== -1 && opsiArray[idx] ? `${rawAnswer}. ${opsiArray[idx]}` : rawAnswer; }
    if (q.tipe === 'PGK') {
        return rawAnswer.split(',').map(a => { const idx = ABJAD.indexOf(a); return idx !== -1 && opsiArray[idx] ? `${a}. ${opsiArray[idx]}` : a; }).join(', ');
    }
    if (q.tipe === 'JODOH') {
        return rawAnswer.split(',').map(a => {
            const num = a.replace(/[a-zA-Z]/g, ''); const letPart = a.replace(/[0-9]/g, '');
            const idx = ABJAD.indexOf(letPart.toUpperCase());
            return idx !== -1 && opsiArray[idx] ? `No.${num} -> ${opsiArray[idx]}` : a;
        }).join(' | ');
    }
    if (MATRIX_TYPES.includes(q.tipe)) {
        let hd = [];
        const hm = (opsiArray[0] || '').match(/^HEADER\[(.+)\]$/i);
        if (q.tipe === 'BS') hd = ['Benar', 'Salah'];
        else if (q.tipe === 'TS') hd = ['Sesuai', 'Tidak Sesuai'];
        else if (q.tipe === 'NK') hd = hm ? hm[1].split(',').map(h => h.trim()).filter(h => h) : ['Numerik', 'Kategorik'];
        else hd = hm ? hm[1].split(',').map(h => h.trim()).filter(h => h) : ['Sifat Komutatif', 'Sifat Asosiatif', 'Sifat Distributif'];
        let parts = rawAnswer.replace(/\s/g, '').toUpperCase().split(',');
        // Kunci BS/TS boleh ditulis notasi B/S (B=Benar, S=Salah) → konversi ke kolom A/B
        if (isKey && (q.tipe === 'BS' || q.tipe === 'TS') && parts.includes('S')) parts = parts.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k));
        return parts.map((a, i) => {
            const idx = ABJAD.indexOf(a);
            return (idx !== -1 && hd[idx]) ? `No.${i + 1}:${hd[idx]}` : `No.${i + 1}:-`;
        }).join(', ');
    }
    return rawAnswer;
}

// Nilai satu butir soal → { status, poin, maks, benar(bool|null) }
function scoreQuestion(q, ans) {
    ans = ans || '';
    const bobot = q.skor ? parseFloat(q.skor) || 1 : 1;
    const kunci = String(q.kunci || '');
    if (kunci.trim() === '' && q.tipe !== 'ISIAN' && q.tipe !== 'ESAI') {
        return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
    }
    if (q.tipe === 'PG') {
        const ok = ans && ans.replace(/\s/g, '').toLowerCase() === kunci.replace(/\s/g, '').toLowerCase();
        return ok ? { status: 'Benar', poin: bobot, maks: bobot, hit: true } : { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'PGK') {
        const kArr = kunci.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        const aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        if (!kArr.length) return { status: 'Salah', poin: 0, maks: 0, hit: false };
        let betul = 0, salah = 0; aArr.forEach(a => { if (kArr.includes(a)) betul++; else salah++; });
        const poin = Math.max(0, (betul - salah) * bobot), maks = bobot * kArr.length;
        if (betul === kArr.length && salah === 0) return { status: 'Benar', poin, maks, hit: true };
        if (poin > 0) return { status: `Sebagian Benar (${betul}/${kArr.length}${salah > 0 ? ', -' + salah + ' salah' : ''})`, poin, maks, hit: true };
        return { status: 'Salah' + (salah > 0 ? ` (-${salah} salah)` : ''), poin: 0, maks, hit: false };
    }
    if (MATRIX_TYPES.includes(q.tipe)) {
        let kArr = kunci.replace(/\s/g, '').toUpperCase().split(',').filter(x => x);
        if ((q.tipe === 'BS' || q.tipe === 'TS') && kArr.some(k => k === 'S')) kArr = kArr.map(k => k === 'B' ? 'A' : (k === 'S' ? 'B' : k));
        const aArr = ans.replace(/\s/g, '').toUpperCase().split(',');
        let cor = 0; for (let j = 0; j < kArr.length; j++) if (aArr[j] === kArr[j] && aArr[j] !== '-' && aArr[j] !== '') cor++;
        if (cor === kArr.length && kArr.length > 0) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (cor > 0) return { status: `Sebagian Benar (${cor}/${kArr.length})`, poin: (cor / kArr.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'JODOH') {
        const kArr = kunci.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        const aArr = ans.replace(/\s/g, '').toLowerCase().split(',').filter(x => x);
        let cor = 0; kArr.forEach(k => { if (aArr.includes(k)) cor++; });
        if (cor === kArr.length && kArr.length > 0) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (cor > 0) return { status: `Sebagian Benar (${cor}/${kArr.length})`, poin: (cor / kArr.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    if (q.tipe === 'ISIAN' || q.tipe === 'ESAI') {
        const kWords = kunci.toLowerCase().match(/[a-z0-9]+/gi) || [];
        if (!kWords.length) return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
        const aUnique = [...new Set(ans.toLowerCase().match(/[a-z0-9]+/gi) || [])];
        let m = 0; kWords.forEach(kw => { if (aUnique.includes(kw)) m++; });
        if (m === kWords.length) return { status: 'Benar', poin: bobot, maks: bobot, hit: true };
        if (m > 0) return { status: `Sebagian Benar (${m}/${kWords.length})`, poin: (m / kWords.length) * bobot, maks: bobot, hit: true };
        return { status: 'Salah', poin: 0, maks: bobot, hit: false };
    }
    return { status: 'Menunggu Koreksi', poin: 0, maks: 0, hit: null };
}

// answers: { [question_id]: "jawaban" }
function scoreExam(questions, answers) {
    answers = answers || {};
    if (questions.length > 0 && questions[0].tipe === 'GFORM') {
        return { nilai: 'Cek G-Form', benar: 0, salah: 0, detail: [], terjawab: questions.length, total: questions.length };
    }
    let benar = 0, salah = 0, maks = 0, dapat = 0, terjawab = 0;
    const detail = questions.map((q, i) => {
        const ans = answers[q.id] || '';
        if (isAnswered(q, ans)) terjawab++;
        const r = scoreQuestion(q, ans);
        maks += r.maks; dapat += r.poin;
        if (r.hit === true) benar++; else if (r.hit === false) salah++;
        return {
            no: i + 1, qid: q.id, tipe: q.tipe, tanya: q.tanya,
            jawab: getFullAnswerText(q, ans), kunci: getFullAnswerText(q, q.kunci, true),
            status: r.status, poin: Math.round(r.poin * 100) / 100,
        };
    });
    const nilai = maks > 0 ? Math.round((dapat / maks) * 100) : 0;
    return { nilai, benar, salah, detail, terjawab, total: questions.length };
}

// Versi soal yang aman dikirim ke siswa (tanpa kunci)
function sanitizeQuestion(q) {
    const out = { id: q.id, exam_id: q.exam_id, tipe: q.tipe, tanya: q.tanya, opsi_json: q.opsi_json, media_path: q.media_path, gform_url: q.gform_url, skor: q.skor };
    if (q.tipe === 'JODOH') out.pair_count = jodohPairCount(q);
    return out;
}

module.exports = { scoreExam, scoreQuestion, isAnswered, getFullAnswerText, sanitizeQuestion, jodohPairCount };
