'use strict';

const DEFAULT_SUPABASE_PAGE_SIZE = 500;
const DEFAULT_SUPABASE_MAX_PAGES = 200;

function normalizePositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function collectSupabaseRangePages(fetchPage, options = {}) {
    if (typeof fetchPage !== 'function') {
        throw new TypeError('fetchPage must be a function');
    }

    const pageSize = normalizePositiveInteger(
        options.pageSize,
        DEFAULT_SUPABASE_PAGE_SIZE
    );
    const maxPages = normalizePositiveInteger(
        options.maxPages,
        DEFAULT_SUPABASE_MAX_PAGES
    );
    const rows = [];

    for (let page = 0; page < maxPages; page += 1) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        let result;
        try {
            result = await fetchPage({ page, pageSize, from, to });
        } catch (error) {
            return { data: null, error };
        }

        if (result?.error) {
            return { data: null, error: result.error };
        }
        if (result?.data != null && !Array.isArray(result.data)) {
            return {
                data: null,
                error: new TypeError('Supabase page data must be an array')
            };
        }

        const pageRows = result?.data || [];
        rows.push(...pageRows);
        if (pageRows.length < pageSize) {
            return { data: rows, error: null };
        }
    }

    return {
        data: null,
        error: new Error(
            `Supabase pagination exceeded the ${maxPages}-page safety limit`
        )
    };
}

module.exports = {
    DEFAULT_SUPABASE_MAX_PAGES,
    DEFAULT_SUPABASE_PAGE_SIZE,
    collectSupabaseRangePages
};
