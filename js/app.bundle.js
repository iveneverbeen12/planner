/* Сгенерировано bundle-calendar.mjs — не править вручную */
(function () {
"use strict";
/* --- constants.js --- */
const SETTINGS_KEY = 'plannerSettings';
const REMINDER_FIRED_KEY = 'plannerReminderFired';
const CUSTOM_TYPES_KEY = 'plannerCustomTypes';

const BUILTIN_TYPES = {
    work: {
        label: 'Работа',
        color: 'bg-sky-600',
        textColor: 'text-sky-700',
        dot: 'bg-sky-600',
        bgLight: 'bg-sky-50',
        icon: 'fa-briefcase'
    },
    family: {
        label: 'Семья',
        color: 'bg-rose-500',
        textColor: 'text-rose-700',
        dot: 'bg-rose-500',
        bgLight: 'bg-rose-50',
        icon: 'fa-users'
    },
    sport: {
        label: 'Спорт',
        color: 'bg-emerald-600',
        textColor: 'text-emerald-700',
        dot: 'bg-emerald-600',
        bgLight: 'bg-emerald-50',
        icon: 'fa-person-running'
    }
};

const LEGACY_TYPE_MAP = {
    important: 'work',
    reminder: 'family',
    study: 'sport',
    masha: 'family',
    stas: 'sport'
};

/** Кэш повторов: разворачиваем события не дальше этого горизонта (дней от сегодня). */
const CACHE_HORIZON_DAYS = 800;

const ALL_EVENTS_PAGE_SIZE = 50;
/* --- html-utils.js --- */
function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
/* --- state.js --- */
const state = {
    events: [],
    /** @type {Map<string, import('./event-types.js').PlannerEvent[]>} */
    eventsByDay: new Map(),
    customTypes: [],
    currentDate: new Date(),
    selectedDate: null,
    currentFilter: 'all',
    allEventsSearch: '',
    allEventsPage: 0,
    editingEventId: null,
    eventAttachmentsDraft: [],
    plannerView: 'month',
    plannerSettings: {
        notificationsEnabled: true,
        reminderCheckIntervalSec: 30,
        defaultReminderMinutes: '',
        colorTheme: 'system'
    },
    /** Снимок формы при открытии модалки (JSON.stringify), для проверки «есть несохранённые изменения». */
    eventFormBaseline: null
};
/* --- datetime.js --- */
function ymd(d) {
    return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
}

function compareYmd(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

function nextYmd(ds) {
    const p = ds.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + 1);
    return ymd(d);
}

function addDaysYmd(ds, n) {
    const p = ds.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return ymd(d);
}

function weekdayFromYmd(dateStr) {
    const p = dateStr.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getDay();
}

function startOfWeekMonday(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const wd = x.getDay();
    const diff = wd === 0 ? -6 : 1 - wd;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** Последний день (воскресенье) недели с понедельника, где лежит dateStr. */
function sundayOfCalendarWeekContaining(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const mon = startOfWeekMonday(d);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return ymd(sun);
}
/* --- occurrence.js --- */
function hasRecurrence(ev) {
    return Array.isArray(ev.repeatWeekdays) && ev.repeatWeekdays.length > 0;
}

function eventOccursOnDate(ev, dateStr) {
    if (!dateStr || !ev || !ev.date) return false;
    if (hasRecurrence(ev)) {
        if (dateStr < ev.date) return false;
        if (ev.repeatUntil && dateStr > ev.repeatUntil) return false;
        const wd = weekdayFromYmd(dateStr);
        return ev.repeatWeekdays.indexOf(wd) >= 0;
    }
    return ev.date === dateStr;
}
/* --- toast.js --- */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className =
        'fixed bottom-6 right-6 bg-slate-900 dark:bg-indigo-950 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-x-3 z-[200] text-sm font-medium max-w-sm border border-slate-700 dark:border-indigo-800';
    toast.innerHTML = '<i class="fas fa-check-circle text-emerald-400 flex-shrink-0"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 2600);
}
/* --- event-times.js --- */
function getEventStartMs(ev) {
    const parts = ev.date.split('-').map(Number);
    if (!parts[0]) return null;
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (ev.time && String(ev.time).trim().length >= 4) {
        const t = String(ev.time).split(':');
        const hh = parseInt(t[0], 10) || 0;
        const mm = parseInt(t[1], 10) || 0;
        return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
    }
    return new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
}

function getEventStartMsForDate(ev, dateStr) {
    const parts = dateStr.split('-').map(Number);
    if (!parts[0]) return null;
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (ev.time && String(ev.time).trim().length >= 4) {
        const t = String(ev.time).split(':');
        const hh = parseInt(t[0], 10) || 0;
        const mm = parseInt(t[1], 10) || 0;
        return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
    }
    return new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
}

function parseReminderMinutes(val) {
    if (val === '' || val == null) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

function formatReminderBody(ev, occurrenceDateStr) {
    const datePart = occurrenceDateStr || ev.date;
    const t = ev.time ? ev.time : 'весь день (9:00)';
    const dt = new Date(datePart + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return dt + (ev.time ? ', ' + t : '') + (ev.desc ? ' — ' + ev.desc.slice(0, 80) : '');
}
/* --- events-cache.js --- */
function pushDay(map, dateStr, ev) {
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push(ev);
}

/**
 * Перестраивает Map дата → события для быстрого рендера календаря.
 * Повторы без repeatUntil разворачиваются до CACHE_HORIZON_DAYS от сегодня.
 */
function rebuildEventsDayCache() {
    const map = new Map();
    const today = ymd(new Date());
    const horizonEnd = addDaysYmd(today, CACHE_HORIZON_DAYS);

    state.events.forEach(function (ev) {
        if (!hasRecurrence(ev)) {
            pushDay(map, ev.date, ev);
            return;
        }
        let end = ev.repeatUntil;
        if (!end || compareYmd(end, horizonEnd) > 0) end = horizonEnd;
        let ds = ev.date;
        if (compareYmd(ds, end) > 0) return;
        while (compareYmd(ds, end) <= 0) {
            if (eventOccursOnDate(ev, ds)) pushDay(map, ds, ev);
            ds = nextYmd(ds);
        }
    });

    state.eventsByDay = map;
}

/**
 * События на календарный день (из кэша; при промахе — линейный проход).
 */
function getEventsForDate(dateStr) {
    if (state.eventsByDay.has(dateStr)) return state.eventsByDay.get(dateStr).slice();

    const out = [];
    state.events.forEach(function (e) {
        if (eventOccursOnDate(e, dateStr)) out.push(e);
    });
    return out;
}
/* --- event-types.js --- */
function hexToRgb(hex) {
    const h = String(hex || '')
        .replace('#', '')
        .trim();
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16)
        };
    }
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'rgba(148,163,184,' + alpha + ')';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
}

function loadCustomTypes() {
    try {
        const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
        if (raw) state.customTypes = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(state.customTypes)) state.customTypes = [];
    state.customTypes = state.customTypes.filter(function (x) {
        return (
            x &&
            typeof x.id === 'string' &&
            x.id.indexOf('custom_') === 0 &&
            typeof x.name === 'string' &&
            typeof x.colorHex === 'string'
        );
    });
}

function saveCustomTypes() {
    localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(state.customTypes));
}

function getCustomTypeById(id) {
    for (let i = 0; i < state.customTypes.length; i++) {
        if (state.customTypes[i].id === id) return state.customTypes[i];
    }
    return null;
}

function normalizeEventType(key) {
    if (!key || typeof key !== 'string') return 'work';
    if (key.indexOf('custom_') === 0) return getCustomTypeById(key) ? key : 'work';
    if (BUILTIN_TYPES[key]) return key;
    if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
    return 'work';
}

/** @returns {boolean} */
function migrateEventsTypes() {
    let changed = false;
    state.events.forEach(function (e) {
        const n = normalizeEventType(e.type);
        if (e.type !== n) {
            e.type = n;
            changed = true;
        }
    });
    return changed;
}

function getEventTypeStyle(typeKey) {
    const key = normalizeEventType(typeKey);
    if (key.indexOf('custom_') === 0) {
        const ct = getCustomTypeById(key);
        const hex = ct && ct.colorHex ? ct.colorHex : '#64748b';
        const label = ct && ct.name ? ct.name : 'Свой тип';
        return {
            label: label,
            isCustom: true,
            hex: hex,
            iconClass: 'fa-tag',
            colorClass: '',
            dotClass: '',
            bgLightClass: '',
            textColorClass: ''
        };
    }
    const b = BUILTIN_TYPES[key];
    return {
        label: b.label,
        isCustom: false,
        hex: null,
        iconClass: b.icon,
        colorClass: b.color,
        dotClass: b.dot,
        bgLightClass: b.bgLight,
        textColorClass: b.textColor
    };
}

function generateCustomTypeId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}
/* --- pwa.js --- */
const PLANNER_CACHE_NAME = 'planner-assets-v1';

function snapshotUrl() {
    return new URL('planner-snapshot.json', window.location.href).href;
}

function swFiredPatchUrl() {
    return new URL('reminder-fired-sw.json', window.location.href).href;
}

/**
 * Кладёт события и настройки в Cache API — service worker читает их без localStorage.
 */
async function notifyPlannerDataChanged() {
    if (typeof caches === 'undefined') return;
    try {
        const payload = JSON.stringify({
            events: state.events,
            plannerSettings: state.plannerSettings,
            reminderFiredRaw: localStorage.getItem(REMINDER_FIRED_KEY) || '[]'
        });
        const cache = await caches.open(PLANNER_CACHE_NAME);
        await cache.put(snapshotUrl(), new Response(payload, { headers: { 'Content-Type': 'application/json' } }));
        await registerBackgroundReminderJobs();
    } catch (e) {}
}

async function registerBackgroundReminderJobs() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        if ('sync' in reg && state.plannerSettings.notificationsEnabled) {
            await reg.sync.register('reminder-sync');
        }
    } catch (e) {}
    try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg && state.plannerSettings.notificationsEnabled) {
            await reg.periodicSync.register('reminder-periodic', { minInterval: 60 * 1000 });
        }
    } catch (e) {}
}

async function mergeSwFiredIntoStorage() {
    if (typeof caches === 'undefined') return;
    try {
        const cache = await caches.open(PLANNER_CACHE_NAME);
        const res = await cache.match(swFiredPatchUrl());
        if (!res) return;
        const patch = await res.json();
        const keys = Array.isArray(patch.keys) ? patch.keys : [];
        if (keys.length === 0) return;
        let existing = [];
        try {
            existing = JSON.parse(localStorage.getItem(REMINDER_FIRED_KEY) || '[]');
        } catch (e) {}
        const set = new Set(existing);
        keys.forEach(function (k) {
            set.add(k);
        });
        const merged = Array.from(set);
        while (merged.length > 400) merged.shift();
        localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify(merged));
        await cache.delete(swFiredPatchUrl());
    } catch (e) {}
}

async function initPwa() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
    }

    try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        if (reg.installing) {
            reg.installing.addEventListener('statechange', function () {
                if (reg.installing.state === 'installed' && navigator.serviceWorker.controller) {
                    notifyPlannerDataChanged();
                }
            });
        }
    } catch (e) {
        return;
    }

    await notifyPlannerDataChanged();

    window.addEventListener('online', function () {
        notifyPlannerDataChanged();
    });

    navigator.serviceWorker.addEventListener('message', function (ev) {
        if (ev.data && ev.data.type === 'REMINDERS_FIRED_UPDATE') {
            mergeSwFiredIntoStorage();
        }
    });
}
/* --- persistence.js --- */
function loadPlannerSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) Object.assign(state.plannerSettings, JSON.parse(raw));
    } catch (e) {}
    if (typeof state.plannerSettings.notificationsEnabled !== 'boolean') state.plannerSettings.notificationsEnabled = true;
    if (typeof state.plannerSettings.reminderCheckIntervalSec !== 'number' || isNaN(state.plannerSettings.reminderCheckIntervalSec)) {
        state.plannerSettings.reminderCheckIntervalSec = 30;
    }
    state.plannerSettings.reminderCheckIntervalSec = Math.min(600, Math.max(10, state.plannerSettings.reminderCheckIntervalSec));
    var allowedDr = ['', '0', '5', '15', '30', '60', '120', '1440'];
    if (state.plannerSettings.defaultReminderMinutes === undefined || state.plannerSettings.defaultReminderMinutes === null) {
        state.plannerSettings.defaultReminderMinutes = '';
    }
    var drs = String(state.plannerSettings.defaultReminderMinutes);
    if (allowedDr.indexOf(drs) === -1) state.plannerSettings.defaultReminderMinutes = '';
    if (
        state.plannerSettings.colorTheme !== 'light' &&
        state.plannerSettings.colorTheme !== 'dark' &&
        state.plannerSettings.colorTheme !== 'system'
    ) {
        state.plannerSettings.colorTheme = 'system';
    }
}

function savePlannerSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.plannerSettings));
    notifyPlannerDataChanged();
}

function loadEvents() {
    loadCustomTypes();
    const saved = localStorage.getItem('calendarEvents');
    if (saved) {
        state.events = JSON.parse(saved);
        state.events.forEach(function (e) {
            if (e.reminderMinutes === undefined) e.reminderMinutes = null;
            if (!Array.isArray(e.attachments)) e.attachments = [];
            if (e.repeatWeekdays != null && !Array.isArray(e.repeatWeekdays)) e.repeatWeekdays = null;
            if (e.repeatUntil != null && typeof e.repeatUntil !== 'string') e.repeatUntil = null;
        });
        if (migrateEventsTypes()) saveEventsToStorage();
    } else {
        // Демо-данные (раскомментировать для первоначального заполнения):
        // state.events = [
        //     { id: 'demo-1', date: '2026-05-05', title: 'Встреча с клиентом', type: 'work', time: '14:00', desc: 'Обсудить новый проект', reminderMinutes: 15 },
        //     { id: 'demo-2', date: '2026-05-08', title: 'День рождения мамы', type: 'family', time: '', desc: 'Не забыть подарок!', reminderMinutes: 1440 },
        //     { id: 'demo-3', date: '2026-05-12', title: 'Прогулка с детьми', type: 'family', time: '08:30', desc: '', reminderMinutes: 5 },
        //     { id: 'demo-4', date: '2026-05-15', title: 'Отчёт по проекту', type: 'work', time: '17:00', desc: 'Сдать финальную версию', reminderMinutes: 60 },
        //     { id: 'demo-5', date: '2026-05-07', title: 'Тренировка в зале', type: 'sport', time: '09:00', desc: '', reminderMinutes: 30 },
        //     { id: 'demo-6', date: '2026-05-10', title: 'Йога', type: 'sport', time: '19:30', desc: '', reminderMinutes: null },
        //     { id: 'demo-7', date: '2026-05-18', title: 'Футбол', type: 'sport', time: '16:00', desc: '', reminderMinutes: 60 }
        // ];
        state.events = [];
        saveEventsToStorage();
    }
    rebuildEventsDayCache();
    notifyPlannerDataChanged();
}

function saveEventsToStorage() {
    localStorage.setItem('calendarEvents', JSON.stringify(state.events));
}

function saveEvents() {
    saveEventsToStorage();
    rebuildEventsDayCache();
    notifyPlannerDataChanged();
}
/* --- theme.js --- */
function initializeTailwind() {
    document.documentElement.style.setProperty('--accent', '#6366f1');
}

function getColorThemeMode() {
    var m = state.plannerSettings.colorTheme;
    if (m === 'light' || m === 'dark' || m === 'system') return m;
    return 'system';
}

function isDarkEffective() {
    var mode = getColorThemeMode();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
        return false;
    }
}

function applyColorTheme() {
    var dark = isDarkEffective();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

let themeMediaListenerAttached = false;
function attachThemeMediaListener() {
    if (themeMediaListenerAttached) return;
    themeMediaListenerAttached = true;
    try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (getColorThemeMode() === 'system') applyColorTheme();
        });
    } catch (e) {}
}

function setPlannerColorTheme(mode) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    state.plannerSettings.colorTheme = mode;
    savePlannerSettings();
    applyColorTheme();
    updateThemeControlUI();
}

function updateThemeControlUI() {
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
/* --- reminders.js --- */
function getReminderFiredSet() {
    try {
        const raw = localStorage.getItem(REMINDER_FIRED_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set();
}

function persistReminderFired(set) {
    const arr = Array.from(set);
    while (arr.length > 400) arr.shift();
    localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify(arr));
}

function clearReminderFiredForEvent(eventId) {
    const set = getReminderFiredSet();
    Array.from(set).forEach(function (k) {
        if (k.indexOf(eventId + '|') === 0) set.delete(k);
    });
    persistReminderFired(set);
}

let reminderCheckTimer = null;

function scheduleReminderChecks() {
    if (reminderCheckTimer !== null) {
        clearInterval(reminderCheckTimer);
        reminderCheckTimer = null;
    }
    var sec = Number(state.plannerSettings.reminderCheckIntervalSec);
    if (isNaN(sec)) sec = 30;
    sec = Math.min(600, Math.max(10, sec));
    reminderCheckTimer = setInterval(checkReminders, sec * 1000);
}

/** Устанавливается из calendar-app */
let updateSettingsUICallback = function () {};

function registerUpdateSettingsUI(fn) {
    updateSettingsUICallback = fn;
}

function setPlannerReminderIntervalSec(secVal) {
    var n = parseInt(secVal, 10);
    if (isNaN(n)) n = 30;
    state.plannerSettings.reminderCheckIntervalSec = Math.min(600, Math.max(10, n));
    savePlannerSettings();
    scheduleReminderChecks();
    updateSettingsUICallback();
}

function setPlannerDefaultReminderMinutes(val) {
    var allowed = ['', '0', '5', '15', '30', '60', '120', '1440'];
    var str = val === null || val === undefined ? '' : String(val);
    state.plannerSettings.defaultReminderMinutes = allowed.indexOf(str) >= 0 ? str : '';
    savePlannerSettings();
    updateSettingsUICallback();
}

function checkReminders() {
    if (!state.plannerSettings.notificationsEnabled) return;
    const now = Date.now();
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const fired = getReminderFiredSet();
    const todayStr = ymd(new Date());
    var firedDirty = false;

    state.events.forEach(function (ev) {
        const rm = ev.reminderMinutes;
        if (rm === undefined || rm === null || rm === '') return;
        const minutes = Number(rm);
        if (isNaN(minutes)) return;

        if (!eventOccursOnDate(ev, todayStr)) return;

        const startMs = getEventStartMsForDate(ev, todayStr);
        if (!startMs) return;

        const triggerMs = startMs - minutes * 60 * 1000;
        const key = ev.id + '|' + todayStr + '|' + triggerMs;
        if (fired.has(key)) return;

        if (now < triggerMs) return;

        const late = now - triggerMs;
        if (late > 30 * 60 * 1000) return;

        if (now > startMs + 2 * 60 * 60 * 1000) return;

        fired.add(key);
        persistReminderFired(fired);
        firedDirty = true;

        const title = ev.title || 'Событие';
        const body = formatReminderBody(ev, todayStr);

        if (permission === 'granted') {
            try {
                new Notification('Напоминание: ' + title, {
                    body: body,
                    tag: key,
                    silent: false
                });
            } catch (e) {}
        }
        showToast('Напоминание: ' + title);
    });

    if (firedDirty) notifyPlannerDataChanged();
}
/* --- calendar-app.js --- */
function hideNewCustomPanel() {
    const panel = document.getElementById('new-custom-type-panel');
    if (panel) panel.classList.add('hidden');
}

function ensureNewCustomTypePanel() {
    const anchor = document.getElementById('type-buttons');
    if (!anchor || document.getElementById('new-custom-type-panel')) return;
    const wrap = anchor.parentElement;
    if (!wrap) return;
    const panel = document.createElement('div');
    panel.id = 'new-custom-type-panel';
    panel.className =
        'hidden mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 space-y-3';
    panel.innerHTML =
        '<p class="text-xs text-slate-600 dark:text-slate-400 font-medium">Новая категория</p>' +
        '<div class="grid grid-cols-1 gap-3">' +
        '<div><label class="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Название</label>' +
        '<input type="text" id="new-custom-type-name" class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" placeholder="Например: Хобби" maxlength="40"></div>' +
        '<div><label class="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Цвет</label>' +
        '<input type="color" id="new-custom-type-color" value="#6366f1" class="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer bg-white dark:bg-slate-800"></div></div>' +
        '<div class="flex gap-2">' +
        '<button type="button" id="btn-create-custom-type" class="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Создать</button>' +
        '<button type="button" id="btn-cancel-custom-type" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700">Отмена</button></div>';
    wrap.appendChild(panel);
    document.getElementById('btn-create-custom-type').onclick = function () {
        createCustomTypeFromPanel();
    };
    document.getElementById('btn-cancel-custom-type').onclick = function () {
        hideNewCustomPanel();
    };
}

function toggleNewCustomPanel() {
    ensureNewCustomTypePanel();
    const panel = document.getElementById('new-custom-type-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        const nameInput = document.getElementById('new-custom-type-name');
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
        const c = document.getElementById('new-custom-type-color');
        if (c) c.value = '#6366f1';
    }
}

function createCustomTypeFromPanel() {
    const nameEl = document.getElementById('new-custom-type-name');
    const colorEl = document.getElementById('new-custom-type-color');
    const name = nameEl ? nameEl.value.trim() : '';
    const colorHex = colorEl && colorEl.value ? colorEl.value : '#6366f1';
    if (!name) {
        alert('Введите название категории');
        return;
    }
    const id = generateCustomTypeId();
    state.customTypes.push({ id: id, name: name, colorHex: colorHex });
    saveCustomTypes();
    hideNewCustomPanel();
    renderEventTypePicker(id);
    renderTypesLegend();
    renderCustomTypesManager();
    renderAllEventsFilterButtons();
    showToast('Категория создана');
}

function applyBuiltinTitleForSelectedType() {
    if (state.editingEventId !== null) return;
    const container = document.getElementById('type-buttons');
    const titleInput = document.getElementById('event-title');
    if (!container || !titleInput) return;
    const typeKey = normalizeEventType(container.dataset.selectedType || 'work');
    const cfg = BUILTIN_TYPES[typeKey];
    if (cfg) titleInput.value = cfg.label;
}

function renderEventTypePicker(selectedType) {
    selectedType = normalizeEventType(selectedType);
    const container = document.getElementById('type-buttons');
    if (!container) return;
    container.className = 'flex flex-wrap gap-2';
    container.innerHTML = '';
    container.dataset.selectedType = selectedType;

    function selectBtn(btn, typeKey) {
        container.querySelectorAll('[data-type-key]').forEach(function (b) {
            b.classList.remove('border-indigo-500', 'bg-indigo-50', 'ring-1', 'ring-indigo-500', 'dark:bg-indigo-950/40');
            b.classList.add('border-slate-200', 'dark:border-slate-600');
            const sp = b.querySelector('span:last-child');
            if (sp) sp.classList.remove('text-indigo-700', 'dark:text-indigo-300');
            if (sp) sp.classList.add('text-slate-600', 'dark:text-slate-400');
        });
        btn.classList.add('border-indigo-500', 'bg-indigo-50', 'ring-1', 'ring-indigo-500', 'dark:bg-indigo-950/40');
        btn.classList.remove('border-slate-200', 'dark:border-slate-600');
        const sp = btn.querySelector('span:last-child');
        if (sp) {
            sp.classList.add('text-indigo-700', 'dark:text-indigo-300');
            sp.classList.remove('text-slate-600', 'dark:text-slate-400');
        }
        container.dataset.selectedType = typeKey;
        applyBuiltinTitleForSelectedType();
    }

    Object.keys(BUILTIN_TYPES).forEach(function (typeKey) {
        const config = BUILTIN_TYPES[typeKey];
        const isSelected = selectedType === typeKey;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.typeKey = typeKey;
        btn.className =
            'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-xs font-medium min-w-[92px] ' +
            (isSelected
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500');
        btn.innerHTML =
            '<div class="w-6 h-6 rounded-xl ' +
            config.color +
            ' mb-1 flex items-center justify-center"><i class="fas ' +
            config.icon +
            ' text-white text-[10px]"></i></div><span class="' +
            (isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400') +
            '">' +
            escapeHtml(config.label) +
            '</span>';
        btn.onclick = function () {
            selectBtn(btn, typeKey);
            hideNewCustomPanel();
        };
        if (isSelected) container.dataset.selectedType = typeKey;
        container.appendChild(btn);
    });

    state.customTypes.forEach(function (ct) {
        const tid = ct.id;
        const isSelected = selectedType === tid;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.typeKey = tid;
        btn.className =
            'flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-xs font-medium min-w-[92px] ' +
            (isSelected
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500');
        btn.innerHTML =
            '<div class="w-6 h-6 rounded-xl mb-1 flex items-center justify-center text-white text-[10px]" style="background-color:' +
            escapeHtml(ct.colorHex) +
            '"><i class="fas fa-tag"></i></div><span class="' +
            (isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400') +
            ' max-w-[104px] truncate">' +
            escapeHtml(ct.name) +
            '</span>';
        btn.onclick = function () {
            selectBtn(btn, tid);
            hideNewCustomPanel();
        };
        if (isSelected) container.dataset.selectedType = tid;
        container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className =
        'flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium min-w-[92px]';
    addBtn.innerHTML =
        '<div class="w-6 h-6 rounded-xl bg-slate-100 dark:bg-slate-700 mb-1 flex items-center justify-center"><i class="fas fa-plus text-[10px]"></i></div><span>Свой тип</span>';
    addBtn.onclick = function () {
        toggleNewCustomPanel();
    };
    container.appendChild(addBtn);

    ensureNewCustomTypePanel();
    applyBuiltinTitleForSelectedType();
}

function renderTypesLegend() {
    const root = document.getElementById('types-legend-root');
    if (!root) return;
    root.innerHTML = '';
    Object.keys(BUILTIN_TYPES).forEach(function (k) {
        const b = BUILTIN_TYPES[k];
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML =
            '<span class="w-3 h-3 rounded-full flex-shrink-0 ' +
            b.dot +
            '"></span><span class="text-slate-700 dark:text-slate-300">' +
            escapeHtml(b.label) +
            '</span><span class="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">фиксировано</span>';
        root.appendChild(row);
    });
    state.customTypes.forEach(function (ct) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML =
            '<span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color:' +
            escapeHtml(ct.colorHex) +
            '"></span><span class="text-slate-700 dark:text-slate-300 truncate">' +
            escapeHtml(ct.name) +
            '</span>';
        root.appendChild(row);
    });
}

function renderCustomTypesManager() {
    const root = document.getElementById('custom-types-manager');
    if (!root) return;
    root.innerHTML = '';
    if (state.customTypes.length === 0) {
        root.innerHTML =
            '<p class="text-[11px] text-slate-400 dark:text-slate-500">Своих категорий пока нет — добавьте в форме события («Свой тип»).</p>';
        return;
    }
    const title = document.createElement('p');
    title.className = 'text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2';
    title.textContent = 'Мои категории';
    root.appendChild(title);
    state.customTypes.forEach(function (ct) {
        const wrap = document.createElement('div');
        wrap.className =
            'flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700';
        wrap.innerHTML =
            '<input type="text" data-ct-name="' +
            escapeHtml(ct.id) +
            '" class="flex-1 min-w-[120px] px-2 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value="' +
            escapeHtml(ct.name) +
            '" maxlength="40">' +
            '<input type="color" data-ct-color="' +
            escapeHtml(ct.id) +
            '" class="h-9 w-12 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer bg-white dark:bg-slate-800" value="' +
            escapeHtml(ct.colorHex) +
            '">' +
            '<button type="button" data-ct-del="' +
            escapeHtml(ct.id) +
            '" class="px-2 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"><i class="fas fa-trash"></i></button>';
        root.appendChild(wrap);
        wrap.querySelector('[data-ct-name="' + ct.id + '"]').addEventListener('change', function () {
            updateCustomTypeField(ct.id, { name: this.value.trim() || ct.name });
        });
        wrap.querySelector('[data-ct-color="' + ct.id + '"]').addEventListener('input', function () {
            updateCustomTypeField(ct.id, { colorHex: this.value });
        });
        wrap.querySelector('[data-ct-del="' + ct.id + '"]').onclick = function () {
            deleteCustomType(ct.id);
        };
    });
}

function updateCustomTypeField(id, patch) {
    const idx = state.customTypes.findIndex(function (c) {
        return c.id === id;
    });
    if (idx === -1) return;
    if (patch.name !== undefined) state.customTypes[idx].name = patch.name;
    if (patch.colorHex !== undefined) state.customTypes[idx].colorHex = patch.colorHex;
    saveCustomTypes();
    renderTypesLegend();
    refreshActiveView();
    const modal = document.getElementById('event-modal');
    const tb = document.getElementById('type-buttons');
    if (modal && !modal.classList.contains('hidden') && tb) {
        const sel = tb.dataset.selectedType;
        renderEventTypePicker(sel || id);
    }
    renderAllEventsFilterButtons();
    if (document.getElementById('all-events-modal') && !document.getElementById('all-events-modal').classList.contains('hidden')) renderAllEventsList();
}

function deleteCustomType(id) {
    if (!confirm('Удалить категорию? События этой категории станут «Работа».')) return;
    state.customTypes = state.customTypes.filter(function (c) {
        return c.id !== id;
    });
    saveCustomTypes();
    state.events.forEach(function (e) {
        if (e.type === id) e.type = 'work';
    });
    saveEvents();
    if (state.currentFilter === id) state.currentFilter = 'all';
    renderTypesLegend();
    renderCustomTypesManager();
    renderEventTypePicker('work');
    renderAllEventsFilterButtons();
    refreshActiveView();
    if (state.selectedDate) renderDayEvents(state.selectedDate);
    const allModal = document.getElementById('all-events-modal');
    if (allModal && !allModal.classList.contains('hidden')) renderAllEventsList();
    showToast('Категория удалена');
}

function ensureAllEventsFiltersHost() {
    let host = document.getElementById('all-events-filters');
    if (host) return host;
    const old = document.getElementById('filter-all');
    if (old && old.parentElement) {
        host = document.createElement('div');
        host.id = 'all-events-filters';
        host.className =
            old.parentElement.className ||
            'flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-transparent dark:border-slate-700';
        old.parentElement.replaceWith(host);
        return host;
    }
    const modal = document.getElementById('all-events-modal');
    if (modal) {
        const bar = modal.querySelector('.bg-slate-100.rounded-2xl');
        if (bar && !bar.id) {
            bar.id = 'all-events-filters';
            return bar;
        }
    }
    return document.getElementById('all-events-filters');
}

function renderAllEventsFilterButtons() {
    const host = ensureAllEventsFiltersHost();
    if (!host) return;
    host.innerHTML = '';

    function mkBtn(filterVal, label, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.filter = filterVal;
        b.className =
            'px-3 py-1.5 rounded-xl text-xs font-medium transition-all ' +
            (active
                ? 'active-filter bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200');
        b.textContent = label;
        b.onclick = function () {
            filterAllEvents(filterVal);
        };
        host.appendChild(b);
    }

    mkBtn('all', 'Все', state.currentFilter === 'all');
    Object.keys(BUILTIN_TYPES).forEach(function (k) {
        mkBtn(k, BUILTIN_TYPES[k].label, state.currentFilter === k);
    });
    state.customTypes.forEach(function (ct) {
        mkBtn(ct.id, ct.name, state.currentFilter === ct.id);
    });
}

function allEventsMatchesSearch(event, q) {
    var s = (q || '').trim().toLowerCase();
    if (!s) return true;
    var st = getEventTypeStyle(event.type);
    var typeLabel = st && st.label ? st.label : '';
    var hay =
        (event.title || '') +
        '\n' +
        (event.desc || '') +
        '\n' +
        (event.date || '') +
        '\n' +
        (event.time || '') +
        '\n' +
        typeLabel;
    return hay.toLowerCase().indexOf(s) !== -1;
}

function getFilteredSortedAllEvents() {
    var filtered =
        state.currentFilter === 'all'
            ? state.events.slice()
            : state.events.filter(function (e) {
                  return normalizeEventType(e.type) === state.currentFilter;
              });
    filtered = filtered.filter(function (e) {
        return allEventsMatchesSearch(e, state.allEventsSearch);
    });
    filtered.sort(function (a, b) {
        return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
    });
    return filtered;
}

function renderAllEventsPager(total, pageSize, pageIndex, pagesCount) {
    var host = document.getElementById('all-events-pager');
    if (!host) return;
    host.innerHTML = '';
    if (total === 0) return;

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className =
        'px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none';
    prev.innerHTML = '<i class="fas fa-chevron-left text-xs"></i>';
    prev.disabled = pageIndex <= 0;
    prev.onclick = function () {
        shiftAllEventsPage(-1);
    };
    host.appendChild(prev);

    var lab = document.createElement('span');
    lab.className = 'text-slate-600 dark:text-slate-400 px-1 max-sm:text-[11px]';
    var start = pageIndex * pageSize + 1;
    var end = Math.min(total, (pageIndex + 1) * pageSize);
    lab.textContent = start + '–' + end + ' из ' + total + ' · стр. ' + (pageIndex + 1) + '/' + pagesCount;
    host.appendChild(lab);

    var next = document.createElement('button');
    next.type = 'button';
    next.className = prev.className;
    next.innerHTML = '<i class="fas fa-chevron-right text-xs"></i>';
    next.disabled = pageIndex >= pagesCount - 1;
    next.onclick = function () {
        shiftAllEventsPage(1);
    };
    host.appendChild(next);
}

function shiftAllEventsPage(delta) {
    state.allEventsPage += delta;
    renderAllEventsList();
}

function setPlannerView(v) {
    state.plannerView = v;
    ['month', 'week', 'day'].forEach(function (id) {
        const el = document.getElementById('tab-' + id);
        if (el) {
            el.classList.toggle('view-tab-active', v === id);
            el.classList.toggle('text-slate-600', v !== id);
            el.classList.toggle('dark:text-slate-400', v !== id);
            el.classList.toggle('text-indigo-700', v === id);
            el.classList.toggle('dark:text-indigo-300', v === id);
        }
    });
    const pm = document.getElementById('panel-month');
    const pw = document.getElementById('panel-week');
    const pd = document.getElementById('panel-day');
    if (pm) pm.classList.toggle('hidden', v !== 'month');
    if (pw) pw.classList.toggle('hidden', v !== 'week');
    if (pd) pd.classList.toggle('hidden', v !== 'day');

    if (v === 'month') renderCalendar();
    else if (v === 'week') renderWeekView();
    else renderDayView();
}

function navPrev() {
    if (state.plannerView === 'month') {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
    } else if (state.plannerView === 'week') {
        state.currentDate.setDate(state.currentDate.getDate() - 7);
        renderWeekView();
    } else {
        state.currentDate.setDate(state.currentDate.getDate() - 1);
        state.selectedDate = ymd(state.currentDate);
        syncSidebarSelected();
        renderDayView();
    }
}

function navNext() {
    if (state.plannerView === 'month') {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
    } else if (state.plannerView === 'week') {
        state.currentDate.setDate(state.currentDate.getDate() + 7);
        renderWeekView();
    } else {
        state.currentDate.setDate(state.currentDate.getDate() + 1);
        state.selectedDate = ymd(state.currentDate);
        syncSidebarSelected();
        renderDayView();
    }
}

function renderWeekView() {
    const label = document.getElementById('week-range-label');
    const grid = document.getElementById('week-grid');
    if (!grid) return;
    const mon = startOfWeekMonday(state.currentDate);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    if (label) {
        label.textContent =
            mon.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
            ' — ' +
            sun.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    grid.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'grid grid-cols-7 gap-2 min-w-[720px]';

    for (let i = 0; i < 7; i++) {
        const day = new Date(mon);
        day.setDate(day.getDate() + i);
        const ds = ymd(day);
        const isToday = ymd(new Date()) === ds;
        const evs = getEventsForDate(ds).sort(function (a, b) {
            return (a.time || '00:00').localeCompare(b.time || '00:00');
        });

        const col = document.createElement('div');
        col.className =
            'rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-2 min-h-[220px] flex flex-col cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-white/70 dark:hover:bg-slate-800/80 transition-colors';

        const head = document.createElement('div');
        head.className = 'text-center mb-2 pb-2 border-b border-slate-200 dark:border-slate-700';
        head.innerHTML =
            '<div class="text-[10px] uppercase text-slate-400 dark:text-slate-500">' +
            day.toLocaleDateString('ru-RU', { weekday: 'short' }) +
            '</div>' +
            '<div class="' +
            (isToday ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-800 dark:text-slate-200 font-semibold') +
            ' text-lg">' +
            day.getDate() +
            '</div>';
        col.appendChild(head);

        if (evs.length === 0) {
            const empty = document.createElement('div');
            empty.className =
                'text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2 flex-1 flex items-center justify-center';
            empty.textContent = 'Нажмите, чтобы добавить';
            col.appendChild(empty);
        } else {
            evs.forEach(function (ev) {
                const st = getEventTypeStyle(ev.type);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className =
                    'w-full text-left rounded-xl px-2 py-1.5 mb-1 text-[11px] border border-white/50 dark:border-slate-600/50 hover:border-indigo-200 dark:hover:border-indigo-400 transition-colors';
                if (st.isCustom) btn.style.backgroundColor = hexToRgba(st.hex, 0.14);
                else btn.className += ' ' + st.bgLightClass + ' dark:bg-slate-800/55';
                btn.innerHTML =
                    '<div class="font-semibold text-slate-800 dark:text-slate-100 truncate">' +
                    escapeHtml(ev.title) +
                    '</div>' +
                    '<div class="text-[10px] text-slate-500 dark:text-slate-400">' +
                    (ev.time || 'весь день') +
                    '</div>';
                btn.onclick = function (evClick) {
                    evClick.stopPropagation();
                    selectDate(ds);
                    showEditModal(ev.id);
                };
                col.appendChild(btn);
            });
        }

        col.onclick = function (e) {
            if (e.target.closest && e.target.closest('button')) return;
            selectDate(ds);
            showAddModal(ds);
        };

        wrap.appendChild(col);
    }
    grid.appendChild(wrap);
}

function renderDayView() {
    const lbl = document.getElementById('day-view-label');
    const agenda = document.getElementById('day-agenda');
    if (!agenda) return;
    const ds = ymd(state.currentDate);
    if (lbl) {
        const dd = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), state.currentDate.getDate());
        lbl.textContent = dd.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    const evs = getEventsForDate(ds).sort(function (a, b) {
        return (a.time || '00:00').localeCompare(b.time || '00:00');
    });

    if (evs.length === 0) {
        agenda.innerHTML =
            '<div class="text-center py-16 text-slate-400 dark:text-slate-500"><i class="fas fa-mug-hot text-4xl mb-3"></i><p>Событий нет — отдыхайте или добавьте задачу.</p></div>';
        return;
    }

    agenda.innerHTML = '';
    evs.forEach(function (ev) {
        const st = getEventTypeStyle(ev.type);
        const row = document.createElement('div');
        row.className =
            'flex gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 cursor-pointer transition-colors ';
        if (!st.isCustom) row.className += st.bgLightClass + ' dark:bg-slate-800/50';
        else row.style.backgroundColor = hexToRgba(st.hex, 0.12);
        const iconBox =
            st.isCustom
                ? '<div class="w-10 h-10 mx-auto mt-1 rounded-2xl flex items-center justify-center text-white" style="background-color:' +
                  escapeHtml(st.hex) +
                  '"><i class="fas fa-tag"></i></div>'
                : '<div class="w-10 h-10 mx-auto mt-1 rounded-2xl ' +
                  st.colorClass +
                  ' flex items-center justify-center text-white"><i class="fas ' +
                  st.iconClass +
                  '"></i></div>';
        const typeLine =
            st.isCustom
                ? '<div class="text-xs font-medium mt-0.5" style="color:' + escapeHtml(st.hex) + '">' + escapeHtml(st.label) + '</div>'
                : '<div class="text-xs ' +
                  st.textColorClass +
                  ' font-medium mt-0.5">' +
                  escapeHtml(st.label) +
                  '</div>';
        row.innerHTML =
            '<div class="flex-shrink-0 w-16 text-center">' +
            '<div class="text-xs font-mono text-slate-600 dark:text-slate-400">' +
            (ev.time || '9:00') +
            '</div>' +
            iconBox +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
            '<div class="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">' +
            escapeHtml(ev.title) +
            (hasRecurrence(ev) ? '<i class="fas fa-redo-alt text-slate-400 dark:text-slate-500 text-sm" title="Повтор"></i>' : '') +
            (ev.attachments && ev.attachments.length ? '<i class="fas fa-paperclip text-slate-400 dark:text-slate-500 text-sm" title="Вложения"></i>' : '') +
            '</div>' +
            typeLine +
            (ev.desc ? '<div class="text-sm text-slate-600 dark:text-slate-400 mt-2">' + escapeHtml(ev.desc) + '</div>' : '') +
            (ev.reminderMinutes != null && ev.reminderMinutes !== ''
                ? '<div class="text-[10px] text-slate-500 dark:text-slate-400 mt-2"><i class="fas fa-bell mr-1"></i>Напоминание включено</div>'
                : '') +
            '</div>';
        row.onclick = function () {
            selectDate(ds);
            showEditModal(ev.id);
        };
        agenda.appendChild(row);
    });
}

function renderUpcoming() {
    const el = document.getElementById('upcoming-list');
    if (!el) return;
    const now = Date.now();
    const horizon = now + 7 * 24 * 60 * 60 * 1000;

    const items = [];
    for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + i);
        const ds = ymd(d);
        getEventsForDate(ds).forEach(function (ev) {
            const start = getEventStartMsForDate(ev, ds);
            if (!start || start < now || start > horizon) return;
            items.push({ ev: ev, start: start, dateStr: ds });
        });
    }
    items.sort(function (a, b) {
        return a.start - b.start;
    });
    const top = items.slice(0, 10);

    if (top.length === 0) {
        el.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-xs">На неделе вперёд событий нет.</p>';
        return;
    }

    el.innerHTML = '';
    top.forEach(function (x) {
        const ev = x.ev;
        const st = getEventTypeStyle(ev.type);
        const when = new Date(x.start);
        const row = document.createElement('div');
        row.className =
            'flex items-start gap-2 p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs';
        const dot =
            st.isCustom
                ? '<div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background-color:' + escapeHtml(st.hex) + '"></div>'
                : '<div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ' + st.dotClass + '"></div>';
        row.innerHTML =
            dot +
            '<div class="flex-1 min-w-0">' +
            '<div class="font-semibold text-slate-800 dark:text-slate-100 truncate">' +
            escapeHtml(ev.title) +
            '</div>' +
            '<div class="text-[10px] text-slate-500 dark:text-slate-400">' +
            when.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) +
            '</div></div>';
        row.onclick = function () {
            selectDate(x.dateStr);
            setPlannerView('day');
            state.currentDate = new Date(x.dateStr + 'T12:00:00');
            renderDayView();
        };
        el.appendChild(row);
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('month-year').innerHTML = monthNames[month];
    document.getElementById('year').innerHTML = year;

    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell bg-slate-50/70 dark:bg-slate-800/40 rounded-xl sm:rounded-2xl';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const isSelected = state.selectedDate === dateStr;
        cell.className =
            'day-cell bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 rounded-xl sm:rounded-2xl p-1 sm:p-2 flex flex-col cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 ' +
            (isToday ? 'today ring-2 ring-offset-2 ring-indigo-400 dark:ring-offset-slate-950 ' : '') +
            (isSelected ? 'selected ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-950' : '');

        const dayNumber = document.createElement('div');
        dayNumber.className =
            'font-semibold text-[11px] sm:text-sm mb-0.5 sm:mb-1 flex items-center justify-between gap-1 ' +
            (isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300');
        dayNumber.innerHTML =
            '<span>' +
            day +
            '</span>' +
            (isToday
                ? '<span class="hidden sm:inline text-[9px] px-1.5 py-px bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded font-mono">СЕГОДНЯ</span>'
                : '');
        cell.appendChild(dayNumber);

        const dayEvents = getEventsForDate(dateStr);
        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'flex-1 flex flex-col gap-y-px overflow-hidden';
            const maxToShow = 3;
            dayEvents.slice(0, maxToShow).forEach(function (ev) {
                const pill = document.createElement('div');
                const st = getEventTypeStyle(ev.type);
                pill.className = 'mini-event px-1.5 py-px flex items-center gap-x-1';
                if (st.isCustom) {
                    pill.style.backgroundColor = st.hex;
                    pill.style.color = '#fff';
                } else pill.className += ' ' + st.colorClass;
                pill.innerHTML = '<span class="flex-1 truncate">' + escapeHtml(ev.title) + '</span>';
                pill.onclick = function (e) {
                    e.stopImmediatePropagation();
                    selectDate(dateStr);
                    showEditModal(ev.id);
                };
                eventsContainer.appendChild(pill);
            });
            if (dayEvents.length > maxToShow) {
                const more = document.createElement('div');
                more.className = 'text-[9px] text-slate-500 dark:text-slate-400 font-medium pl-1 mt-px';
                more.textContent = '+' + (dayEvents.length - maxToShow) + ' ещё';
                eventsContainer.appendChild(more);
            }
            cell.appendChild(eventsContainer);
        }
        cell.onclick = function () {
            selectDate(dateStr);
        };
        grid.appendChild(cell);
    }
    document.getElementById('events-count').innerHTML = state.events.length + ' событий';
    renderUpcoming();
}

function syncSidebarSelected() {
    const parts = state.selectedDate.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const formatted = dateObj.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('selected-date-header').innerHTML = formatted.split(',')[0];
    document.getElementById('selected-date-sub').innerHTML = dateObj.toLocaleDateString('ru-RU', { year: 'numeric' });
}

function selectDate(dateStr) {
    state.selectedDate = dateStr;
    const parts = dateStr.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    state.currentDate = dateObj;
    const formatted = dateObj.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('selected-date-header').innerHTML = formatted.split(',')[0];
    document.getElementById('selected-date-sub').innerHTML = dateObj.toLocaleDateString('ru-RU', { year: 'numeric' });
    if (state.plannerView === 'month') renderCalendar();
    else if (state.plannerView === 'week') renderWeekView();
    else renderDayView();
    renderDayEvents(dateStr);
}

function renderDayEvents(dateStr) {
    const container = document.getElementById('day-events-list');
    const placeholder = document.getElementById('no-events-placeholder');
    container.innerHTML = '';
    const dayEvents = getEventsForDate(dateStr).sort(function (a, b) {
        return (a.time || '00:00').localeCompare(b.time || '00:00');
    });

    if (dayEvents.length === 0) {
        placeholder.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }
    placeholder.classList.add('hidden');
    container.classList.remove('hidden');

    dayEvents.forEach(function (event) {
        const st = getEventTypeStyle(event.type);
        const el = document.createElement('div');
        el.className =
            'group flex gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all ';
        if (!st.isCustom) el.className += st.bgLightClass + ' dark:bg-slate-800/50';
        else el.style.backgroundColor = hexToRgba(st.hex, 0.12);
        const rm =
            event.reminderMinutes != null && event.reminderMinutes !== ''
                ? '<span class="text-[10px] text-indigo-600 dark:text-indigo-400"><i class="fas fa-bell mr-0.5"></i></span>'
                : '';
        const dotHtml =
            st.isCustom
                ? '<div class="w-3 h-3 rounded-full" style="background-color:' + escapeHtml(st.hex) + '"></div>'
                : '<div class="w-3 h-3 rounded-full ' + st.dotClass + '"></div>';
        const labelHtml =
            st.isCustom
                ? '<span class="text-xs px-2 py-px rounded font-medium" style="color:' +
                  escapeHtml(st.hex) +
                  ';background-color:rgba(255,255,255,0.65)">' +
                  escapeHtml(st.label) +
                  '</span>'
                : '<span class="text-xs px-2 py-px rounded ' +
                  st.textColorClass +
                  ' font-medium">' +
                  escapeHtml(st.label) +
                  '</span>';
        el.innerHTML =
            '<div class="flex-shrink-0 mt-0.5">' + dotHtml + '</div>' +
            '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center justify-between">' +
            '<div class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate pr-2 flex items-center gap-2">' +
            escapeHtml(event.title) +
            (hasRecurrence(event) ? '<i class="fas fa-redo-alt text-slate-300 dark:text-slate-600 text-xs"></i>' : '') +
            (event.attachments && event.attachments.length ? '<i class="fas fa-paperclip text-slate-300 dark:text-slate-600 text-xs"></i>' : '') +
            '</div>' +
            '<div class="flex items-center gap-x-1 opacity-0 group-hover:opacity-100">' +
            '<button type="button" class="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 p-1"><i class="fas fa-edit text-xs"></i></button>' +
            '<button type="button" class="text-red-400 dark:text-red-400 hover:text-red-600 p-1"><i class="fas fa-trash text-xs"></i></button>' +
            '</div></div>' +
            '<div class="flex items-center gap-x-2 mt-0.5 flex-wrap">' +
            (event.time
                ? '<span class="text-xs font-mono bg-white/70 dark:bg-slate-700/80 px-1.5 py-px rounded text-slate-600 dark:text-slate-300">' +
                  escapeHtml(event.time) +
                  '</span>'
                : '<span class="text-xs text-slate-500 dark:text-slate-400">Весь день</span>') +
            labelHtml +
            rm +
            '</div>' +
            (event.desc ? '<div class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">' + escapeHtml(event.desc) + '</div>' : '') +
            '</div>';
        el.querySelector('.fa-edit').parentElement.onclick = function (e) {
            e.stopPropagation();
            showEditModal(event.id);
        };
        el.querySelector('.fa-trash').parentElement.onclick = function (e) {
            e.stopPropagation();
            deleteEvent(event.id, true);
        };
        container.appendChild(el);
    });
}

function snapshotEventFormState() {
    var repEn = document.getElementById('event-repeat-enabled');
    var repeatDays = collectRepeatWeekdaysFromUi();
    var sortedRepeat = repeatDays
        ? repeatDays
              .slice()
              .sort(function (a, b) {
                  return a - b;
              })
              .join(',')
        : '';
    return JSON.stringify({
        id: (document.getElementById('event-id') && document.getElementById('event-id').value) || '',
        title: document.getElementById('event-title') ? document.getElementById('event-title').value : '',
        date: document.getElementById('event-date') ? document.getElementById('event-date').value : '',
        time: document.getElementById('event-time') ? document.getElementById('event-time').value : '',
        desc: document.getElementById('event-desc') ? document.getElementById('event-desc').value : '',
        type: (document.getElementById('type-buttons') && document.getElementById('type-buttons').dataset.selectedType) || 'work',
        reminder: document.getElementById('event-reminder') ? document.getElementById('event-reminder').value : '',
        repeatOn: repEn && repEn.checked,
        repeatDays: sortedRepeat,
        attachments: JSON.stringify(state.eventAttachmentsDraft)
    });
}

function captureEventFormBaseline() {
    state.eventFormBaseline = snapshotEventFormState();
}

function isEventFormDirty() {
    if (!state.eventFormBaseline) return false;
    return snapshotEventFormState() !== state.eventFormBaseline;
}

function forceCloseModal() {
    state.eventFormBaseline = null;
    hideNewCustomPanel();
    document.getElementById('event-modal').classList.remove('flex');
    document.getElementById('event-modal').classList.add('hidden');
    state.editingEventId = null;
    state.eventAttachmentsDraft = [];
    var fin = document.getElementById('event-file-input');
    if (fin) fin.value = '';
}

function requestCloseModal() {
    if (isEventFormDirty()) {
        if (!confirm('Закрыть без сохранения? Изменения будут потеряны.')) return;
    }
    forceCloseModal();
}

function showAddModal(preselectedDate) {
    state.editingEventId = null;
    document.getElementById('modal-title').innerHTML = 'Новое событие';
    document.getElementById('modal-subtitle').innerHTML = 'Заполните информацию';
    document.getElementById('submit-btn-text').innerHTML = 'Сохранить';
    document.getElementById('event-form').reset();
    const dateInput = document.getElementById('event-date');
    if (preselectedDate) dateInput.value = preselectedDate;
    else if (state.selectedDate) dateInput.value = state.selectedDate;
    else dateInput.value = ymd(new Date());
    var _drm = state.plannerSettings.defaultReminderMinutes;
    document.getElementById('event-reminder').value =
        _drm === undefined || _drm === null ? '' : String(_drm);
    renderEventTypePicker('work');
    syncRepeatUiFromEvent({});
    state.eventAttachmentsDraft = [];
    renderAttachmentDraftList();
    document.getElementById('event-modal').classList.remove('hidden');
    document.getElementById('event-modal').classList.add('flex');
    setTimeout(function () {
        document.getElementById('event-title').focus();
        captureEventFormBaseline();
    }, 0);
}

function showAddModalForSelected() {
    if (!state.selectedDate) showAddModal(ymd(new Date()));
    else showAddModal(state.selectedDate);
}

function saveEvent(e) {
    e.preventDefault();
    const id = document.getElementById('event-id').value || 'event-' + Date.now();
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const desc = document.getElementById('event-desc').value.trim();
    const type = normalizeEventType(document.getElementById('type-buttons').dataset.selectedType || 'work');
    const reminderMinutes = parseReminderMinutes(document.getElementById('event-reminder').value);

    if (!title || !date) {
        alert('Укажите название и дату');
        return;
    }

    clearReminderFiredForEvent(id);

    var repeatWeekdays = collectRepeatWeekdaysFromUi();
    var repEn = document.getElementById('event-repeat-enabled');
    if (repEn && repEn.checked && (!repeatWeekdays || repeatWeekdays.length === 0)) {
        alert('Отметьте хотя бы один день недели для повторения.');
        return;
    }

    var repeatUntil = null;
    if (repeatWeekdays && repeatWeekdays.length > 0) {
        repeatUntil = sundayOfCalendarWeekContaining(date);
    }

    const eventData = {
        id: id,
        date: date,
        title: title,
        type: type,
        time: time,
        desc: desc,
        reminderMinutes: reminderMinutes,
        repeatWeekdays: repeatWeekdays,
        repeatUntil: repeatUntil,
        attachments: JSON.parse(JSON.stringify(state.eventAttachmentsDraft))
    };

    if (state.editingEventId) {
        const index = state.events.findIndex(function (ev) {
            return ev.id === state.editingEventId;
        });
        if (index !== -1) state.events[index] = eventData;
    } else state.events.push(eventData);

    var wasEditing = !!state.editingEventId;
    saveEvents();
    forceCloseModal();
    refreshActiveView();
    if (state.selectedDate) renderDayEvents(state.selectedDate);
    showToast(wasEditing ? 'Обновлено' : 'Событие добавлено');
}

function refreshActiveView() {
    if (state.plannerView === 'month') renderCalendar();
    else if (state.plannerView === 'week') renderWeekView();
    else renderDayView();
    renderUpcoming();
}

function showEditModal(eventId) {
    const event = state.events.find(function (e) {
        return e.id === eventId;
    });
    if (!event) return;
    state.editingEventId = eventId;
    document.getElementById('modal-title').innerHTML = 'Редактировать';
    document.getElementById('modal-subtitle').innerHTML = 'Измените детали';
    document.getElementById('submit-btn-text').innerHTML = 'Сохранить изменения';
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-time').value = event.time || '';
    document.getElementById('event-desc').value = event.desc || '';

    const rm = event.reminderMinutes;
    const sel = document.getElementById('event-reminder');
    if (rm === null || rm === undefined || rm === '') sel.value = '';
    else sel.value = String(rm);

    renderEventTypePicker(event.type);
    syncRepeatUiFromEvent(event);
    state.eventAttachmentsDraft = JSON.parse(JSON.stringify(event.attachments || []));
    renderAttachmentDraftList();
    document.getElementById('event-modal').classList.remove('hidden');
    document.getElementById('event-modal').classList.add('flex');
    setTimeout(function () {
        captureEventFormBaseline();
    }, 0);
}

function deleteEvent(eventId, fromSidebar) {
    var evDel = state.events.find(function (e) {
        return e.id === eventId;
    });
    var delMsg =
        evDel && hasRecurrence(evDel)
            ? 'Удалить повторяющееся событие целиком (все запланированные дни)?'
            : 'Удалить это событие?';
    if (!confirm(delMsg)) return;
    clearReminderFiredForEvent(eventId);
    state.events = state.events.filter(function (e) {
        return e.id !== eventId;
    });
    saveEvents();
    refreshActiveView();
    if (fromSidebar && state.selectedDate) renderDayEvents(state.selectedDate);
    const allModal = document.getElementById('all-events-modal');
    if (allModal && !allModal.classList.contains('hidden')) renderAllEventsList();
    showToast('Удалено');
}

function showAllEventsModal() {
    document.getElementById('all-events-modal').classList.remove('hidden');
    document.getElementById('all-events-modal').classList.add('flex');
    var searchEl = document.getElementById('all-events-search');
    if (searchEl) searchEl.value = state.allEventsSearch;
    filterAllEvents('all');
}

function closeAllEventsModal() {
    document.getElementById('all-events-modal').classList.remove('flex');
    document.getElementById('all-events-modal').classList.add('hidden');
}

function filterAllEvents(filter) {
    state.currentFilter = filter;
    state.allEventsPage = 0;
    renderAllEventsFilterButtons();
    renderAllEventsList();
}

function renderAllEventsList() {
    const container = document.getElementById('all-events-list');
    container.innerHTML = '';
    const filteredEvents = getFilteredSortedAllEvents();
    const total = filteredEvents.length;
    const pageSize = ALL_EVENTS_PAGE_SIZE;
    const pagesCount = Math.max(1, Math.ceil(total / pageSize) || 1);
    var maxPage = Math.max(0, pagesCount - 1);
    if (state.allEventsPage > maxPage) state.allEventsPage = maxPage;
    if (state.allEventsPage < 0) state.allEventsPage = 0;
    const pageIndex = state.allEventsPage;
    const pageSlice = filteredEvents.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

    const countEl = document.getElementById('all-events-count');
    if (countEl) countEl.textContent = total + ' событий';

    renderAllEventsPager(total, pageSize, pageIndex, pagesCount);

    if (total === 0) {
        container.innerHTML =
            '<div class="text-center py-12"><i class="fas fa-search text-4xl text-slate-300 dark:text-slate-600 mb-4"></i><p class="text-slate-400 dark:text-slate-500">Ничего не найдено</p></div>';
        return;
    }

    container.scrollTop = 0;

    pageSlice.forEach(function (event) {
        const st = getEventTypeStyle(event.type);
        const dateObj = new Date(event.date + 'T12:00:00');
        const dateFormatted = dateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        const el = document.createElement('div');
        el.className =
            'flex items-start gap-4 p-5 mb-3 rounded-3xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all group ';
        if (!st.isCustom) el.className += st.bgLightClass + ' dark:bg-slate-800/50';
        else el.style.backgroundColor = hexToRgba(st.hex, 0.1);
        const bell =
            event.reminderMinutes != null && event.reminderMinutes !== ''
                ? '<span class="text-[10px] text-indigo-600 dark:text-indigo-400 ml-2"><i class="fas fa-bell"></i></span>'
                : '';
        const rep = hasRecurrence(event)
            ? '<span class="text-[10px] text-slate-400 dark:text-slate-500 ml-2" title="Повтор"><i class="fas fa-redo-alt"></i></span>'
            : '';
        const att =
            event.attachments && event.attachments.length
                ? '<span class="text-[10px] text-slate-400 dark:text-slate-500 ml-2" title="Вложения"><i class="fas fa-paperclip"></i>' +
                  event.attachments.length +
                  '</span>'
                : '';
        const iconBox =
            st.isCustom
                ? '<div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white" style="background-color:' +
                  escapeHtml(st.hex) +
                  '"><i class="fas fa-tag"></i></div>'
                : '<div class="w-10 h-10 rounded-2xl ' +
                  st.colorClass +
                  ' flex items-center justify-center text-white"><i class="fas ' +
                  st.iconClass +
                  '"></i></div>';
        const labelSpan =
            st.isCustom
                ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium bg-white/70 dark:bg-slate-700/80" style="color:' +
                  escapeHtml(st.hex) +
                  '">' +
                  escapeHtml(st.label) +
                  '</span>'
                : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-xl text-xs font-medium ' +
                  st.textColorClass +
                  ' bg-white/60 dark:bg-slate-700/60">' +
                  escapeHtml(st.label) +
                  '</span>';
        el.innerHTML =
            '<div class="flex-shrink-0">' +
            iconBox +
            '</div>' +
            '<div class="flex-1 min-w-0">' +
            '<div class="flex items-start justify-between">' +
            '<div>' +
            '<div class="font-semibold text-lg text-slate-800 dark:text-slate-100">' +
            escapeHtml(event.title) +
            bell +
            rep +
            att +
            '</div>' +
            '<div class="flex items-center gap-x-2 mt-1 flex-wrap">' +
            labelSpan +
            '<span class="text-xs text-slate-500 dark:text-slate-400 font-mono">' +
            dateFormatted +
            '</span>' +
            (event.time
                ? '<span class="text-xs font-mono bg-white dark:bg-slate-700 px-1.5 py-px rounded text-slate-600 dark:text-slate-300">' +
                  escapeHtml(event.time) +
                  '</span>'
                : '') +
            '</div></div>' +
            '<div class="flex items-center gap-x-1 opacity-0 group-hover:opacity-100">' +
            '<button type="button" class="px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl"><i class="fas fa-edit"></i></button>' +
            '<button type="button" class="px-3 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"><i class="fas fa-trash"></i></button>' +
            '</div></div>' +
            (event.desc ? '<div class="text-sm text-slate-600 dark:text-slate-400 mt-2 pr-8">' + escapeHtml(event.desc) + '</div>' : '') +
            '</div>';
        el.querySelector('.fa-edit').parentElement.onclick = function (e) {
            e.stopPropagation();
            editFromAllEvents(event.id);
        };
        el.querySelector('.fa-trash').parentElement.onclick = function (e) {
            e.stopPropagation();
            deleteFromAllEvents(event.id);
        };
        container.appendChild(el);
    });
}

function editFromAllEvents(eventId) {
    closeAllEventsModal();
    setTimeout(function () {
        showEditModal(eventId);
    }, 300);
}

function deleteFromAllEvents(eventId) {
    if (!confirm('Удалить?')) return;
    clearReminderFiredForEvent(eventId);
    state.events = state.events.filter(function (e) {
        return e.id !== eventId;
    });
    saveEvents();
    renderAllEventsList();
    refreshActiveView();
    if (state.selectedDate) {
        if (state.events.some(function (e) {
            return eventOccursOnDate(e, state.selectedDate);
        }))
            renderDayEvents(state.selectedDate);
        else {
            document.getElementById('day-events-list').innerHTML = '';
            document.getElementById('no-events-placeholder').classList.remove('hidden');
        }
    }
}

function goToToday() {
    state.currentDate = new Date();
    const todayStr = ymd(state.currentDate);
    state.selectedDate = todayStr;
    setPlannerView('day');
    renderDayEvents(todayStr);
    document.getElementById('selected-date-header').innerHTML = 'Сегодня';
    document.getElementById('selected-date-sub').innerHTML =
        new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).split(',')[1] || '';
    renderUpcoming();

    const todayCell = document.querySelector('.day-cell.today');
    if (todayCell) todayCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function exportEvents() {
    const payload = { version: 2, events: state.events, customTypes: state.customTypes };
    const linkElement = document.createElement('a');
    linkElement.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    linkElement.download = 'my-planner-' + ymd(new Date()) + '.json';
    linkElement.click();
}

function importEvents(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            let rows = imported;
            let incomingCustom = null;
            if (imported && typeof imported === 'object' && imported !== null && !Array.isArray(imported)) {
                if (Array.isArray(imported.events)) {
                    rows = imported.events;
                    if (Array.isArray(imported.customTypes)) incomingCustom = imported.customTypes;
                } else {
                    alert('Неверный формат');
                    return;
                }
            } else if (!Array.isArray(imported)) {
                alert('Неверный формат');
                return;
            }
            if (incomingCustom) {
                state.customTypes = incomingCustom.filter(function (x) {
                    return x && typeof x.id === 'string' && x.id.indexOf('custom_') === 0 && typeof x.name === 'string' && typeof x.colorHex === 'string';
                });
                saveCustomTypes();
                renderTypesLegend();
                renderCustomTypesManager();
                renderAllEventsFilterButtons();
            }
            const existingIds = new Set(
                state.events.map(function (x) {
                    return x.id;
                })
            );
            let added = 0;
            rows.forEach(function (row) {
                if (!existingIds.has(row.id)) {
                    if (row.reminderMinutes === undefined) row.reminderMinutes = null;
                    row.type = normalizeEventType(row.type);
                    state.events.push(row);
                    added++;
                }
            });
            migrateEventsTypes();
            saveEvents();
            refreshActiveView();
            if (state.selectedDate) renderDayEvents(state.selectedDate);
            showToast('Импортировано: ' + added);
            const allModal = document.getElementById('all-events-modal');
            if (allModal && !allModal.classList.contains('hidden')) renderAllEventsList();
        } catch (err) {
            alert(err.message);
        }
    };
    reader.readAsText(file);
    ev.target.value = '';
}

function openPlannerSettings() {
    updateSettingsUI();
    updateThemeControlUI();
    const m = document.getElementById('settings-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closePlannerSettings() {
    const m = document.getElementById('settings-modal');
    m.classList.remove('flex');
    m.classList.add('hidden');
}

function togglePlannerNotifySetting() {
    state.plannerSettings.notificationsEnabled = !state.plannerSettings.notificationsEnabled;
    savePlannerSettings();
    updateSettingsUI();
}

function updateSettingsUI() {
    const toggle = document.getElementById('settings-notify-toggle');
    if (toggle) {
        const on = state.plannerSettings.notificationsEnabled;
        toggle.classList.toggle('bg-indigo-600', on);
        toggle.classList.toggle('dark:bg-indigo-500', on);
        toggle.classList.toggle('bg-slate-300', !on);
        toggle.classList.toggle('dark:bg-slate-600', !on);
        const knob = toggle.querySelector('span');
        if (knob) {
            knob.classList.toggle('translate-x-5', on);
            knob.classList.toggle('translate-x-0', !on);
        }
    }
    const st = document.getElementById('notify-permission-status');
    if (st && typeof Notification !== 'undefined') {
        const p = Notification.permission;
        if (p === 'granted') st.textContent = 'Браузер: уведомления разрешены.';
        else if (p === 'denied') st.textContent = 'Браузер: уведомления заблокированы. Разрешите в настройках сайта.';
        else st.textContent = 'Браузер: разрешение ещё не запрошено.';
    }
    var intervalSel = document.getElementById('settings-check-interval');
    if (intervalSel) {
        var iv = String(state.plannerSettings.reminderCheckIntervalSec);
        intervalSel.value = iv;
        if (!intervalSel.querySelector('option[value="' + iv + '"]')) {
            intervalSel.value = '30';
        }
    }
    var defSel = document.getElementById('settings-default-reminder');
    if (defSel) {
        var dv = state.plannerSettings.defaultReminderMinutes === undefined || state.plannerSettings.defaultReminderMinutes === null
            ? ''
            : String(state.plannerSettings.defaultReminderMinutes);
        defSel.value = dv;
        if (!defSel.querySelector('option[value="' + dv + '"]')) {
            defSel.value = '';
        }
    }
}

function requestBrowserNotificationPermission() {
    if (typeof Notification === 'undefined') {
        alert('Ваш браузер не поддерживает уведомления.');
        return;
    }
    Notification.requestPermission().then(function () {
        updateSettingsUI();
        if (Notification.permission === 'granted') showToast('Уведомления включены');
    });
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement.tagName === 'BODY') {
            e.preventDefault();
            const allModal = document.getElementById('all-events-modal');
            if (allModal && !allModal.classList.contains('hidden')) closeAllEventsModal();
            else showAllEventsModal();
        }
        if (e.key.toLowerCase() === 'n' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            showAddModal();
        }
        if (e.key === 'Escape') {
            const eventModal = document.getElementById('event-modal');
            const allModal = document.getElementById('all-events-modal');
            const setModal = document.getElementById('settings-modal');
            if (!eventModal.classList.contains('hidden')) requestCloseModal();
            else if (allModal && !allModal.classList.contains('hidden')) closeAllEventsModal();
            else if (setModal && !setModal.classList.contains('hidden')) closePlannerSettings();
        }
        if (e.key === 'ArrowLeft' && e.target.tagName === 'BODY') navPrev();
        if (e.key === 'ArrowRight' && e.target.tagName === 'BODY') navNext();
    });
}

async function initCalendar() {
    await mergeSwFiredIntoStorage();
    registerUpdateSettingsUI(updateSettingsUI);
    initializeTailwind();
    loadPlannerSettings();
    applyColorTheme();
    attachThemeMediaListener();
    loadEvents();
    state.currentDate = new Date();

    const todayStr = ymd(new Date());
    state.selectedDate = todayStr;

    document.getElementById('selected-date-header').innerHTML = 'Сегодня';
    document.getElementById('selected-date-sub').innerHTML =
        new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).split(',')[1] || '';

    renderTypesLegend();
    renderCustomTypesManager();
    ensureAllEventsFiltersHost();
    renderAllEventsFilterButtons();

    setPlannerView('month');
    renderDayEvents(todayStr);
    initKeyboardShortcuts();

    var allSearch = document.getElementById('all-events-search');
    if (allSearch) {
        allSearch.value = state.allEventsSearch;
        allSearch.addEventListener('input', function () {
            state.allEventsSearch = allSearch.value;
            state.allEventsPage = 0;
            renderAllEventsList();
        });
    }

    const logoBtn = document.querySelector('nav .cursor-pointer');
    if (logoBtn)
        logoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            goToToday();
        });

    scheduleReminderChecks();
    checkReminders();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkReminders();
    });

    updateSettingsUI();
    updateThemeControlUI();

    await initPwa();
}

function toggleRepeatSection() {
    var row = document.getElementById('event-repeat-days');
    var en = document.getElementById('event-repeat-enabled');
    if (!row || !en) return;
    if (en.checked) row.classList.remove('hidden');
    else row.classList.add('hidden');
}

function toggleRepeatWeekdayBtn(btn) {
    var on = !btn.classList.contains('repeat-day-on');
    btn.classList.toggle('repeat-day-on', on);
    btn.classList.toggle('bg-indigo-600', on);
    btn.classList.toggle('text-white', on);
    btn.classList.toggle('border-indigo-600', on);
}

function collectRepeatWeekdaysFromUi() {
    var en = document.getElementById('event-repeat-enabled');
    if (!en || !en.checked) return null;
    var out = [];
    document.querySelectorAll('.repeat-day-btn.repeat-day-on').forEach(function (btn) {
        out.push(parseInt(btn.getAttribute('data-wd'), 10));
    });
    out.sort(function (a, b) {
        return a - b;
    });
    return out.length ? out : null;
}

function syncRepeatUiFromEvent(ev) {
    var en = document.getElementById('event-repeat-enabled');
    var days = ev && hasRecurrence(ev) ? ev.repeatWeekdays : [];
    if (en) en.checked = days.length > 0;
    document.querySelectorAll('.repeat-day-btn').forEach(function (btn) {
        var wd = parseInt(btn.getAttribute('data-wd'), 10);
        var on = days.indexOf(wd) >= 0;
        btn.classList.toggle('repeat-day-on', on);
        btn.classList.toggle('bg-indigo-600', on);
        btn.classList.toggle('text-white', on);
        btn.classList.toggle('border-indigo-600', on);
    });
    toggleRepeatSection();
}

function removeAttachmentDraft(attId) {
    state.eventAttachmentsDraft = state.eventAttachmentsDraft.filter(function (a) {
        return a.id !== attId;
    });
    renderAttachmentDraftList();
}

function renderAttachmentDraftList() {
    var host = document.getElementById('event-attachments-list');
    if (!host) return;
    if (state.eventAttachmentsDraft.length === 0) {
        host.innerHTML = '';
        return;
    }
    host.innerHTML = '';
    state.eventAttachmentsDraft.forEach(function (att) {
        var row = document.createElement('div');
        row.className =
            'flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2';
        var href = 'data:' + att.mime + ';base64,' + att.data;
        row.innerHTML =
            '<a href="' +
            href +
            '" download="' +
            escapeHtml(att.name) +
            '" class="text-indigo-600 dark:text-indigo-400 hover:underline truncate flex-1 min-w-0"><i class="fas fa-file mr-1"></i>' +
            escapeHtml(att.name) +
            '</a>' +
            '<button type="button" class="text-red-500 dark:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"><i class="fas fa-times"></i></button>';
        row.querySelector('button').onclick = function () {
            removeAttachmentDraft(att.id);
        };
        host.appendChild(row);
    });
}

function handleEventFilesChange(inputEl) {
    var files = inputEl.files;
    if (!files || !files.length) return;
    var maxBytes = 1.5 * 1024 * 1024;
    Array.from(files).forEach(function (file) {
        if (file.size > maxBytes) {
            alert('Файл слишком большой (макс. 1,5 МБ): ' + file.name);
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var res = reader.result;
            if (typeof res !== 'string') return;
            var comma = res.indexOf(',');
            var base64 = comma >= 0 ? res.slice(comma + 1) : res;
            state.eventAttachmentsDraft.push({
                id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
                name: file.name,
                mime: file.type || 'application/octet-stream',
                data: base64
            });
            var total = JSON.stringify(state.events).length + JSON.stringify(state.eventAttachmentsDraft).length;
            if (total > 4500000) {
                state.eventAttachmentsDraft.pop();
                alert('Недостаточно места в хранилище браузера для этого файла.');
                return;
            }
            renderAttachmentDraftList();
        };
        reader.readAsDataURL(file);
    });
    inputEl.value = '';
}

Object.assign(window, {
    setPlannerView: setPlannerView,
    setPlannerColorTheme: setPlannerColorTheme,
    goToToday: goToToday,
    showAllEventsModal: showAllEventsModal,
    openPlannerSettings: openPlannerSettings,
    closePlannerSettings: closePlannerSettings,
    togglePlannerNotifySetting: togglePlannerNotifySetting,
    setPlannerReminderIntervalSec: setPlannerReminderIntervalSec,
    setPlannerDefaultReminderMinutes: setPlannerDefaultReminderMinutes,
    requestBrowserNotificationPermission: requestBrowserNotificationPermission,
    navPrev: navPrev,
    navNext: navNext,
    showAddModal: showAddModal,
    showAddModalForSelected: showAddModalForSelected,
    requestCloseModal: requestCloseModal,
    closeModal: requestCloseModal,
    saveEvent: saveEvent,
    exportEvents: exportEvents,
    importEvents: importEvents,
    filterAllEvents: filterAllEvents,
    closeAllEventsModal: closeAllEventsModal,
    toggleRepeatSection: toggleRepeatSection,
    toggleRepeatWeekdayBtn: toggleRepeatWeekdayBtn,
    handleEventFilesChange: handleEventFilesChange,
    shiftAllEventsPage: shiftAllEventsPage
});
/* --- main.js --- */
function boot() {
    return initCalendar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        boot().catch(function () {});
    });
} else {
    boot().catch(function () {});
}
})();
