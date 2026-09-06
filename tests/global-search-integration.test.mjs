import test from 'node:test';
import assert from 'node:assert/strict';
import { GlobalSearchModule } from '../modules/GlobalSearchModule.js';
import { searchLifeCycleItems } from '../search-utils.mjs';

test('el buscador importa como módulo real e indexa los contratos actuales de biblioteca y suscripciones', () => {
    const search = Object.create(GlobalSearchModule.prototype);
    search.app = {
        subscriptions: { subscriptions: [{ id: 's1', name: 'Servicio ejemplo', status: 'active', category: 'software' }] },
        transcriptions: { sessions: [{ id: 't1', title: 'Clase', transcript: 'Hablamos de los requisitos funcionales', context: '' }] }
    };
    const index = search.buildIndex();
    assert.equal(searchLifeCycleItems(index, 'servicio ejemplo')[0].target.subscriptionId, 's1');
    assert.equal(searchLifeCycleItems(index, 'requisitos funcionales')[0].target.transcriptionId, 't1');
    assert.equal(search.getSubscriptionItems()[0].subtitle, 'Suscripción · Activa');
});

test('los comandos y resultados nuevos abren la sección y el elemento correctos', () => {
    const calls = [];
    const search = Object.create(GlobalSearchModule.prototype);
    search.close = () => {};
    search.app = {
        activateSection: id => calls.push(id),
        subscriptions: { openModal: id => calls.push(id) },
        transcriptions: { openDetailModal: id => calls.push(id) }
    };
    search.executeCommand('suscripciones');
    search.executeCommand('transcripciones');
    search.activateResult({ kind: 'subscription', target: { subscriptionId: 's1' } });
    search.activateResult({ kind: 'transcription', target: { transcriptionId: 't1' } });
    assert.deepEqual(calls, ['suscripciones-section', 'transcripciones-section', 'suscripciones-section', 's1', 'transcripciones-section', 't1']);
});
