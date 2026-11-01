-- ============================================================
-- MIGRASI OPSIONAL CBT v4 — jalankan sekali di Supabase:
-- Dashboard Supabase → SQL Editor → New query → tempel → Run
-- Aplikasi tetap berjalan tanpa migrasi ini; migrasi hanya
-- mengaktifkan fitur "acak soal/opsi" dan kolom kelas pada nilai.
-- ============================================================
alter table schedules add column if not exists acak_soal boolean default false;
alter table schedules add column if not exists acak_opsi boolean default false;
alter table results   add column if not exists kelas text;
alter table activity  add column if not exists kelas text;

-- Mencegah data ganda per siswa per paket (dibutuhkan upsert aktivitas)
create unique index if not exists activity_student_exam_uniq on activity (student_name, exam_name);

-- Profil sekolah & logo (fitur "Profil sekolah" / kop surat)
create table if not exists config (
    key   text primary key,
    value text
);
