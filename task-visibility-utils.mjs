export const COMPLETED_TASK_HIDE_DELAY_MS = 24 * 60 * 60 * 1000;

export function shouldHideCompletedTask(task, {
    enabled = false,
    now = Date.now(),
    delayMs = COMPLETED_TASK_HIDE_DELAY_MS
} = {}) {
    if (!enabled || !task?.completed) return false;
    const completedTime = task.completedAt || task.completed_at || task.updatedAt;
    if (!completedTime) return false;
    const timestamp = new Date(completedTime).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return Number(now) - timestamp >= delayMs;
}
