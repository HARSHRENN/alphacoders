import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { onIdTokenChanged, reload, signOut, User } from 'firebase/auth';
import { Data, Profile, Project, UpdateInput, WorkSession } from './types';
import { ensureDatabaseAccess, supabase } from './lib/supabase';
import { firebaseAuth } from './lib/firebase';
import { cancelNotifications, syncPushRegistration } from './lib/notifications';
import { validateUpdate } from './lib/domain';

type Store = {
  data: Data | null;
  me: Profile | null;
  loading: boolean;
  error: string;
  session: { user: { id: string; email: string | null; emailVerified: boolean } } | null;
  reloadAccount: () => Promise<void>;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  addUpdate: (input: UpdateInput) => Promise<void>;
  addProject: (
    p: Pick<Project, 'name' | 'description' | 'deadline' | 'priority' | 'color' | 'icon'>,
  ) => Promise<void>;
  startWork: () => Promise<void>;
  stopWork: (sessionId?: string) => Promise<void>;
  setPreferences: (cadence: number, enabled: boolean) => Promise<void>;
  archive: (id: string) => Promise<void>;
  promote: (id: string) => Promise<void>;
};
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
function account(user: User | null) {
  return user
    ? { user: { id: user.uid, email: user.email, emailVerified: user.emailVerified } }
    : null;
}
// Read the whole recent window, rather than silently truncating team totals at
// PostgREST's default row limit. Ascending immutable start times keep pages stable.
async function loadWorkSessions(org: string): Promise<WorkSession[]> {
  const cutoff = new Date(Date.now() - 31 * 86400000).toISOString();
  const sessions: WorkSession[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase!
      .from('work_sessions')
      .select('*')
      .eq('org_id', org)
      .or(`ended_at.is.null,ended_at.gte.${cutoff}`)
      .order('started_at')
      .order('id')
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    sessions.push(...result.data);
    if (result.data.length < 500) return sessions;
  }
}
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const accountUid = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const [data, setData] = useState<Data | null>(null),
    [meId, setMeId] = useState('me'),
    [session, setSession] = useState<Store['session']>(null),
    [loading, setLoading] = useState(!!firebaseAuth),
    [error, setError] = useState('');
  const me = data?.profiles.find((p) => p.id === meId) ?? null;
  const refresh = useCallback(async () => {
    const request = ++refreshSequence.current;
    const user = firebaseAuth?.currentUser;
    if (!supabase || !user?.emailVerified) return;
    await ensureDatabaseAccess();
    const identity = await supabase.rpc('register_identity');
    if (identity.error) throw identity.error;
    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', identity.data)
      .maybeSingle();
    if (result.error) throw result.error;
    if (firebaseAuth?.currentUser?.uid !== user.uid || request !== refreshSequence.current) return;
    if (!result.data) {
      setData(null);
      return;
    }
    const org = result.data.org_id;
    const [workspace, profiles, projects, updates, workSessions] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', org).single(),
      supabase.from('profiles').select('*').eq('org_id', org),
      supabase.from('projects').select('*').eq('org_id', org).order('created_at'),
      supabase
        .from('work_updates')
        .select('*')
        .eq('org_id', org)
        .order('created_at', { ascending: false })
        .limit(1000),
      loadWorkSessions(org),
    ]);
    for (const result of [workspace, profiles, projects, updates])
      if (result.error) throw result.error;
    // Never apply a delayed request from an account that has since signed out.
    if (firebaseAuth?.currentUser?.uid !== user.uid || request !== refreshSequence.current) return;
    setError('');
    setMeId(identity.data);
    setData({
      workspace: workspace.data,
      profiles: profiles.data!,
      projects: projects.data!,
      updates: updates.data!,
      work_sessions: workSessions,
    });
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!firebaseAuth) return;
    const unsubscribe = onIdTokenChanged(
      firebaseAuth,
      (user) => {
        if (!mounted) return;
        if (accountUid.current !== user?.uid || !user?.emailVerified) setData(null);
        accountUid.current = user?.uid ?? null;
        const next = account(user);
        setSession((previous) =>
          previous?.user.id === next?.user.id &&
          previous?.user.emailVerified === next?.user.emailVerified &&
          previous?.user.email === next?.user.email
            ? previous
            : next,
        );
        setLoading(false);
      },
      (e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session?.user.emailVerified) return;
    Promise.resolve()
      .then(refresh)
      .catch((e) => setError(e.message));
    const timer = setInterval(() => refresh().catch((e) => setError(e.message)), 30000);
    const channel = supabase
      ?.channel(`workspace:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_updates' }, () =>
        refresh().catch((e) => setError(e.message)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () =>
        refresh().catch((e) => setError(e.message)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        refresh().catch((e) => setError(e.message)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_sessions' }, () =>
        refresh().catch((e) => setError(e.message)),
      )
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh().catch((e) => setError(e.message));
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      if (channel) supabase?.removeChannel(channel);
    };
  }, [session, refresh]);
  async function reloadAccount() {
    const user = firebaseAuth?.currentUser;
    if (!user) return;
    await reload(user);
    await user.getIdToken(true);
    setSession(account(user));
    await refresh();
  }
  const liveId = me?.notifications_enabled ? me.id : null;
  useEffect(() => {
    if (!liveId) return;
    const sync = () => {
      syncPushRegistration(liveId).catch((e) => setError(e.message));
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [liveId]);
  async function leave() {
    // Stop on the server first, including sessions started from another device.
    // A failed request must not silently sign someone out with their clock running.
    if (supabase && me?.role === 'member') {
      const { error: stopError } = await supabase.rpc('stop_work');
      if (stopError)
        throw new Error(
          'Could not stop your work timer. Check your connection and try signing out again.',
        );
    }
    await cancelNotifications();
    try {
      if (supabase && me) {
        const { error: e } = await supabase.from('push_tokens').delete().eq('user_id', meId);
        if (e) throw e;
      }
    } finally {
      if (firebaseAuth) await signOut(firebaseAuth);
      setData(null);
      setSession(null);
      setError('');
    }
  }
  async function changeWorkClock(action: 'start_work' | 'stop_work', sessionId?: string) {
    if (!supabase || !me) throw new Error('Please sign in to your workspace.');
    if (action === 'start_work' && me.role !== 'member')
      throw new Error('Work timers are for team members only.');
    const uid = firebaseAuth?.currentUser?.uid;
    const result =
      action === 'stop_work'
        ? await supabase.rpc(action, { session_id: sessionId || null })
        : await supabase.rpc(action);
    if (result.error)
      throw new Error('Could not save your work time. Check your connection and try again.');
    if (firebaseAuth?.currentUser?.uid !== uid) return;
    ++refreshSequence.current;
    const work = (Array.isArray(result.data) ? result.data[0] : result.data) as WorkSession | null;
    if (work?.id)
      setData((previous) =>
        previous
          ? {
              ...previous,
              work_sessions: [
                ...previous.work_sessions.filter((item) => item.id !== work.id),
                work,
              ],
            }
          : previous,
      );
    // The confirmed server record already updates the clock, even if a later
    // refresh fails. Repeating start/stop is safe and cannot rewrite old times.
    try {
      await refresh();
    } catch {
      setError('Your work time was saved. Pull down to refresh the rest of your workspace.');
    }
  }
  async function addUpdate(input: UpdateInput) {
    if (!data || !me) throw new Error('Please sign in.');
    validateUpdate(input);
    const project = data.projects.find((p) => p.id === input.project_id);
    if (!project || project.archived) throw new Error('Choose an active project.');
    const row = { ...input, org_id: me.org_id, user_id: me.id };
    {
      const { error: e } = await supabase!.from('work_updates').insert(row);
      if (e) throw e;
      await refresh();
    }
  }
  async function addProject(
    input: Pick<Project, 'name' | 'description' | 'deadline' | 'priority' | 'color' | 'icon'>,
  ) {
    if (me?.role !== 'founder') throw new Error('Only founders can create projects.');
    if (!input.name.trim()) throw new Error('Give this project a name.');
    if (!Number.isFinite(Date.parse(input.deadline)) || Date.parse(input.deadline) <= Date.now())
      throw new Error('Choose a future deadline.');
    const row = { ...input, name: input.name.trim(), org_id: me.org_id, archived: false };
    {
      const { error: e } = await supabase!.from('projects').insert(row);
      if (e) throw e;
      await refresh();
    }
  }
  async function setPreferences(cadence: number, enabled: boolean) {
    if (!me) return;
    if (![1, 2].includes(cadence)) throw new Error('Choose one or two hours.');
    if (!enabled) await cancelNotifications();
    {
      const { error: e } = await supabase!
        .from('profiles')
        .update({ cadence, notifications_enabled: enabled })
        .eq('id', me.id);
      if (e) throw e;
      await refresh();
    }
  }
  async function archive(id: string) {
    if (me?.role !== 'founder') throw new Error('Only founders can archive projects.');
    {
      const project = data?.projects.find((p) => p.id === id);
      const { error: e } = await supabase!
        .from('projects')
        .update({ archived: !project?.archived })
        .eq('id', id);
      if (e) throw e;
      await refresh();
    }
  }
  async function promote(id: string) {
    if (me?.role !== 'founder') throw new Error('Only founders can promote members.');
    {
      const { error: e } = await supabase!.rpc('promote_founder', { member_id: id });
      if (e) throw e;
      await refresh();
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        me,
        session,
        reloadAccount,
        loading,
        error,
        leave,
        refresh,
        addUpdate,
        addProject,
        startWork: () => changeWorkClock('start_work'),
        stopWork: (sessionId) => changeWorkClock('stop_work', sessionId),
        setPreferences,
        archive,
        promote,
        clearError: () => setError(''),
      }}
    >
      {children}
    </Context.Provider>
  );
}
