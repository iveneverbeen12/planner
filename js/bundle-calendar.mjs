/**
 * Собирает один файл js/app.bundle.js без ES modules — его можно подключать
 * из moy-kalendar.html при открытии через file:// (двойной клик).
 * Запуск: node js/bundle-calendar.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILES = [
    'constants.js',
    'html-utils.js',
    'state.js',
    'datetime.js',
    'occurrence.js',
    'toast.js',
    'event-times.js',
    'events-cache.js',
    'event-types.js',
    'pwa.js',
    'persistence.js',
    'theme.js',
    'reminders.js',
    'calendar-app.js'
];

function stripImports(code) {
    return code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;\s*/g, '');
}

function stripExports(code) {
    return code.replace(/^export\s+/gm, '');
}

function transformFile(src, filename) {
    let out = stripImports(src);
    out = stripExports(out);
    return `/* --- ${filename} --- */\n${out.trim()}\n`;
}

const parts = [];
parts.push('/* Сгенерировано bundle-calendar.mjs — не править вручную */\n');
parts.push('(function () {\n');
parts.push('"use strict";\n');

for (const f of FILES) {
    const p = path.join(__dirname, f);
    parts.push(transformFile(fs.readFileSync(p, 'utf8'), f));
}

let main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
main = stripImports(main);
parts.push('/* --- main.js --- */\n');
parts.push(main.trim());
parts.push('\n})();\n');

const outPath = path.join(__dirname, 'app.bundle.js');
fs.writeFileSync(outPath, parts.join(''), 'utf8');
console.log('OK:', outPath);
