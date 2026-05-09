export function ymd(d) {
    return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
    );
}

export function compareYmd(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
}

export function nextYmd(ds) {
    const p = ds.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + 1);
    return ymd(d);
}

export function addDaysYmd(ds, n) {
    const p = ds.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return ymd(d);
}

export function weekdayFromYmd(dateStr) {
    const p = dateStr.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getDay();
}

export function startOfWeekMonday(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const wd = x.getDay();
    const diff = wd === 0 ? -6 : 1 - wd;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
}

/** Последний день (воскресенье) недели с понедельника, где лежит dateStr. */
export function sundayOfCalendarWeekContaining(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const mon = startOfWeekMonday(d);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return ymd(sun);
}
