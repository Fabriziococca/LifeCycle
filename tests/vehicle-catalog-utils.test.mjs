import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendVehicleCardRecord,
    buildVehicleAlertDefinitions,
    createVehicleCard,
    deleteVehicleCardPermanently,
    getVehicleCardState,
    migrateVehicleCatalog,
    normalizeVehicleCatalog,
    updateVehicleCard,
    validateVehicleCatalog,
    VEHICLE_CATALOG_FIELD
} from '../vehicle-catalog-utils.mjs';

test('a fresh account starts with no predefined vehicle cards', () => {
    const result = migrateVehicleCatalog({ hasLegacyData: false });

    assert.equal(VEHICLE_CATALOG_FIELD, 'vehicleCatalog');
    assert.equal(result.migrated, true);
    assert.equal(result.seededLegacyCards, false);
    assert.deepEqual(result.catalog.cards, []);
});

test('legacy vehicle data seeds every existing card and preserves records', () => {
    const result = migrateVehicleCatalog({
        hasLegacyData: true,
        trackerData: {
            refrigeranteDate: '2026-07-20',
            vtvExpDate: '2027-02-10'
        },
        maintenanceLog: [
            {
                id: 'maint_oil',
                type: 'Aceite y Filtros',
                date: '2026-06-01',
                km: 42000,
                details: { oil: true }
            }
        ],
        now: new Date('2026-08-01T12:00:00-03:00')
    });

    assert.equal(result.seededLegacyCards, true);
    assert.equal(result.catalog.cards.length, 12);
    assert.equal(result.catalog.records.vc_oil[0].id, 'maint_oil');
    assert.equal(result.catalog.records.vc_coolant[0].date, '2026-07-20');
    assert.equal(result.catalog.records.vc_vtv[0].date, '2027-02-10');
});

test('an existing catalog is authoritative and migration is idempotent', () => {
    const catalog = {
        version: 1,
        cards: [{
            id: 'vc_custom',
            name: 'Correa auxiliar',
            type: 'maintenance',
            section: 'maintenance',
            icon: 'ph-wrench',
            actionLabel: 'Registrar cambio',
            intervalKm: 30000,
            warningKm: 2000,
            alertKey: 'vehicle_card:vc_custom',
            alert: { enabled: true, time: '23:00' }
        }],
        records: { vc_custom: [] }
    };
    const result = migrateVehicleCatalog({
        catalogValue: catalog,
        hasLegacyData: true,
        maintenanceLog: [{ type: 'Aceite y Filtros', date: '2026-01-01', km: 1 }]
    });

    assert.equal(result.migrated, false);
    assert.deepEqual(result.catalog.cards.map(card => card.id), ['vc_custom']);
});

test('vehicle cards support maintenance, checks and document expirations', () => {
    const now = new Date('2026-08-01T12:00:00-03:00');
    const maintenance = createVehicleCard({
        name: 'Correa auxiliar',
        type: 'maintenance',
        section: 'maintenance',
        intervalKm: 30000,
        warningKm: 2000,
        alert: { enabled: true, time: '23:00' }
    }, { id: 'vc_belt', now });
    const check = createVehicleCard({
        name: 'Presión de neumáticos',
        type: 'check',
        section: 'maintenance',
        intervalDays: 30,
        warningDays: 5
    }, { id: 'vc_pressure', now });
    const document = createVehicleCard({
        name: 'Cédula verde',
        type: 'document',
        section: 'documents',
        warningDays: 30
    }, { id: 'vc_card', now });

    assert.equal(getVehicleCardState(maintenance, [{ id: 'r1', date: '2026-01-01', km: 10000 }], {
        currentKm: 40500,
        now
    }).tone, 'red');
    assert.equal(getVehicleCardState(check, [{ id: 'r2', date: '2026-07-01' }], { now }).tone, 'red');
    assert.equal(getVehicleCardState(document, [{ id: 'r3', date: '2026-08-20' }], { now }).shouldNotify, true);
});

test('records append without mutating the original catalog and alerts follow active cards', () => {
    const card = createVehicleCard({
        name: 'Presión de neumáticos',
        type: 'check',
        section: 'maintenance',
        intervalDays: 30,
        warningDays: 5,
        alert: { enabled: true, time: '10:00' }
    }, { id: 'vc_pressure', now: new Date('2026-08-01T12:00:00-03:00') });
    const source = normalizeVehicleCatalog({ cards: [card], records: { vc_pressure: [] } });
    const updated = appendVehicleCardRecord(source, card.id, {
        id: 'record_1',
        date: '2026-08-01'
    });

    assert.equal(source.records.vc_pressure.length, 0);
    assert.equal(updated.records.vc_pressure.length, 1);
    assert.deepEqual(buildVehicleAlertDefinitions(updated).map(item => item.key), [
        'vehicle_card:vc_pressure'
    ]);
});

test('strict validation rejects malformed vehicle catalogs', () => {
    assert.throws(() => validateVehicleCatalog({
        cards: [{ id: '__proto__', name: 'Maliciosa', type: 'check' }],
        records: {}
    }), /inválida/);
});

test('cards with history keep their specialized type when edited', () => {
    const card = createVehicleCard({
        name: 'Correa auxiliar',
        type: 'maintenance',
        section: 'maintenance',
        intervalKm: 30000
    }, { id: 'vc_belt' });
    const catalog = appendVehicleCardRecord({
        cards: [card],
        records: { vc_belt: [] }
    }, card.id, { id: 'r1', date: '2026-08-01', km: 1000 });

    assert.throws(() => updateVehicleCard(catalog, card.id, {
        type: 'document',
        section: 'documents'
    }), /historial/);
    assert.equal(updateVehicleCard(catalog, card.id, {
        name: 'Correa de accesorios',
        intervalKm: 40000
    }).cards[0].name, 'Correa de accesorios');
});

test('permanent vehicle-card deletion requires archives and removes its history', () => {
    const card = createVehicleCard({
        name: 'Correa auxiliar',
        type: 'maintenance',
        section: 'maintenance',
        intervalKm: 30000
    }, { id: 'vc_delete_belt' });
    const source = appendVehicleCardRecord({
        cards: [card],
        records: { [card.id]: [] }
    }, card.id, { id: 'r_delete_1', date: '2026-08-01', km: 1000 });

    assert.throws(
        () => deleteVehicleCardPermanently(source, card.id),
        /archivada/
    );

    const archived = updateVehicleCard(source, card.id, { archived: true });
    const result = deleteVehicleCardPermanently(archived, card.id);
    assert.equal(result.deletedCard.id, card.id);
    assert.deepEqual(result.catalog.cards, []);
    assert.equal(Object.hasOwn(result.catalog.records, card.id), false);
    assert.equal(source.cards.length, 1);
});

test('vehicle cards reject warning thresholds that cannot be reached coherently', () => {
    assert.throws(() => createVehicleCard({
        name: 'Correa auxiliar',
        type: 'maintenance',
        section: 'maintenance',
        intervalKm: 30000,
        warningKm: 40000
    }, { id: 'vc_invalid_warning' }), /no puede superar el intervalo/);

    assert.throws(() => validateVehicleCatalog({
        cards: [{
            id: 'vc_invalid_days',
            name: 'Control visual',
            type: 'check',
            section: 'maintenance',
            intervalDays: 30,
            warningDays: 60
        }],
        records: { vc_invalid_days: [] }
    }), /no puede superar el intervalo/);
});
