import { weekdayFromYmd } from './datetime.js';

export function hasRecurrence(ev) {
    return Array.isArray(ev.repeatWeekdays) && ev.repeatWeekdays.length > 0;
}

export function eventOccursOnDate(ev, dateStr) {
    if (!dateStr || !ev || !ev.date) return false;
    if (hasRecurrence(ev)) {
        if (dateStr < ev.date) return false;
        if (ev.repeatUntil && dateStr > ev.repeatUntil) return false;
        const wd = weekdayFromYmd(dateStr);
        return ev.repeatWeekdays.indexOf(wd) >= 0;
    }
    return ev.date === dateStr;
}
