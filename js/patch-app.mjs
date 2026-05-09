import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'calendar-app.js');
let s = fs.readFileSync(file, 'utf8');

function shieldAlreadyPrefixed(name, replacement) {
    const re = new RegExp('\\b' + name + '\\b', 'g');
    return s.replace(re, (match, offset) => {
        const before = s.slice(Math.max(0, offset - 7), offset);
        if (before.endsWith('state.')) return match;
        return replacement;
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

// Strip first chunk: from start through updateThemeControlUI closing brace before let reminderCheckTimer
const stripThrough = 'function initializeTailwind()';
const stripEndMarker = 'let reminderCheckTimer = null;';

const i0 = s.indexOf(stripThrough);
const i1 = s.indexOf(stripEndMarker);
if (i0 === -1 || i1 === -1) throw new Error('markers not found');
s = importBlock + '\n' + s.slice(i1);

// Remove duplicate blocks: getReminderFiredSet through checkReminders end - find second occurrence
// Actually after strip we still have reminderCheckTimer schedule... setPlannerDefaultReminderMinutes getReminderFiredSet...
// The strip should remove everything BEFORE reminderCheckTimer - including loadPlannerSettings duplicate

// Re-read - we removed from initializeTailwind through line BEFORE let reminderCheckTimer - but we need to remove 
// from start through end of updateThemeControlUI(), not including reminderCheckTimer

const innerStart = s.indexOf(importBlock) + importBlock.length;
const inner = s.slice(innerStart);
// inner now starts with "let reminderCheckTimer = null;" - good if strip worked

// Remove duplicate reminder/planner functions until unique content - still has scheduleReminderChecks duplicate

// Find and remove from "let reminderCheckTimer" through end of "function setPlannerDefaultReminderMinutes" before getReminderFiredSet
