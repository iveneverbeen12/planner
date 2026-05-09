export const SETTINGS_KEY = 'plannerSettings';
export const REMINDER_FIRED_KEY = 'plannerReminderFired';
export const CUSTOM_TYPES_KEY = 'plannerCustomTypes';

export const BUILTIN_TYPES = {
    work: {
        label: 'Работа',
        color: 'bg-sky-600',
        textColor: 'text-sky-700',
        dot: 'bg-sky-600',
        bgLight: 'bg-sky-50',
        icon: 'fa-briefcase'
    },
    family: {
        label: 'Семья',
        color: 'bg-rose-500',
        textColor: 'text-rose-700',
        dot: 'bg-rose-500',
        bgLight: 'bg-rose-50',
        icon: 'fa-users'
    },
    sport: {
        label: 'Спорт',
        color: 'bg-emerald-600',
        textColor: 'text-emerald-700',
        dot: 'bg-emerald-600',
        bgLight: 'bg-emerald-50',
        icon: 'fa-person-running'
    }
};

export const LEGACY_TYPE_MAP = {
    important: 'work',
    reminder: 'family',
    study: 'sport',
    masha: 'family',
    stas: 'sport'
};

/** Кэш повторов: разворачиваем события не дальше этого горизонта (дней от сегодня). */
export const CACHE_HORIZON_DAYS = 800;

export const ALL_EVENTS_PAGE_SIZE = 50;
