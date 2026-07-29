export const CLOUD_SYNC_KEYS = Object.freeze([
    'hygiene_tracker_data',
    'groomingData_v2',
    'lensesStartTime',
    'lensesHistory',
    'lensStock',
    'lensDate',
    'solutionDate',
    'caseDate',
    'systaneDate',
    'clothWashDate',
    'clothChangeDate',
    'health_medical_data',
    'health_blood_tests',
    'vehicle_odometer',
    'vehicle_maintenance_log',
    'gym_records',
    'gym_routine',
    'gym_routine_focus',
    'gym_sessions',
    'gym_active_session',
    'gym_meals',
    'gym_general_meals',
    'gym_supplements',
    'gym_weight',
    'projectPulseData',
    'projectPulseHistory',
    'projectPulseSubscription',
    'projectPulseTemplates',
    'alerts_config',
    'finanzasData',
    'vehicle_tracker_data',
    'vehicle_issues',
    'tareas_list',
    'tareas_categories',
    'tareas_pinned_projects',
    'tareas_pinned_project_ids',
    'tareas_removed_project_ids'
]);

export const CLOUD_SERVER_MANAGED_KEYS = Object.freeze([
    'alerts_sent_log',
    'robot_last_notified_at',
    'very_urgent_last_notified_at'
]);

export const CLOUD_RESTORE_KEYS = Object.freeze([
    ...CLOUD_SYNC_KEYS
]);

export const CLOUD_LOCAL_CLEAR_KEYS = Object.freeze([
    ...CLOUD_SYNC_KEYS,
    ...CLOUD_SERVER_MANAGED_KEYS
]);

export const SYNC_PENDING_STORAGE_KEY = 'lifecycle_pending_sync_keys';
