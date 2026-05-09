export const state = {
    events: [],
    /** @type {Map<string, import('./event-types.js').PlannerEvent[]>} */
    eventsByDay: new Map(),
    customTypes: [],
    currentDate: new Date(),
    selectedDate: null,
    currentFilter: 'all',
    allEventsSearch: '',
    allEventsPage: 0,
    editingEventId: null,
    eventAttachmentsDraft: [],
    plannerView: 'month',
    plannerSettings: {
        notificationsEnabled: true,
        reminderCheckIntervalSec: 30,
        defaultReminderMinutes: '',
        colorTheme: 'system'
    },
    /** Снимок формы при открытии модалки (JSON.stringify), для проверки «есть несохранённые изменения». */
    eventFormBaseline: null
};
