// Konfigurasi Tailwind — jalankan `npm run build:css` setiap kali
// menambah/mengubah class Tailwind di index.html atau js/*.js
module.exports = {
    content: ['./index.html', './js/**/*.js'],
    theme: { extend: {
        fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
        colors: {
            navy: { DEFAULT: '#14306B', 50: '#EEF2FA', 100: '#DCE4F4', 600: '#1C3F87', 700: '#14306B', 800: '#10275A', 900: '#0E1E3D' },
            gold: { DEFAULT: '#D9A21B', 50: '#FDF7E6', 100: '#FBEFC9', 600: '#B9860F', 700: '#8F6609' },
            ink: '#0E1E3D', paper: '#F3F5F9', line: '#DCE2EC', muted: '#5B6B86',
            ok: { DEFAULT: '#1F8A5B', 50: '#E8F5EE' }, bad: { DEFAULT: '#B42318', 50: '#FDECEA' },
        },
    } },
};
