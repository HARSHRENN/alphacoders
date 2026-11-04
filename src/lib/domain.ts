import type { Data, WorkUpdate } from '../types';
export function latestUpdates(updates: WorkUpdate[]): WorkUpdate[] {
  const seen = new Set<string>();
  return [...updates]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .filter((u) => {
      const key = `${u.project_id}:${u.user_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function projectProgress(projectId: string, updates: WorkUpdate[]) {
  const latest = latestUpdates(updates.filter((u) => u.project_id === projectId));
  return latest.length ? Math.round(latest.reduce((s, u) => s + u.progress, 0) / latest.length) : 0;
}
export function nextDue(anchor: string, cadence: number, now = Date.now()): number {
  const start = Date.parse(anchor),
    interval = cadence * 3600000;
  return start + (Math.floor(Math.max(0, now - start) / interval) + 1) * interval;
}
export function validateUpdate(input: {
  completed: string;
  remaining: string;
  progress: number;
  eta: string;
}) {
  if (!input.completed.trim()) throw new Error('Tell your team what you completed.');
  if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100)
    throw new Error('Progress must be between 0 and 100.');
  if (input.progress < 100 && !input.remaining.trim())
    throw new Error('Add the work that remains.');
  if (!Number.isFinite(Date.parse(input.eta)) || Date.parse(input.eta) <= Date.now())
    throw new Error('Choose a future expected completion time.');
}
export const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
export function relative(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`;
}
export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}
export function exportReport(data: Data) {
  return [
    `${data.workspace.name} · Daily report · ${new Date().toLocaleDateString()}`,
    ...data.updates
      .filter((u) => isToday(u.created_at))
      .map(
        (u) =>
          `${data.profiles.find((p) => p.id === u.user_id)?.name} / ${data.projects.find((p) => p.id === u.project_id)?.name}\nCompleted: ${u.completed}\nRemaining: ${u.remaining || 'All done'}\nBlocker: ${u.blocker || 'None'}\nProgress: ${u.progress}% · ETA: ${new Date(u.eta).toLocaleString()}\nReported: ${new Date(u.created_at).toLocaleString()}`,
      ),
  ].join('\n\n');
}
