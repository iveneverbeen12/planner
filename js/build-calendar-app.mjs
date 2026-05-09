/**
 * Собирает calendar-app.js из moy-kalendar.js: state.* и удаление дубликатов.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'moy-kalendar.js'), 'utf8');

let s = src;

const vars = [
    'events',
    'customTypes',
    'plannerSettings',
    'currentDate',
    'selectedDate',
    'currentFilter',
    'editingEventId',
    'eventAttachmentsDraft',
    'plannerView'
];

for (const v of vars) {
    const rep = 'state.' + v;
    const re = new RegExp('\\b' + v + '\\b', 'g');
    s = s.replace(re, function (match, offset) {
        const before = s.slice(Math.max(0, offset - 7), offset);
        if (before.endsWith('state.')) return match;
        return rep;
    });
}

const importBlock = `import { BUILTIN_TYPES, CUSTOM_TYPES_KEY, REMINDER_FIRED_KEY, SETTINGS_KEY, ALL_EVENTS_PAGE_SIZE } from './constants.js';
import { state } from './state.js';
import { ymd, sundayOfCalendarWeekContaining, startOfWeekMonday } from './datetime.js';
import { eventOccursOnDate, hasRecurrence } from './occurrence.js';
import { getEventsForDate } from './events-cache.js';
import {
    normalizeEventType,
    getEventTypeStyle,
    hexToRgba,
    generateCustomTypeId,
    loadCustomTypes,
    saveCustomTypes,
    getCustomTypeById,
    migrateEventsTypes
} from './event-types.js';
import { escapeHtml } from './html-utils.js';
import { loadPlannerSettings, savePlannerSettings, loadEvents, saveEvents } from './persistence.js';
import {
    initializeTailwind,
    applyColorTheme,
    attachThemeMediaListener,
    setPlannerColorTheme,
    updateThemeControlUI
} from './theme.js';
import {
    scheduleReminderChecks,
    checkReminders,
    setPlannerReminderIntervalSec,
    setPlannerDefaultReminderMinutes,
    clearReminderFiredForEvent,
    registerUpdateSettingsUI
} from './reminders.js';
import { showToast } from './toast.js';
import { parseReminderMinutes, getEventStartMsForDate, getEventStartMs } from './event-times.js';

`;

function cutBetween(startPat, endPat) {
    const a = s.indexOf(startPat);
    const b = s.indexOf(endPat);
    if (a === -1 || b === -1 || b <= a) throw new Error('cut failed: ' + startPat + ' / ' + endPat);
    s = s.slice(0, a) + s.slice(b);
}

// Удалить первый блок: от initializeTailwind до hideNewCustomPanel (оставить hideNewCustomPanel)
cutBetween('function initializeTailwind()', 'function hideNewCustomPanel()');

// Удалить loadPlannerSettings / savePlannerSettings дубликаты -> перед getColorThemeMode
cutBetween('function loadPlannerSettings()', 'function getColorThemeMode()');

// Удалить getColorThemeMode .. updateThemeControlUI (есть в theme.js)
cutBetween('function getColorThemeMode()', 'let reminderCheckTimer = null;');

// Удалить reminderCheckTimer блок и setPlanner* дубликаты до getReminderFiredSet
cutBetween('let reminderCheckTimer = null;', 'function getReminderFiredSet()');

// Удалить getReminderFiredSet .. clearReminderFiredForEvent
cutBetween('function getReminderFiredSet()', 'function getEventStartMs(ev)');

// Удалить getEventStartMs .. formatReminderBody (импорт из event-times)
cutBetween('function getEventStartMs(ev)', 'function checkReminders()');

// Удалить checkReminders целиком
cutBetween('function checkReminders()', 'function loadEvents()');

// Удалить loadEvents saveEvents дубликаты
cutBetween('function loadEvents()', 'function setPlannerView(v)');

// Удалить startOfWeekMonday sundayOfCalendarWeekContaining (есть в datetime)
cutBetween('function startOfWeekMonday(d)', 'function renderWeekView()');

s = importBlock + s;

fs.writeFileSync(path.join(__dirname, 'calendar-app.js'), s, 'utf8');
console.log('Written calendar-app.js, length', s.length);
