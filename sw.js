/**
 * Service Worker: офлайн-оболочка, Background Sync / Periodic Sync → проверка напоминаний
 * по снимку planner-snapshot.json в Cache API (без localStorage в SW).
 */
const CACHE = 'planner-assets-v1';
const PRECACHE = ['./moy-kalendar.html', './css/tailwind.css', './js/app.bundle.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

function swYmd(d) {
    return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
}

function swWeekdayFromYmd(dateStr) {
    const p = dateStr.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getDay();
}

function swHasRec(ev) {
    return Array.isArray(ev.repeatWeekdays) && ev.repeatWeekdays.length > 0;
}

function swOccursOnDate(ev, dateStr) {
    if (!dateStr || !ev || !ev.date) return false;
    if (swHasRec(ev)) {
        if (dateStr < ev.date) return false;
        if (ev.repeatUntil && dateStr > ev.repeatUntil) return false;
        const wd = swWeekdayFromYmd(dateStr);
        return ev.repeatWeekdays.indexOf(wd) >= 0;
    }
    return ev.date === dateStr;
}

function swStartMsForDate(ev, dateStr) {
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

function swFormatBody(ev, occurrenceDateStr) {
    const datePart = occurrenceDateStr || ev.date;
    const t = ev.time ? ev.time : 'весь день (9:00)';
    const dt = new Date(datePart + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return dt + (ev.time ? ', ' + t : '') + (ev.desc ? ' — ' + String(ev.desc).slice(0, 80) : '');
}

function snapshotReq() {
    return new URL('planner-snapshot.json', self.registration.scope).href;
}

function firedPatchReq() {
    return new URL('reminder-fired-sw.json', self.registration.scope).href;
}

async function appendFiredKeys(newKeys) {
    if (!newKeys.length) return;
    const cache = await caches.open(CACHE);
    const url = firedPatchReq();
    let keys = [];
    const old = await cache.match(url);
    if (old) {
        try {
            const j = await old.json();
            keys = j.keys || [];
        } catch (e) {}
    }
    newKeys.forEach(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
    });
    while (keys.length > 400) keys.shift();
    await cache.put(url, new Response(JSON.stringify({ keys: keys }), { headers: { 'Content-Type': 'application/json' } }));
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(function (c) {
        try {
            c.postMessage({ type: 'REMINDERS_FIRED_UPDATE' });
        } catch (e) {}
    });
}

async function runRemindersFromSnapshot() {
    const cache = await caches.open(CACHE);
    const res = await cache.match(snapshotReq());
    if (!res) return;
    let snap;
    try {
        snap = await res.json();
    } catch (e) {
        return;
    }
    if (!snap.plannerSettings || !snap.plannerSettings.notificationsEnabled) return;

    const granted =
        typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (!granted) return;

    const now = Date.now();
    const todayStr = swYmd(new Date());
    let firedArr = [];
    try {
        firedArr = JSON.parse(snap.reminderFiredRaw || '[]');
    } catch (e) {}
    const fired = new Set(firedArr);
    const newKeys = [];

    const events = snap.events || [];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const rm = ev.reminderMinutes;
        if (rm === undefined || rm === null || rm === '') continue;
        const minutes = Number(rm);
        if (isNaN(minutes)) continue;
        if (!swOccursOnDate(ev, todayStr)) continue;
        const startMs = swStartMsForDate(ev, todayStr);
        if (!startMs) continue;
        const triggerMs = startMs - minutes * 60 * 1000;
        const key = ev.id + '|' + todayStr + '|' + triggerMs;
        if (fired.has(key)) continue;
        if (now < triggerMs) continue;
        const late = now - triggerMs;
        if (late > 30 * 60 * 1000) continue;
        if (now > startMs + 2 * 60 * 60 * 1000) continue;

        fired.add(key);
        newKeys.push(key);

        const title = ev.title || 'Событие';
        const body = swFormatBody(ev, todayStr);
        try {
            await self.registration.showNotification('Напоминание: ' + title, {
                body: body,
                tag: key,
                icon: new URL('./icons/icon-192.png', self.registration.scope).href,
                badge: new URL('./icons/icon-192.png', self.registration.scope).href,
                vibrate: [120, 80, 120],
                renotify: false
            });
        } catch (e) {}
    }

    if (newKeys.length === 0) return;

    await appendFiredKeys(newKeys);

    const merged = Array.from(fired);
    while (merged.length > 400) merged.shift();
    const payload = JSON.stringify({
        events: snap.events,
        plannerSettings: snap.plannerSettings,
        reminderFiredRaw: JSON.stringify(merged)
    });
    await cache.put(snapshotReq(), new Response(payload, { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            return Promise.allSettled(PRECACHE.map(function (url) {
                return cache.add(url).catch(function () {});
            }));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', function (event) {
    if (event.tag === 'reminder-sync') {
        event.waitUntil(runRemindersFromSnapshot());
    }
});

self.addEventListener('periodicsync', function (event) {
    if (event.tag === 'reminder-periodic') {
        event.waitUntil(runRemindersFromSnapshot());
    }
});

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    var urlObj;
    try {
        urlObj = new URL(event.request.url);
    } catch (e) {
        return;
    }
    if (urlObj.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                if (response && response.ok && event.request.method === 'GET') {
                    var copy = response.clone();
                    caches.open(CACHE).then(function (cache) {
                        cache.put(event.request, copy);
                    });
                }
                return response;
            })
            .catch(function () {
                return caches.match(event.request);
            })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var c = clientList[i];
                if ('focus' in c) return c.focus();
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./moy-kalendar.html');
            }
        })
    );
});
