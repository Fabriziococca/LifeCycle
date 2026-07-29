const TASK_MODULES = new Set(['tareas', 'projects_tasks']);
const PROJECT_MODULES = new Set(['projects', 'workana']);

export const TODAY_GROUPS = Object.freeze([
    Object.freeze({
        id: 'tasks',
        label: 'Tareas prioritarias',
        description: 'Urgentes y muy urgentes, sin importar en qué carpeta o proyecto estén.',
        icon: 'ph-check-square'
    }),
    Object.freeze({
        id: 'projects',
        label: 'Proyectos y vencimientos',
        description: 'Entregas, suscripciones y fechas que necesitan una decisión cercana.',
        icon: 'ph-briefcase'
    }),
    Object.freeze({
        id: 'followups',
        label: 'Seguimientos pendientes',
        description: 'Controles y rutinas que ya alcanzaron su fecha de atención.',
        icon: 'ph-calendar-check'
    })
]);

function getGroupId(item) {
    if (TASK_MODULES.has(item?.module)) return 'tasks';
    if (PROJECT_MODULES.has(item?.module)) return 'projects';
    return 'followups';
}

function getPriorityScore(item) {
    if (item?.urgency === 'muy_urgente') return 0;
    if (item?.urgency === 'urgente') return 1;
    if (item?.module === 'projects' && item?.overdue === true) return 2;
    if (item?.module === 'projects') return 3;
    return 4;
}

export function buildTodayOverview(items) {
    const safeItems = Array.isArray(items)
        ? items.filter(item => item && typeof item === 'object')
        : [];
    const grouped = Object.fromEntries(TODAY_GROUPS.map(group => [group.id, []]));

    safeItems
        .map((item, sourceIndex) => ({
            ...item,
            groupId: getGroupId(item),
            sourceIndex,
            priorityScore: getPriorityScore(item)
        }))
        .sort((left, right) => (
            left.priorityScore - right.priorityScore
            || left.sourceIndex - right.sourceIndex
        ))
        .forEach(item => grouped[item.groupId].push(item));

    return {
        total: safeItems.length,
        counts: {
            tasks: grouped.tasks.length,
            projects: grouped.projects.length,
            followups: grouped.followups.length
        },
        groups: TODAY_GROUPS.map(group => ({
            ...group,
            items: grouped[group.id]
        }))
    };
}
