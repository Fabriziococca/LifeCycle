export const TASK_LIST = 'tareas_list';
export const taskBaseKey = owner => `lifecycle_task_sync_base:${owner}`;

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    }
    return value;
}
const fingerprint = value => JSON.stringify(canonical(value));
const equal = (a, b) => fingerprint(a) === fingerprint(b);

function indexTasks(raw) {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw ?? [];
    if (!Array.isArray(list)) throw new Error('La lista de tareas tiene un formato desconocido.');
    const tasks = new Map(), counts = new Map();
    for (const task of list) {
        // Older imports can contain missing or repeated IDs. Keep every row.
        const key = task.id == null ? ['legacy', fingerprint(task)] : ['id', String(task.id)];
        const group = JSON.stringify(key);
        const occurrence = counts.get(group) ?? 0;
        counts.set(group, occurrence + 1);
        tasks.set(JSON.stringify([...key, occurrence]), task);
    }
    return tasks;
}

async function copyId(key, local) {
    // A lost response and a retry must produce the same copy, even after reload.
    const bytes = new TextEncoder().encode(fingerprint([key, local]));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return 'conflict-' + Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function mergeTaskLists(baseRaw, localRaw, remoteRaw) {
    const base = indexTasks(baseRaw), local = indexTasks(localRaw), remote = indexTasks(remoteRaw);
    const tasks = [], copies = [];
    let conflicts = 0;
    for (const key of new Set([...remote.keys(), ...local.keys()])) {
        const old = base.get(key), mine = local.get(key), theirs = remote.get(key);
        let merged;
        if (equal(mine, theirs) || equal(old, theirs)) merged = mine;
        else if (equal(old, mine)) merged = theirs;
        else if (!mine || !theirs) {
            merged = mine ?? theirs; // Concurrent delete/edit: preserve the edit.
            conflicts++;
        } else {
            merged = { ...theirs };
            const localVersion = { ...theirs };
            let conflict = false;
            for (const field of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(old ?? {})])) {
                if (equal(mine[field], old?.[field])) continue;
                if (Object.hasOwn(mine, field)) localVersion[field] = mine[field];
                else delete localVersion[field];
                if (!equal(theirs[field], old?.[field]) && !equal(mine[field], theirs[field])) {
                    conflict = true;
                } else if (Object.hasOwn(mine, field)) merged[field] = mine[field];
                else delete merged[field];
            }
            if (conflict) {
                conflicts++;
                copies.push({ ...localVersion, id: await copyId(key, mine), syncConflictCopy: true });
            }
        }
        if (merged) tasks.push(merged);
    }
    const ids = new Set(tasks.map(task => task.id));
    for (const copy of copies) if (!ids.has(copy.id)) tasks.push(copy);
    return { tasks, conflicts };
}
