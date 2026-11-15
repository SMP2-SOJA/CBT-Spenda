-- ================================================================
-- SPENDA-DIGI CBT — DATABASE SCHEMA
-- Jalankan SEMUA perintah ini di Supabase SQL Editor
-- Cara: Buka Supabase → SQL Editor → New Query → Paste → Run
-- ================================================================

-- 1. TABEL PENGGUNA (siswa, guru, admin)
CREATE TABLE IF NOT EXISTS users (
    id           bigserial PRIMARY KEY,
    username     text UNIQUE NOT NULL,
    password     text NOT NULL,
    name         text NOT NULL DEFAULT '',
    role         text NOT NULL DEFAULT 'siswa',
    kelas        text DEFAULT '',
    mapel        text DEFAULT '',
    kelas_akses  text DEFAULT '',
    mapel_detail text DEFAULT '',
    created_at   timestamptz DEFAULT now()
);

-- 2. TABEL BANK SOAL
CREATE TABLE IF NOT EXISTS questions (
    id         bigserial PRIMARY KEY,
    exam_id    text NOT NULL,
    tipe       text NOT NULL DEFAULT 'PG',
    tanya      text NOT NULL DEFAULT '',
    opsi_json  text DEFAULT '',
    kunci      text DEFAULT '',
    media_path text DEFAULT '',
    gform_url  text DEFAULT '',
    skor       numeric DEFAULT 1,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);

-- 3. TABEL JADWAL UJIAN & PIN
CREATE TABLE IF NOT EXISTS schedules (
    id      bigserial PRIMARY KEY,
    mapel   text NOT NULL,
    pin     text UNIQUE NOT NULL,
    tanggal text DEFAULT '',
    durasi  integer DEFAULT 90,
    status  text DEFAULT 'Aktif',
    kelas   text DEFAULT ''
);

-- 4. TABEL MONITORING LIVE (aktivitas ujian)
CREATE TABLE IF NOT EXISTS activity (
    id           bigserial PRIMARY KEY,
    student_name text NOT NULL,
    exam_name    text NOT NULL,
    kelas        text DEFAULT '-',
    status       text DEFAULT 'Mengerjakan',
    score        numeric DEFAULT 0,
    last_seen    text DEFAULT '',
    CONSTRAINT activity_unique UNIQUE (student_name, exam_name)
);

-- 5. TABEL HASIL NILAI
CREATE TABLE IF NOT EXISTS results (
    id             bigserial PRIMARY KEY,
    student_name   text NOT NULL,
    mapel          text NOT NULL,
    kelas          text DEFAULT '-',
    nilai          numeric DEFAULT 0,
    benar          integer DEFAULT 0,
    salah          integer DEFAULT 0,
    detail_jawaban text DEFAULT '[]',
    tanggal        text DEFAULT '',
    created_at     timestamptz DEFAULT now()
);

-- 6. AKUN ADMIN DEFAULT (GANTI PASSWORD SETELAH LOGIN PERTAMA!)
INSERT INTO users (username, password, name, role, kelas, mapel)
VALUES ('admin', 'Admin123', 'Administrator', 'admin', 'Admin', 'Semua')
ON CONFLICT (username) DO NOTHING;

-- Selesai! Cek di Table Editor: harus ada 5 tabel.
