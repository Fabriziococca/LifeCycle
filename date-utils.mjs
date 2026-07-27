const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(date) {
    return date instanceof Date && Number.isFinite(date.getTime());
}

function getCalendarDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY;
}

export function parseDateLocal(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return isValidDate(value) ? new Date(value.getTime()) : null;
    }

    if (typeof value === 'string') {
        const dateOnlyMatch = value.match(DATE_ONLY_PATTERN);
        if (dateOnlyMatch) {
            const [, yearText, monthText, dayText] = dateOnlyMatch;
            const year = Number(yearText);
            const month = Number(monthText);
            const day = Number(dayText);
            const parsed = new Date(year, month - 1, day);

            if (
                parsed.getFullYear() !== year
                || parsed.getMonth() !== month - 1
                || parsed.getDate() !== day
            ) {
                return null;
            }

            return parsed;
        }
    }

    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
}

export function getLocalISODate(value = new Date()) {
    const date = parseDateLocal(value);
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getLocalISOMonth(value = new Date()) {
    return getLocalISODate(value).slice(0, 7);
}

export function combineLocalDateWithTime(dateValue, timeValue = new Date()) {
    const date = parseDateLocal(dateValue);
    const time = parseDateLocal(timeValue);
    if (!date || !time) return null;

    date.setHours(
        time.getHours(),
        time.getMinutes(),
        time.getSeconds(),
        time.getMilliseconds()
    );
    return date;
}

export function getCalendarDaysElapsed(dateValue, todayValue = new Date()) {
    const date = parseDateLocal(dateValue);
    const today = parseDateLocal(todayValue);
    if (!date || !today) return null;

    const difference = getCalendarDayNumber(today) - getCalendarDayNumber(date);
    return Math.max(0, difference);
}

export function getCalendarDaysUntil(dateValue, todayValue = new Date()) {
    const date = parseDateLocal(dateValue);
    const today = parseDateLocal(todayValue);
    if (!date || !today) return null;

    return getCalendarDayNumber(date) - getCalendarDayNumber(today);
}
