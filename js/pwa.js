import { state } from './state.js';
import { REMINDER_FIRED_KEY } from './constants.js';

export const PLANNER_CACHE_NAME = 'planner-assets-v1';

function snapshotUrl() {
    return new URL('planner-snapshot.json', window.location.href).href;
}

function swFiredPatchUrl() {
    return new URL('reminder-fired-sw.json', window.location.href).href;
}

/**
 * Кладёт события и настройки в Cache API — service worker читает их без localStorage.
 */
export async function notifyPlannerDataChanged() {
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

export async function mergeSwFiredIntoStorage() {
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

export async function initPwa() {
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
