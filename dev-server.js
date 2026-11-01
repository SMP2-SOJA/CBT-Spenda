// ============================================================
// SERVER PENGEMBANGAN LOKAL
//   npm run dev            → pakai Supabase asli (butuh SUPABASE_URL/KEY atau default)
//   MOCK_DB=1 npm run dev  → pakai database tiruan di memori (dev/seed.json)
// Buka http://localhost:3000
// ============================================================
const path = require('path');
const Module = require('module');

if (process.env.MOCK_DB === '1') {
    const mockPath = path.join(__dirname, 'dev', 'mock-supabase.js');
    const orig = Module._resolveFilename;
    Module._resolveFilename = function (req, ...rest) {
        if (req === '@supabase/supabase-js') return mockPath;
        return orig.call(this, req, ...rest);
    };
    console.log('[dev] Menggunakan MOCK database (dev/seed.json)');
}

const express = require('express');
const app = require('./server');
const root = express();
root.use(app);
root.use(express.static(__dirname, { index: 'index.html' }));
root.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
root.listen(PORT, () => console.log(`[dev] CBT berjalan di http://localhost:${PORT}`));
