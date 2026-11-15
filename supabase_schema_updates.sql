-- Add mapel_detail column to users table to store "MTK-7A,IPA-7B" format
ALTER TABLE users ADD COLUMN IF NOT EXISTS mapel_detail text DEFAULT '';

-- This column stores the mapping for easier querying and display
-- When a guru is assigned "MTK-7A,IPA-7B", it's stored as-is in mapel_detail
-- While mapel="MTK,IPA" and kelas_akses="7A,7B" are auto-extracted for filtering
