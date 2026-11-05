export type Role = 'founder' | 'member';
export type Profile = {
  id: string;
  name: string;
  role: Role;
  org_id: string;
  avatar: string;
  cadence: number;
  notifications_enabled: boolean;
  reminder_anchor: string;
};
export type Project = {
  id: string;
  org_id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  archived: boolean;
  created_at: string;
};
export type WorkUpdate = {
  id: string;
  org_id: string;
  project_id: string;
  user_id: string;
  completed: string;
  remaining: string;
  blocker: string;
  progress: number;
  eta: string;
  created_at: string;
  period_hours: number;
  supersedes: string | null;
};
export type WorkSession = {
  id: string;
  org_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
};
export type Workspace = { id: string; name: string; invite_code: string };
export type Data = {
  workspace: Workspace;
  profiles: Profile[];
  projects: Project[];
  updates: WorkUpdate[];
  work_sessions: WorkSession[];
};
export type UpdateInput = Omit<WorkUpdate, 'id' | 'org_id' | 'user_id' | 'created_at'>;
