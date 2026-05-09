import { escapeHtml } from './html-utils.js';

export function showToast(message) {
    const toast = document.createElement('div');
    toast.className =
        'fixed bottom-6 right-6 bg-slate-900 dark:bg-indigo-950 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-x-3 z-[200] text-sm font-medium max-w-sm border border-slate-700 dark:border-indigo-800';
    toast.innerHTML = '<i class="fas fa-check-circle text-emerald-400 flex-shrink-0"></i><span>' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 2600);
}
