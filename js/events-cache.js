import { CACHE_HORIZON_DAYS } from './constants.js';
import { state } from './state.js';
import { ymd, addDaysYmd, compareYmd, nextYmd } from './datetime.js';
import { hasRecurrence, eventOccursOnDate } from './occurrence.js';

function pushDay(map, dateStr, ev) {
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push(ev);
}

/**
 * Перестраивает Map дата → события для быстрого рендера календаря.
 * Повторы без repeatUntil разворачиваются до CACHE_HORIZON_DAYS от сегодня.
 */
export function rebuildEventsDayCache() {
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
export function getEventsForDate(dateStr) {
    if (state.eventsByDay.has(dateStr)) return state.eventsByDay.get(dateStr).slice();

    const out = [];
    state.events.forEach(function (e) {
        if (eventOccursOnDate(e, dateStr)) out.push(e);
    });
    return out;
}
