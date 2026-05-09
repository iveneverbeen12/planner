export function getEventStartMs(ev) {
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

export function getEventStartMsForDate(ev, dateStr) {
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

export function parseReminderMinutes(val) {
    if (val === '' || val == null) return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

export function formatReminderBody(ev, occurrenceDateStr) {
    const datePart = occurrenceDateStr || ev.date;
    const t = ev.time ? ev.time : 'весь день (9:00)';
    const dt = new Date(datePart + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return dt + (ev.time ? ', ' + t : '') + (ev.desc ? ' — ' + ev.desc.slice(0, 80) : '');
}
