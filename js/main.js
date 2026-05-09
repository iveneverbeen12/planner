import { initCalendar } from './calendar-app.js';

function boot() {
    return initCalendar();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        boot().catch(function () {});
    });
} else {
    boot().catch(function () {});
}
