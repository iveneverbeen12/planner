import { REMINDER_FIRED_KEY } from './constants.js';
import { state } from './state.js';
import { savePlannerSettings } from './persistence.js';
import { ymd } from './datetime.js';
import { eventOccursOnDate } from './occurrence.js';
import { getEventStartMsForDate, formatReminderBody } from './event-times.js';
import { showToast } from './toast.js';
import { notifyPlannerDataChanged } from './pwa.js';

export function getReminderFiredSet() {
    try {
        const raw = localStorage.getItem(REMINDER_FIRED_KEY);
        if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set();
}

export function persistReminderFired(set) {
    const arr = Array.from(set);
    while (arr.length > 400) arr.shift();
    localStorage.setItem(REMINDER_FIRED_KEY, JSON.stringify(arr));
}

export function clearReminderFiredForEvent(eventId) {
    const set = getReminderFiredSet();
    Array.from(set).forEach(function (k) {
        if (k.indexOf(eventId + '|') === 0) set.delete(k);
    });
    persistReminderFired(set);
}

let reminderCheckTimer = null;

export function scheduleReminderChecks() {
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

export function registerUpdateSettingsUI(fn) {
    updateSettingsUICallback = fn;
}

export function setPlannerReminderIntervalSec(secVal) {
    var n = parseInt(secVal, 10);
    if (isNaN(n)) n = 30;
    state.plannerSettings.reminderCheckIntervalSec = Math.min(600, Math.max(10, n));
    savePlannerSettings();
    scheduleReminderChecks();
    updateSettingsUICallback();
}

export function setPlannerDefaultReminderMinutes(val) {
    var allowed = ['', '0', '5', '15', '30', '60', '120', '1440'];
    var str = val === null || val === undefined ? '' : String(val);
    state.plannerSettings.defaultReminderMinutes = allowed.indexOf(str) >= 0 ? str : '';
    savePlannerSettings();
    updateSettingsUICallback();
}

export function checkReminders() {
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
