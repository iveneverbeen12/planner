import { state } from './state.js';
import { savePlannerSettings } from './persistence.js';

export function initializeTailwind() {
    document.documentElement.style.setProperty('--accent', '#6366f1');
}

export function getColorThemeMode() {
    var m = state.plannerSettings.colorTheme;
    if (m === 'light' || m === 'dark' || m === 'system') return m;
    return 'system';
}

export function isDarkEffective() {
    var mode = getColorThemeMode();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
        return false;
    }
}

export function applyColorTheme() {
    var dark = isDarkEffective();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

let themeMediaListenerAttached = false;
export function attachThemeMediaListener() {
    if (themeMediaListenerAttached) return;
    themeMediaListenerAttached = true;
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (getColorThemeMode() === 'system') applyColorTheme();
        });
    } catch (e) {}
}

export function setPlannerColorTheme(mode) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    state.plannerSettings.colorTheme = mode;
    savePlannerSettings();
    applyColorTheme();
    updateThemeControlUI();
}

export function updateThemeControlUI() {
    var mode = getColorThemeMode();
    var rows = [
        ['theme-btn-light', 'settings-theme-light', 'light'],
        ['theme-btn-dark', 'settings-theme-dark', 'dark'],
        ['theme-btn-system', 'settings-theme-system', 'system']
    ];
    rows.forEach(function (row) {
        var on = mode === row[2];
        for (var i = 0; i < 2; i++) {
            var el = document.getElementById(row[i]);
            if (!el) continue;
            el.setAttribute('aria-pressed', on ? 'true' : 'false');
            el.classList.toggle('bg-white', on);
            el.classList.toggle('dark:bg-slate-700', on);
            el.classList.toggle('shadow-sm', on);
            el.classList.toggle('text-indigo-700', on);
            el.classList.toggle('dark:text-indigo-300', on);
            el.classList.toggle('font-semibold', on);
            el.classList.toggle('text-slate-600', !on);
            el.classList.toggle('dark:text-slate-400', !on);
            el.classList.toggle('font-medium', !on);
        }
    });
}
