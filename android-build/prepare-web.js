// Copies the website files into www/ (the folder the Android app packages). Skips the service worker and build files.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
['index.html', 'manifest.webmanifest'].forEach(f => fs.copyFileSync(path.join(root, f), path.join(out, f)));
['css', 'js', 'data', 'fonts', 'icons', 'pdfs'].forEach(d => { const s = path.join(root, d); if (fs.existsSync(s)) { fs.cpSync(s, path.join(out, d), { recursive: true }); } });
console.log('www ready:', fs.readdirSync(out).join(', '));
