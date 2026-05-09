import { SETTINGS_KEY } from './constants.js';
import { state } from './state.js';
import { loadCustomTypes, migrateEventsTypes } from './event-types.js';
import { rebuildEventsDayCache } from './events-cache.js';
import { notifyPlannerDataChanged } from './pwa.js';

export function loadPlannerSettings() {
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

export function savePlannerSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.plannerSettings));
    notifyPlannerDataChanged();
}

export function loadEvents() {
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

export function saveEventsToStorage() {
    localStorage.setItem('calendarEvents', JSON.stringify(state.events));
}

export function saveEvents() {
    saveEventsToStorage();
    rebuildEventsDayCache();
    notifyPlannerDataChanged();
}
