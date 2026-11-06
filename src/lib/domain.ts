import type { Data, WorkUpdate, WorkSession } from '../types';
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
  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)
    throw new Error('Progress must be a whole number from 0 to 100.');
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
    'WORK TIME TODAY',
    ...data.profiles
      .filter((person) => person.role === 'member')
      .map((person) => {
        const now = Date.now();
        const from = workDayStart(now);
        const sessions = (data.work_sessions || []).filter(
          (work) => work.user_id === person.id && workDurationMs(work, from, now) > 0,
        );
        return `${person.name}: ${formatWorkDuration(workTotalMs(sessions, from, now))}\n${sessions.map((work) => `Start: ${new Date(work.started_at).toLocaleString()} · Stop: ${work.ended_at ? new Date(work.ended_at).toLocaleString() : 'Still working'}`).join('\n')}`;
      }),
    'WORK UPDATES TODAY',
    ...data.updates
      .filter((u) => isToday(u.created_at))
      .map(
        (u) =>
          `${data.profiles.find((p) => p.id === u.user_id)?.name} / ${data.projects.find((p) => p.id === u.project_id)?.name}\nCompleted: ${u.completed}\nRemaining: ${u.remaining || 'All done'}\nBlocker: ${u.blocker || 'None'}\nProgress: ${u.progress}% · ETA: ${new Date(u.eta).toLocaleString()}\nReported: ${new Date(u.created_at).toLocaleString()}`,
      ),
  ].join('\n\n');
}

/** Clip sessions to the chosen local-day window, including overnight work. */
export function workDurationMs(session: WorkSession, from: number, to: number) {
  const start = Math.max(Date.parse(session.started_at), from);
  const end = Math.min(session.ended_at ? Date.parse(session.ended_at) : to, to);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}
export function workTotalMs(sessions: WorkSession[], from: number, to: number) {
  return sessions.reduce((total, session) => total + workDurationMs(session, from, to), 0);
}
export function workDayStart(now: number, days = 1) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date.getTime();
}
export function formatWorkDuration(ms: number, seconds = false) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (!seconds && total > 0 && total < 60) return `${total}s`;
  return seconds
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    : `${hours}h ${minutes}m`;
}

/** Founder totals count team members only; old founder sessions never inflate them. */
export function teamWorkSummary(data: Data, now: number) {
  const memberIds = new Set(
    data.profiles.filter((person) => person.role === 'member').map((person) => person.id),
  );
  const from = workDayStart(now);
  const sessions = data.work_sessions.filter((work) => memberIds.has(work.user_id));
  const today = data.updates.filter(
    (update) =>
      memberIds.has(update.user_id) &&
      Date.parse(update.created_at) >= from &&
      Date.parse(update.created_at) <= now,
  );
  const projects = data.projects.filter((project) => !project.archived);
  const progress = projects.map((project) => ({
    project,
    value: projectProgress(project.id, data.updates),
  }));
  return {
    members: memberIds.size,
    updatedMembers: new Set(today.map((update) => update.user_id)).size,
    workingMembers: new Set(
      sessions
        .filter((work) => !work.ended_at && Date.parse(work.started_at) <= now)
        .map((work) => work.user_id),
    ).size,
    totalMs: workTotalMs(sessions, from, now),
    completedProjects: progress.filter((item) => item.value === 100).length,
    overdueProjects: progress.filter(
      (item) => item.value < 100 && Date.parse(item.project.deadline) < now,
    ).length,
  };
}
