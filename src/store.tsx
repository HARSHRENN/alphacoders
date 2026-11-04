import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Data, Profile, Project, UpdateInput } from './types';
import { supabase } from './lib/supabase';
import { cancelNotifications, syncPushRegistration } from './lib/notifications';
import { validateUpdate } from './lib/domain';

type Store = {
  data: Data | null;
  me: Profile | null;
  loading: boolean;
  error: string;
  session: Session | null;
  leave: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  addUpdate: (input: UpdateInput) => Promise<void>;
  addProject: (
    p: Pick<Project, 'name' | 'description' | 'deadline' | 'priority' | 'color' | 'icon'>,
  ) => Promise<void>;
  setPreferences: (cadence: number, enabled: boolean) => Promise<void>;
  archive: (id: string) => Promise<void>;
  promote: (id: string) => Promise<void>;
};
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null),
    [meId, setMeId] = useState('me'),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState('');
  const me = data?.profiles.find((p) => p.id === meId) ?? null;
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s) return;
    const result = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      setData(null);
      return;
    }
    const org = result.data.org_id;
    const [workspace, profiles, projects, updates] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', org).single(),
      supabase.from('profiles').select('*').eq('org_id', org),
      supabase.from('projects').select('*').eq('org_id', org).order('created_at'),
      supabase
        .from('work_updates')
        .select('*')
        .eq('org_id', org)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);
    for (const result of [workspace, profiles, projects, updates])
      if (result.error) throw result.error;
    setMeId(s.user.id);
    setData({
      workspace: workspace.data,
      profiles: profiles.data!,
      projects: projects.data!,
      updates: updates.data!,
    });
  }, []);
  useEffect(() => {
    let mounted = true;
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s }, error: e }) => {
      if (!mounted) return;
      setSession(s);
      if (e) setError(e.message);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (!s) setData(null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session) return;
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
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        supabase?.auth.startAutoRefresh();
        refresh().catch((e) => setError(e.message));
      } else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      if (channel) supabase?.removeChannel(channel);
    };
  }, [session, refresh]);
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
    await cancelNotifications();
    if (supabase) {
      const { error: e } = await supabase.from('push_tokens').delete().eq('user_id', meId);
      if (e) throw e;
      const { error: signoutError } = await supabase.auth.signOut();
      if (signoutError) throw signoutError;
    }
    setData(null);
    setSession(null);
    setError('');
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
        loading,
        error,
        leave,
        refresh,
        addUpdate,
        addProject,
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
