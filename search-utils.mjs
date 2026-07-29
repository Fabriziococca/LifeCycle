const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;

export function normalizeSearchText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(COMBINING_MARKS_PATTERN, '')
        .toLocaleLowerCase('es')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSearchFields(item) {
    return [
        item?.title,
        item?.subtitle,
        ...(Array.isArray(item?.keywords) ? item.keywords : [])
    ]
        .map(normalizeSearchText)
        .filter(Boolean);
}

export function getSearchScore(item, queryValue) {
    const query = normalizeSearchText(queryValue);
    if (!query) return null;

    const fields = getSearchFields(item);
    const title = normalizeSearchText(item?.title);
    const allText = fields.join(' ');
    const queryTokens = query.split(' ').filter(Boolean);

    if (!allText || queryTokens.some(token => !allText.includes(token))) {
        return null;
    }
    if (title === query) return 0;
    if (title.startsWith(query)) return 10;
    if (title.split(' ').some(token => token.startsWith(query))) return 20;
    if (title.includes(query)) return 30;
    if (fields.slice(1).some(field => field.startsWith(query))) return 40;
    if (fields.slice(1).some(field => field.includes(query))) return 50;
    return 60;
}

export function searchLifeCycleItems(items, queryValue, { limit = 40 } = {}) {
    if (!Array.isArray(items) || limit <= 0) return [];

    return items
        .map((item, sourceIndex) => ({
            item,
            sourceIndex,
            score: getSearchScore(item, queryValue)
        }))
        .filter(result => result.score !== null)
        .sort((left, right) => (
            left.score - right.score
            || String(left.item?.title || '').localeCompare(
                String(right.item?.title || ''),
                'es',
                { sensitivity: 'base' }
            )
            || left.sourceIndex - right.sourceIndex
        ))
        .slice(0, limit)
        .map(result => result.item);
}
