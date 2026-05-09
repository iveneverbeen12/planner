import { BUILTIN_TYPES, CUSTOM_TYPES_KEY, LEGACY_TYPE_MAP } from './constants.js';
import { state } from './state.js';

export function hexToRgb(hex) {
    const h = String(hex || '')
        .replace('#', '')
        .trim();
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16)
        };
    }
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 'rgba(148,163,184,' + alpha + ')';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
}

export function loadCustomTypes() {
    try {
        const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
        if (raw) state.customTypes = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(state.customTypes)) state.customTypes = [];
    state.customTypes = state.customTypes.filter(function (x) {
        return (
            x &&
            typeof x.id === 'string' &&
            x.id.indexOf('custom_') === 0 &&
            typeof x.name === 'string' &&
            typeof x.colorHex === 'string'
        );
    });
}

export function saveCustomTypes() {
    localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(state.customTypes));
}

export function getCustomTypeById(id) {
    for (let i = 0; i < state.customTypes.length; i++) {
        if (state.customTypes[i].id === id) return state.customTypes[i];
    }
    return null;
}

export function normalizeEventType(key) {
    if (!key || typeof key !== 'string') return 'work';
    if (key.indexOf('custom_') === 0) return getCustomTypeById(key) ? key : 'work';
    if (BUILTIN_TYPES[key]) return key;
    if (LEGACY_TYPE_MAP[key]) return LEGACY_TYPE_MAP[key];
    return 'work';
}

/** @returns {boolean} */
export function migrateEventsTypes() {
    let changed = false;
    state.events.forEach(function (e) {
        const n = normalizeEventType(e.type);
        if (e.type !== n) {
            e.type = n;
            changed = true;
        }
    });
    return changed;
}

export function getEventTypeStyle(typeKey) {
    const key = normalizeEventType(typeKey);
    if (key.indexOf('custom_') === 0) {
        const ct = getCustomTypeById(key);
        const hex = ct && ct.colorHex ? ct.colorHex : '#64748b';
        const label = ct && ct.name ? ct.name : 'Свой тип';
        return {
            label: label,
            isCustom: true,
            hex: hex,
            iconClass: 'fa-tag',
            colorClass: '',
            dotClass: '',
            bgLightClass: '',
            textColorClass: ''
        };
    }
    const b = BUILTIN_TYPES[key];
    return {
        label: b.label,
        isCustom: false,
        hex: null,
        iconClass: b.icon,
        colorClass: b.color,
        dotClass: b.dot,
        bgLightClass: b.bgLight,
        textColorClass: b.textColor
    };
}

export function generateCustomTypeId() {
    return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}
