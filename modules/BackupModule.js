import { getLocalISODate } from '../utils.js';

export class BackupModule {
    constructor(appController) {
        this.app = appController;
        this.btnExport = document.getElementById('btnExportUnified');
        this.importFile = document.getElementById('importFileUnified');
        this.init();
    }

    exportUnifiedData() {
        const unifiedData = {
            appName: "LifeCycle",
            exportDate: new Date().toISOString(),
            hygiene_tracker_data: localStorage.getItem('hygiene_tracker_data'),
            groomingData_v2: localStorage.getItem('groomingData_v2'),
            lensesStartTime: localStorage.getItem('lensesStartTime'),
            lensesHistory: localStorage.getItem('lensesHistory'),
            lensStock: localStorage.getItem('lensStock'),
            lensDate: localStorage.getItem('lensDate'),
            solutionDate: localStorage.getItem('solutionDate'),
            caseDate: localStorage.getItem('caseDate'),
            systaneDate: localStorage.getItem('systaneDate'),
            clothWashDate: localStorage.getItem('clothWashDate'),
            clothChangeDate: localStorage.getItem('clothChangeDate'),
            health_medical_data: localStorage.getItem('health_medical_data'),
            health_blood_tests: localStorage.getItem('health_blood_tests'),
            vehicle_odometer: localStorage.getItem('vehicle_odometer'),
            vehicle_maintenance_log: localStorage.getItem('vehicle_maintenance_log'),
            vehicle_tracker_data: localStorage.getItem('vehicle_tracker_data'),
            vehicle_issues: localStorage.getItem('vehicle_issues'),
            gym_records: localStorage.getItem('gym_records'),
            gym_routine: localStorage.getItem('gym_routine'),
            gym_routine_focus: localStorage.getItem('gym_routine_focus'),
            gym_sessions: localStorage.getItem('gym_sessions'),
            gym_meals: localStorage.getItem('gym_meals'),
            gym_general_meals: localStorage.getItem('gym_general_meals'),
            gym_supplements: localStorage.getItem('gym_supplements'),
            gym_weight: localStorage.getItem('gym_weight'),
            projectPulseData: localStorage.getItem('projectPulseData'),
            projectPulseHistory: localStorage.getItem('projectPulseHistory'),
            projectPulseSubscription: localStorage.getItem('projectPulseSubscription'),
            alerts_config: localStorage.getItem('alerts_config'),
            alerts_sent_log: localStorage.getItem('alerts_sent_log'),
            finanzasData: localStorage.getItem('finanzasData'),
            tareas_list: localStorage.getItem('tareas_list'),
            tareas_categories: localStorage.getItem('tareas_categories')
        };

        const blob = new Blob([JSON.stringify(unifiedData, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `LifeCycle_Backup_${getLocalISODate()}.json`;
        a.click();
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rawData = JSON.parse(e.target.result);
                let importedCategories = [];

                if (rawData.groomingData_v2) {
                    const dataVal = typeof rawData.groomingData_v2 === 'string' 
                        ? rawData.groomingData_v2 
                        : JSON.stringify(rawData.groomingData_v2);
                    localStorage.setItem('groomingData_v2', dataVal);
                    importedCategories.push("Cuidado Corporal (HabitSync)");
                }

                const lensKeys = [
                    'lensDate', 'solutionDate', 'caseDate', 'systaneDate',
                    'clothWashDate', 'clothChangeDate', 'lensStock',
                    'lensesHistory', 'lensesStartTime'
                ];
                let lensFound = false;
                lensKeys.forEach(key => {
                    if (rawData[key] !== undefined && rawData[key] !== null) {
                        const val = typeof rawData[key] === 'object' ? JSON.stringify(rawData[key]) : rawData[key];
                        localStorage.setItem(key, val);
                        lensFound = true;
                    }
                });
                if (lensFound) {
                    importedCategories.push("Lentes de Contacto (LensTracker)");
                }

                if (rawData.hygiene_tracker_data) {
                    const dataVal = typeof rawData.hygiene_tracker_data === 'string' 
                        ? rawData.hygiene_tracker_data 
                        : JSON.stringify(rawData.hygiene_tracker_data);
                    localStorage.setItem('hygiene_tracker_data', dataVal);
                    importedCategories.push("Higiene");
                } else if (rawData.appName === undefined && !rawData.groomingData_v2 && !lensFound && !rawData.gym_routine && !rawData.projectPulseData) {
                    localStorage.setItem('hygiene_tracker_data', JSON.stringify(rawData));
                    importedCategories.push("Higiene");
                }

                // Salud
                let healthFound = false;
                if (rawData.health_medical_data) {
                    const dataVal = typeof rawData.health_medical_data === 'string' 
                        ? rawData.health_medical_data 
                        : JSON.stringify(rawData.health_medical_data);
                    localStorage.setItem('health_medical_data', dataVal);
                    healthFound = true;
                }
                if (rawData.health_blood_tests) {
                    const dataVal = typeof rawData.health_blood_tests === 'string' 
                        ? rawData.health_blood_tests 
                        : JSON.stringify(rawData.health_blood_tests);
                    localStorage.setItem('health_blood_tests', dataVal);
                    healthFound = true;
                }
                if (healthFound) {
                    importedCategories.push("Salud y Controles Médicos");
                }

                // Vehículo
                let vehicleFound = false;
                if (rawData.vehicle_odometer !== undefined && rawData.vehicle_odometer !== null) {
                    localStorage.setItem('vehicle_odometer', rawData.vehicle_odometer.toString());
                    vehicleFound = true;
                }
                if (rawData.vehicle_maintenance_log) {
                    const dataVal = typeof rawData.vehicle_maintenance_log === 'string' 
                        ? rawData.vehicle_maintenance_log 
                        : JSON.stringify(rawData.vehicle_maintenance_log);
                    localStorage.setItem('vehicle_maintenance_log', dataVal);
                    vehicleFound = true;
                }
                if (rawData.vehicle_tracker_data) {
                    const dataVal = typeof rawData.vehicle_tracker_data === 'string' 
                        ? rawData.vehicle_tracker_data 
                        : JSON.stringify(rawData.vehicle_tracker_data);
                    localStorage.setItem('vehicle_tracker_data', dataVal);
                    vehicleFound = true;
                }
                if (rawData.vehicle_issues) {
                    const dataVal = typeof rawData.vehicle_issues === 'string' 
                        ? rawData.vehicle_issues 
                        : JSON.stringify(rawData.vehicle_issues);
                    localStorage.setItem('vehicle_issues', dataVal);
                    vehicleFound = true;
                }
                if (vehicleFound) {
                    importedCategories.push("Vehículo y Mantenimiento");
                }

                // Gimnasio
                const gymKeys = [
                    'gym_records', 'gym_routine', 'gym_routine_focus', 
                    'gym_sessions', 'gym_meals', 'gym_general_meals', 'gym_supplements', 'gym_weight'
                ];
                let gymFound = false;
                gymKeys.forEach(key => {
                    if (rawData[key] !== undefined && rawData[key] !== null) {
                        const val = typeof rawData[key] === 'object' ? JSON.stringify(rawData[key]) : rawData[key];
                        localStorage.setItem(key, val);
                        gymFound = true;
                    }
                });
                if (gymFound) {
                    importedCategories.push("Gimnasio (GymTracker)");
                }

                // Proyectos
                let projectsFound = false;
                if (rawData.projectPulseData) {
                    const dataVal = typeof rawData.projectPulseData === 'string' 
                        ? rawData.projectPulseData 
                        : JSON.stringify(rawData.projectPulseData);
                    localStorage.setItem('projectPulseData', dataVal);
                    projectsFound = true;
                }
                if (rawData.projectPulseHistory) {
                    const dataVal = typeof rawData.projectPulseHistory === 'string' 
                        ? rawData.projectPulseHistory 
                        : JSON.stringify(rawData.projectPulseHistory);
                    localStorage.setItem('projectPulseHistory', dataVal);
                    projectsFound = true;
                }
                if (rawData.projectPulseSubscription) {
                    const dataVal = typeof rawData.projectPulseSubscription === 'string' 
                        ? rawData.projectPulseSubscription 
                        : JSON.stringify(rawData.projectPulseSubscription);
                    localStorage.setItem('projectPulseSubscription', dataVal);
                    projectsFound = true;
                }
                if (projectsFound) {
                    importedCategories.push("Proyectos (ProjectPulse)");
                }

                // Finanzas
                if (rawData.finanzasData) {
                    const dataVal = typeof rawData.finanzasData === 'string' 
                        ? rawData.finanzasData 
                        : JSON.stringify(rawData.finanzasData);
                    localStorage.setItem('finanzasData', dataVal);
                    importedCategories.push("Finanzas");
                }

                if (rawData.alerts_config) {
                    const dataVal = typeof rawData.alerts_config === 'string' 
                        ? rawData.alerts_config 
                        : JSON.stringify(rawData.alerts_config);
                    localStorage.setItem('alerts_config', dataVal);
                    importedCategories.push("Configuración de Alertas");
                }

                if (rawData.alerts_sent_log) {
                    const dataVal = typeof rawData.alerts_sent_log === 'string' 
                        ? rawData.alerts_sent_log 
                        : JSON.stringify(rawData.alerts_sent_log);
                    localStorage.setItem('alerts_sent_log', dataVal);
                }

                // Tareas
                let tasksFound = false;
                if (rawData.tareas_list) {
                    const dataVal = typeof rawData.tareas_list === 'string'
                        ? rawData.tareas_list
                        : JSON.stringify(rawData.tareas_list);
                    localStorage.setItem('tareas_list', dataVal);
                    tasksFound = true;
                }
                if (rawData.tareas_categories) {
                    const dataVal = typeof rawData.tareas_categories === 'string'
                        ? rawData.tareas_categories
                        : JSON.stringify(rawData.tareas_categories);
                    localStorage.setItem('tareas_categories', dataVal);
                    tasksFound = true;
                }
                if (tasksFound) {
                    importedCategories.push("Lista de Tareas");
                }

                if (importedCategories.length > 0) {
                    alert(`Backup restaurado correctamente. Módulos importados:\n- ${importedCategories.join('\n- ')}`);
                    location.reload();
                } else {
                    alert('Archivo JSON válido pero no contiene datos compatibles de LifeCycle.');
                }
            } catch (err) {
                console.error(err);
                alert('Ocurrió un error al procesar el archivo. Asegúrate de que sea un JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    init() {
        if (this.btnExport) {
            this.btnExport.addEventListener('click', () => this.exportUnifiedData());
        }
        if (this.importFile) {
            this.importFile.addEventListener('change', (e) => this.importData(e));
        }
    }
}
