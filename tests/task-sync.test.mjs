import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTaskLists } from '../task-sync-utils.mjs';
import { createTaskRecord } from '../task-capture-utils.mjs';

const task = { id: 7, text: 'Llamar', category: 'Personal', completed: false };
const merge = (base, local, remote) => mergeTaskLists(base, JSON.stringify(local), JSON.stringify(remote));

test('simultaneous PC and phone captures survive in both directions, even with identical clocks', async () => {
    const create = text => createTaskRecord({ text, category:'Personal' }, { categories:['Personal'], now:()=>1000 });
    const pc = create('Desde PC'), phone = create('Desde teléfono');
    assert.notEqual(pc.id, phone.id);
    for (const [a,b] of [[pc,phone],[phone,pc]]) {
        const first = await merge([], [a], [b]);
        assert.deepEqual(first.tasks, [b,a]);
        assert.deepEqual(await merge([], [a], first.tasks), first);
    }
});

test('edits to distinct fields combine and unchanged deleted tasks stay deleted', async () => {
    const done = { ...task, completed:true, completedAt:42 };
    const edit = { ...task, text:'Llamar mañana' };
    assert.deepEqual((await merge([task],[done],[edit])).tasks, [{ ...edit, completed:true, completedAt:42 }]);
    assert.deepEqual((await merge([task],[],[task])).tasks, []);
    assert.deepEqual((await merge([task],[task],[])).tasks, []);
    assert.deepEqual((await merge([task],[],[edit])).tasks, [edit]);
    assert.deepEqual((await merge([task],[edit],[])).tasks, [edit]);
});

test('competing edits preserve both texts once after a lost response and retain other fields', async () => {
    const mine = { ...task, text:'Lunes', category:'Trabajo' }, theirs = { ...task, text:'Martes', urgency:'urgente' };
    const result = await merge([task],[mine],[theirs]);
    assert.equal(result.conflicts,1);
    assert.deepEqual(result.tasks.map(t=>[t.text,t.category,t.urgency]), [['Martes','Trabajo','urgente'],['Lunes','Trabajo','urgente']]);
    assert.equal(result.tasks[1].syncConflictCopy,true);
    assert.deepEqual((await merge([task],[mine],result.tasks)).tasks, result.tasks);
});

test('legacy pending queues retain unknown remote tasks, duplicates and ID-less backup records', async () => {
    const legacy = [{text:'Histórica'},{text:'Histórica'},{...task},{...task}];
    assert.deepEqual((await merge(undefined,[{id:'new'}],legacy)).tasks,[...legacy,{id:'new'}]);
    assert.deepEqual((await merge(legacy,legacy,legacy)).tasks,legacy);
});
