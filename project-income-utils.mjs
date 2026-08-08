import {
    getLocalISODate,
    getLocalISOMonth,
    parseDateLocal
} from './date-utils.mjs?v=20260727-date-fix';

const MONEY_EPSILON = 0.005;

function asList(value) {
    return Array.isArray(value) ? value : [];
}

function asAmount(value) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount : 0;
}

function normalizeMovementDate(value, fallbackDate) {
    const parsed = parseDateLocal(value);
    return parsed ? getLocalISODate(parsed) : fallbackDate;
}

function getProjectIdentity(project) {
    return {
        projectId: String(project?.id ?? ''),
        client: String(project?.client || ''),
        project: String(project?.project || ''),
        source: project?.source || 'workana'
    };
}

function buildPartialMovement(project, release, index, scope, fallbackDate) {
    const identity = getProjectIdentity(project);
    const percent = asAmount(release?.percent);
    return {
        id: `proj-partial-${scope}-${identity.projectId}-${release?.id || index}`,
        ...identity,
        scope,
        kind: 'partial',
        date: normalizeMovementDate(release?.date, fallbackDate),
        amount: asAmount(release?.netAmount),
        percent,
        canReverse: false,
        description: `[Parcial ${percent}%] ${identity.client} - ${identity.project}`
    };
}

export function buildProjectIncomeMovements({
    activeProjects = [],
    historyProjects = [],
    fallbackDate = getLocalISODate(),
    includeZeroFinals = false
} = {}) {
    const movements = [];

    asList(activeProjects).forEach(project => {
        asList(project?.partialReleases).forEach((release, index) => {
            movements.push(buildPartialMovement(
                project,
                release,
                index,
                'active',
                fallbackDate
            ));
        });
    });

    asList(historyProjects).forEach(project => {
        const identity = getProjectIdentity(project);
        const releases = asList(project?.partialReleases);
        let releasedNet = 0;

        releases.forEach((release, index) => {
            const movement = buildPartialMovement(
                project,
                release,
                index,
                'hist',
                fallbackDate
            );
            releasedNet += movement.amount;
            movements.push(movement);
        });

        const paymentDate = normalizeMovementDate(
            project?.deliveredDate || project?.deliveredAt,
            fallbackDate
        );
        const totalNet = asAmount(project?.budgetNet);

        if (releases.length === 0) {
            movements.push({
                id: `proj-${identity.projectId}`,
                ...identity,
                scope: 'history',
                kind: 'total',
                date: paymentDate,
                amount: totalNet,
                percent: 100,
                canReverse: true,
                description: `${identity.client} - ${identity.project}`
            });
            return;
        }

        const remainingNet = Math.max(0, totalNet - releasedNet);
        if (remainingNet > MONEY_EPSILON || includeZeroFinals) {
            movements.push({
                id: `proj-final-${identity.projectId}`,
                ...identity,
                scope: 'history',
                kind: 'final',
                date: paymentDate,
                amount: remainingNet,
                percent: null,
                canReverse: true,
                description: `[Final] ${identity.client} - ${identity.project}`
            });
        }
    });

    return movements;
}

export function getMovementMonthKey(value) {
    const parsed = parseDateLocal(value);
    return parsed ? getLocalISOMonth(parsed) : '';
}

export function groupProjectIncomeMovementsByMonth(movements) {
    return asList(movements).reduce((groups, movement) => {
        const monthKey = getMovementMonthKey(movement?.date);
        if (!monthKey) return groups;
        if (!groups[monthKey]) {
            groups[monthKey] = {
                movements: [],
                totalNet: 0
            };
        }
        groups[monthKey].movements.push(movement);
        groups[monthKey].totalNet += asAmount(movement?.amount);
        return groups;
    }, Object.create(null));
}

function monthIndex(value) {
    const key = getMovementMonthKey(value);
    if (!key) return null;
    const [year, month] = key.split('-').map(Number);
    return (year * 12) + month - 1;
}

export function calculateClosedMonthAverages(movements, {
    today = new Date()
} = {}) {
    const currentMonthIndex = monthIndex(today);
    if (currentMonthIndex === null) {
        return { historical: 0, last6: 0, last3: 0 };
    }

    const closedMovements = asList(movements)
        .map(movement => ({
            amount: asAmount(movement?.amount),
            monthIndex: monthIndex(movement?.date)
        }))
        .filter(movement => (
            movement.monthIndex !== null
            && movement.monthIndex < currentMonthIndex
        ));

    if (closedMovements.length === 0) {
        return { historical: 0, last6: 0, last3: 0 };
    }

    const earliestMonthIndex = Math.min(
        ...closedMovements.map(movement => movement.monthIndex)
    );
    const historicalMonths = Math.max(
        1,
        currentMonthIndex - earliestMonthIndex
    );
    const historicalTotal = closedMovements.reduce(
        (sum, movement) => sum + movement.amount,
        0
    );

    const sumLastClosedMonths = count => closedMovements
        .filter(movement => movement.monthIndex >= currentMonthIndex - count)
        .reduce((sum, movement) => sum + movement.amount, 0);

    return {
        historical: historicalTotal / historicalMonths,
        last6: sumLastClosedMonths(6) / 6,
        last3: sumLastClosedMonths(3) / 3
    };
}
