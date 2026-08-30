const test = require('node:test');
const assert = require('node:assert/strict');

const {
    collectSupabaseRangePages
} = require('../supabase-pagination-utils');

test('Supabase range pagination uses inclusive non-overlapping pages', async () => {
    const requestedRanges = [];
    const pages = [
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
        [{ id: 5 }]
    ];

    const result = await collectSupabaseRangePages(
        async ({ page, from, to }) => {
            requestedRanges.push([from, to]);
            return { data: pages[page], error: null };
        },
        { pageSize: 2 }
    );

    assert.deepEqual(requestedRanges, [[0, 1], [2, 3], [4, 5]]);
    assert.deepEqual(result, {
        data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
        error: null
    });
});

test('a failed page discards partial projection data', async () => {
    const expectedError = new Error('temporary failure');
    const result = await collectSupabaseRangePages(
        async ({ page }) => page === 0
            ? { data: [{ id: 1 }, { id: 2 }], error: null }
            : { data: null, error: expectedError },
        { pageSize: 2 }
    );

    assert.equal(result.data, null);
    assert.equal(result.error, expectedError);
});

test('pagination fails closed when a source never reaches its final page', async () => {
    const result = await collectSupabaseRangePages(
        async () => ({ data: [{ id: 1 }], error: null }),
        { pageSize: 1, maxPages: 2 }
    );

    assert.equal(result.data, null);
    assert.match(result.error.message, /2-page safety limit/i);
});
