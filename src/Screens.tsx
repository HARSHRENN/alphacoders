import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, useWindowDimensions, Share, Switch } from 'react-native';
import { useStore } from './store';
import { Project, WorkUpdate } from './types';
import {
  Card,
  Heading,
  Section,
  Button,
  Tag,
  Icon,
  Avatar,
  Link,
  Empty,
  Sheet,
  ErrorText,
  C,
  s,
} from './components/ui';
import { ProjectCard } from './components/ProjectCard';
import { UpdateCard } from './components/UpdateCard';
import {
  dateLabel,
  timeLabel,
  relative,
  isToday,
  latestUpdates,
  nextDue,
  exportReport,
  projectProgress,
} from './lib/domain';
import { useClock } from './lib/useClock';
import { enableNotifications } from './lib/notifications';

type Navigation = {
  onUpdate: (id?: string) => void;
  onProject: (p: Project) => void;
  onNavigate: (tab: string) => void;
  onNewProject: () => void;
};
export function Overview({ onUpdate, onProject, onNavigate, onNewProject }: Navigation) {
  const { data, me } = useStore();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const now = useClock();
  const projects = data!.projects.filter((p) => !p.archived);
  const today = data!.updates.filter((u) => isToday(u.created_at));
  const blocked = latestUpdates(data!.updates).filter(
    (u) => u.blocker && projects.some((p) => p.id === u.project_id),
  );
  const reporters = new Set(today.map((u) => u.user_id));
  const due = nextDue(me!.reminder_anchor, me!.cadence, now);
  const minutes = Math.ceil((due - now) / 60000);
  const name = me!.name.split(' ')[0];
  const hour = new Date().getHours();
  const founder = me!.role === 'founder';
  return (
    <>
      <Heading
        eyebrow={data!.workspace.name.toUpperCase()}
        title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${name}`}
        description="See what’s done, what’s next, and who needs help."
        action={
          projects.length ? (
            <Button title="Post work update" icon="add" onPress={() => onUpdate()} />
          ) : founder ? (
            <Button title="Create first project" icon="add" onPress={onNewProject} />
          ) : undefined
        }
      />
      <Card
        style={{
          backgroundColor: '#193f32',
          borderColor: '#193f32',
          marginBottom: 12,
          gap: 12,
          flexDirection: wide ? 'row' : 'column',
          alignItems: wide ? 'center' : undefined,
        }}
      >
        <View style={[s.row, { alignItems: 'flex-start', flex: wide ? 1 : undefined }]}>
          <View style={{ backgroundColor: '#ffffff15', padding: 10, borderRadius: 12 }}>
            <Icon name="alarm-outline" color="#c2e59a" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: '#c6d9ce', fontSize: 12 }}>Next work update</Text>
            <Text style={{ color: 'white', fontSize: 23, fontWeight: '700' }}>
              In {minutes} min{' '}
              <Text style={{ color: '#c6d9ce', fontSize: 13, fontWeight: '400' }}>
                · {timeLabel(new Date(due).toISOString())}
              </Text>
            </Text>
            <Text style={{ color: '#c6d9ce', fontSize: 12 }}>
              Report the last {me!.cadence} hour{me!.cadence > 1 ? 's' : ''}: completed work,
              remaining tasks, and ETA.
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onNavigate('Settings')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            minHeight: 44,
            borderTopWidth: wide ? 0 : 1,
            borderLeftWidth: wide ? 1 : 0,
            width: wide ? 270 : undefined,
            borderColor: '#ffffff20',
            paddingTop: wide ? 0 : 8,
            paddingLeft: wide ? 16 : 0,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Icon
            name={me!.notifications_enabled ? 'notifications-outline' : 'notifications-off-outline'}
            color="#c2e59a"
            size={16}
          />
          <Text style={{ color: '#e1eee6', fontSize: 12, flex: 1 }}>
            {me!.notifications_enabled
              ? 'Reminders on · 5-minute warning included'
              : 'Reminders are off · Tap to enable'}
          </Text>
          <Icon name="chevron-forward" color="#c2e59a" size={16} />
        </Pressable>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {[
          {
            label: 'Active projects',
            value: projects.filter((p) => projectProgress(p.id, data!.updates) < 100).length,
            icon: 'layers-outline' as const,
            tab: 'Projects',
            color: '#6b5cce',
            bg: '#f1eefb',
          },
          {
            label: 'Updates today',
            value: today.length,
            icon: 'chatbox-ellipses-outline' as const,
            tab: 'Updates',
            color: C.green,
            bg: C.mint,
          },
          {
            label: 'Checked in today',
            value: `${reporters.size}/${data!.profiles.length}`,
            icon: 'people-outline' as const,
            tab: 'Team',
            color: '#416f96',
            bg: '#edf3f9',
          },
          {
            label: 'Open blockers',
            value: blocked.length,
            icon: 'flag-outline' as const,
            tab: 'Updates',
            color: '#9c681c',
            bg: '#fff3df',
          },
        ].map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}: ${item.value}. Open ${item.tab}`}
            onPress={() => onNavigate(item.tab)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: width < 600 ? '46%' : '22%',
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Card style={{ gap: 9 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View style={{ padding: 7, backgroundColor: item.bg, borderRadius: 9 }}>
                  <Icon name={item.icon} color={item.color} size={18} />
                </View>
                <Text style={{ fontSize: 25, fontWeight: '700', color: C.ink }}>{item.value}</Text>
              </View>
              <View style={[s.row, { gap: 4 }]}>
                <Text style={{ fontSize: 12, color: C.muted, flex: 1 }}>{item.label}</Text>
                <Icon name="chevron-forward" size={12} color={C.muted} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
      {!data!.projects.length ? (
        <Card style={{ marginBottom: 18, gap: 4 }}>
          <Text style={s.h2}>Get your workspace ready</Text>
          <Text style={[s.body, { marginBottom: 8 }]}>
            {founder
              ? 'Start a project, invite your team, then share your first update.'
              : 'Your founder will add projects. Enable reminders while you wait.'}
          </Text>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 16 : 0 }}>
            {[
              ...(founder
                ? [
                    {
                      label: 'Create a project',
                      detail: 'Set a goal, priority, and deadline',
                      done: false,
                      action: onNewProject,
                      icon: 'layers-outline' as const,
                    },
                    {
                      label: 'Invite teammates',
                      detail: `${data!.profiles.length} member${data!.profiles.length === 1 ? '' : 's'} in this workspace`,
                      done: data!.profiles.length > 1,
                      action: () => onNavigate('Team'),
                      icon: 'people-outline' as const,
                    },
                  ]
                : []),
              {
                label: 'Enable reminders',
                detail: 'Choose a 1-hour or 2-hour check-in',
                done: me!.notifications_enabled,
                action: () => onNavigate('Settings'),
                icon: 'notifications-outline' as const,
              },
            ].map((step) => (
              <Pressable
                key={step.label}
                accessibilityRole="button"
                onPress={step.action}
                style={({ pressed }) => [
                  s.row,
                  {
                    flex: wide ? 1 : undefined,
                    minHeight: 64,
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderColor: C.line,
                    opacity: pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Icon name={step.done ? 'checkmark-circle' : step.icon} color={C.green} size={22} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.h3}>{step.label}</Text>
                  <Text style={s.small}>{step.detail}</Text>
                </View>
                <Icon name="chevron-forward" color={C.muted} size={16} />
              </Pressable>
            ))}
          </View>
        </Card>
      ) : (
        <>
          <Section
            title="Your projects"
            action={<Link text="View all" onPress={() => onNavigate('Projects')} />}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
            {projects.slice(0, 3).map((p) => (
              <View
                key={p.id}
                style={{ flexGrow: 1, flexBasis: wide ? '30%' : '100%', minWidth: 0 }}
              >
                <ProjectCard project={p} onPress={() => onProject(p)} />
              </View>
            ))}
            {!projects.length ? (
              <View style={{ flex: 1 }}>
                <Empty
                  title="All projects archived"
                  body="Open Projects to restore one or create a new project."
                  action={
                    <Button
                      title="View projects"
                      secondary
                      onPress={() => onNavigate('Projects')}
                    />
                  }
                />
              </View>
            ) : null}
          </View>
        </>
      )}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Section
            title="Recent updates"
            action={<Link text="View all" onPress={() => onNavigate('Updates')} />}
          />
          <View style={{ gap: 10 }}>
            {data!.updates.slice(0, 3).map((u) => (
              <UpdateCard key={u.id} update={u} compact />
            ))}
            {!data!.updates.length ? (
              <Empty
                title="No work updates yet"
                body={
                  projects.length
                    ? 'Share what you completed, what remains, and when you’ll finish.'
                    : 'Work updates will appear here after a project is created.'
                }
                action={
                  projects.length ? (
                    <Button title="Post first update" secondary onPress={() => onUpdate()} />
                  ) : undefined
                }
              />
            ) : null}
          </View>
        </View>
        <View style={{ width: wide ? 280 : '100%' }}>
          <Section title="Today’s team activity" />
          <Card style={{ gap: 12 }}>
            {data!.profiles.slice(0, 5).map((p) => {
              const last = today.find((u) => u.user_id === p.id);
              return (
                <View key={p.id} style={s.row}>
                  <Avatar name={p.name} color={p.avatar} size={34} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.h3}>
                      {p.name}
                      {p.id === me!.id ? ' (you)' : ''}
                    </Text>
                    <Text style={s.small}>
                      {last ? relative(last.created_at) : 'No update today'}
                    </Text>
                  </View>
                  <Icon
                    name={last ? 'checkmark-circle' : 'time-outline'}
                    color={last ? C.green : C.orange}
                    size={18}
                  />
                </View>
              );
            })}
            <Link text="View team" onPress={() => onNavigate('Team')} />
          </Card>
        </View>
      </View>
    </>
  );
}
export function Projects({
  onProject,
  onNewProject,
}: Pick<Navigation, 'onProject' | 'onNewProject'>) {
  const { data, me } = useStore();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('Active'),
    [search, setSearch] = useState('');
  const projects = data!.projects.filter(
    (p) =>
      (filter === 'Archived' ? p.archived : !p.archived) &&
      (filter === 'Archived' ||
        (filter === 'Completed'
          ? projectProgress(p.id, data!.updates) === 100
          : projectProgress(p.id, data!.updates) < 100)) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="WORKSPACE"
        title="Projects"
        description="Track progress, priorities, and deadlines."
        action={
          me!.role === 'founder' ? (
            <Button title="New project" icon="add" onPress={onNewProject} />
          ) : undefined
        }
      />
      <View style={[s.row, { marginBottom: 16, flexWrap: 'wrap' }]}>
        <View style={[s.chips, { flexGrow: 1 }]}>
          {['Active', 'Completed', 'Archived'].map((t) => (
            <Pressable
              accessibilityRole="button"
              key={t}
              accessibilityState={{ selected: filter === t }}
              onPress={() => setFilter(t)}
              style={[s.chip, filter === t && s.chipActive]}
            >
              <Text style={s.chipText}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <View
          style={[
            s.row,
            {
              backgroundColor: 'white',
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 10,
              paddingHorizontal: 12,
              flexGrow: width < 600 ? 1 : 0,
              gap: 8,
            },
          ]}
        >
          <Icon name="search-outline" size={16} color={C.muted} />
          <TextInput
            accessibilityLabel="Search projects"
            value={search}
            onChangeText={setSearch}
            placeholder="Find a project…"
            placeholderTextColor={C.muted}
            style={{ paddingVertical: 13, color: C.ink, fontSize: 12, minWidth: 120, flex: 1 }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {projects.map((p) => (
          <View
            key={p.id}
            style={{
              flexGrow: 1,
              flexBasis: width < 600 ? '100%' : '46%',
              maxWidth: width < 600 ? undefined : 540,
            }}
          >
            <ProjectCard project={p} onPress={() => onProject(p)} />
          </View>
        ))}
      </View>
      {!projects.length ? (
        <Empty
          title={search ? 'No matching projects' : `No ${filter.toLowerCase()} projects`}
          body={
            search
              ? 'Try a different name or clear your search.'
              : me!.role === 'founder'
                ? 'Create a project to start collecting work updates.'
                : 'Your founder can create a project for the team.'
          }
          action={
            search ? (
              <Button title="Clear search" secondary onPress={() => setSearch('')} />
            ) : me!.role === 'founder' ? (
              <Button title="Create project" icon="add" onPress={onNewProject} />
            ) : undefined
          }
        />
      ) : null}
    </>
  );
}
export function Updates({
  onUpdate,
  onRevise,
}: {
  onUpdate: () => void;
  onRevise: (u: WorkUpdate) => void;
}) {
  const { data, me } = useStore();
  const now = useClock();
  const [scope, setScope] = useState('All updates'),
    [project, setProject] = useState('all'),
    [person, setPerson] = useState('all'),
    [period, setPeriod] = useState('Today'),
    [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = Number(project !== 'all') + Number(person !== 'all');
  const resetFilters = () => {
    setProject('all');
    setPerson('all');
    setScope('All updates');
    setPeriod('Today');
  };
  const updates = data!.updates.filter(
    (u) =>
      (scope !== 'My updates' || u.user_id === me!.id) &&
      (scope !== 'Blocked' || !!u.blocker) &&
      (project === 'all' || u.project_id === project) &&
      (person === 'all' || u.user_id === person) &&
      (period === 'All time' ||
        (period === 'Today'
          ? isToday(u.created_at)
          : now - Date.parse(u.created_at) <= Number(period) * 3600000)),
  );
  return (
    <>
      <Heading
        eyebrow="TEAM PROGRESS"
        title="Work updates"
        description="Completed work, remaining tasks, blockers, and finish times."
        action={<Button title="Post an update" icon="add" onPress={onUpdate} />}
      />
      <View style={[s.chips, { marginBottom: 18 }]}>
        {['All updates', 'My updates', 'Blocked'].map((t) => (
          <Pressable
            accessibilityRole="button"
            key={t}
            accessibilityState={{ selected: scope === t }}
            onPress={() => setScope(t)}
            style={[s.chip, scope === t && s.chipActive]}
          >
            <Text style={s.chipText}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ marginBottom: 14, padding: 12, gap: 10 }}>
        <View style={s.chips}>
          {['Today', '1', '2', 'All time'].map((t) => (
            <Pressable
              accessibilityRole="button"
              key={t}
              accessibilityState={{ selected: period === t }}
              onPress={() => setPeriod(t)}
              style={[s.chip, period === t && s.chipActive]}
            >
              <Text style={s.chipText}>{['1', '2'].includes(t) ? `Last ${t}h` : t}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Project and teammate filters"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((open) => !open)}
          style={({ pressed }) => [s.row, { minHeight: 44, opacity: pressed ? 0.65 : 1 }]}
        >
          <Icon name="options-outline" size={18} color={C.green} />
          <Text style={[s.h3, { flex: 1 }]}>
            Filter by project{me!.role === 'founder' ? ' or teammate' : ''}
            {filterCount ? ` (${filterCount})` : ''}
          </Text>
          <Icon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
        </Pressable>
        {filtersOpen ? (
          <View style={{ gap: 10 }}>
            <Text style={s.label}>Project</Text>
            <View style={s.chips}>
              {[{ id: 'all', name: 'All projects' }, ...data!.projects].map((p) => (
                <Pressable
                  accessibilityRole="button"
                  key={p.id}
                  accessibilityState={{ selected: project === p.id }}
                  onPress={() => setProject(p.id)}
                  style={[s.chip, project === p.id && s.chipActive]}
                >
                  <Text style={s.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
            {me!.role === 'founder' ? (
              <View style={{ gap: 8 }}>
                <Text style={s.label}>Teammate</Text>
                <View style={s.chips}>
                  {[{ id: 'all', name: 'Everyone' }, ...data!.profiles].map((p) => (
                    <Pressable
                      accessibilityRole="button"
                      key={p.id}
                      accessibilityState={{ selected: person === p.id }}
                      onPress={() => setPerson(p.id)}
                      style={[s.chip, person === p.id && s.chipActive]}
                    >
                      <Text style={s.chipText}>{p.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {filterCount ? <Link text="Clear filters" onPress={resetFilters} /> : null}
      </Card>
      <Text style={[s.small, { marginBottom: 14 }]}>
        {updates.length} update{updates.length === 1 ? '' : 's'} · Latest first
      </Text>
      <View style={{ gap: 14, maxWidth: 850 }}>
        {updates.map((u) => (
          <UpdateCard key={u.id} update={u} onRevise={onRevise} />
        ))}
      </View>
      {!updates.length ? (
        <Empty
          title="No updates to show"
          body="Try another period or clear the filters. Your team’s next update will appear here."
          action={
            scope !== 'All updates' || period !== 'Today' || filterCount ? (
              <Button title="Reset filters" secondary onPress={resetFilters} />
            ) : undefined
          }
        />
      ) : null}
    </>
  );
}
export function Team() {
  const { data, me, promote } = useStore();
  const { width } = useWindowDimensions();
  const [error, setError] = useState('');
  const [candidate, setCandidate] = useState<string | null>(null);
  const invite = async () => {
    try {
      await Share.share({
        message: `Join ${data!.workspace.name} on alphacoders. Create your account and enter workspace code: ${data!.workspace.invite_code}`,
      });
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <>
      <Heading
        eyebrow="YOUR WORKSPACE"
        title="Team"
        description="Manage teammates and see who has checked in today."
        action={
          me!.role === 'founder' ? (
            <Button title="Invite your team" icon="person-add-outline" onPress={invite} />
          ) : undefined
        }
      />
      <ErrorText text={error} />
      {me!.role === 'founder' ? (
        <Card style={{ marginBottom: 16, backgroundColor: '#edf3e9' }}>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <Icon name="link-outline" color={C.green} />
            <View style={{ flex: 1, minWidth: 180, gap: 5 }}>
              <Text style={s.h3}>Share your workspace invite code</Text>
              <Text style={s.body}>
                {`Invite code: ${data!.workspace.invite_code} · New members get their own login.`}
              </Text>
            </View>
            <Tag text="Invite-only workspace" />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {data!.profiles.map((p) => {
          const updates = data!.updates.filter((u) => u.user_id === p.id && isToday(u.created_at));
          const projects = new Set(
            data!.updates.filter((u) => u.user_id === p.id).map((u) => u.project_id),
          );
          return (
            <Card
              key={p.id}
              style={{
                flexBasis: width < 600 ? '100%' : 280,
                flexGrow: 1,
                maxWidth: width < 600 ? undefined : 420,
              }}
            >
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
                <Avatar name={p.name} color={p.avatar} size={40} />
                <Tag
                  text={p.role === 'founder' ? 'Founder' : 'Member'}
                  bg={p.role === 'founder' ? C.mint : '#f1f3f1'}
                  color={p.role === 'founder' ? C.green : C.muted}
                />
              </View>
              <Text style={s.h2}>
                {p.name}
                {p.id === me!.id ? ' (you)' : ''}
              </Text>
              <Text style={[s.body, { marginTop: 6 }]}>
                Every {p.cadence} hour{p.cadence > 1 ? 's' : ''} · Check-in rhythm
              </Text>
              <View style={s.divider} />
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View>
                  <Text style={{ fontSize: 22, color: C.ink, fontWeight: '600' }}>
                    {updates.length}
                  </Text>
                  <Text style={s.small}>Updates today</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 22, color: C.ink, fontWeight: '600' }}>
                    {projects.size}
                  </Text>
                  <Text style={s.small}>Projects contributed</Text>
                </View>
              </View>
              <View style={[s.row, { marginTop: 12, gap: 7 }]}>
                <Icon
                  name={updates.length ? 'checkmark-circle' : 'time-outline'}
                  size={15}
                  color={updates.length ? '#6a9e70' : C.orange}
                />
                <Text style={s.small}>
                  {updates.length
                    ? 'Checked in ' + relative(updates[0].created_at)
                    : 'No check-in yet today'}
                </Text>
              </View>
              {me!.role === 'founder' && p.role === 'member' ? (
                <View style={{ marginTop: 16 }}>
                  <Button
                    title="Make co-founder"
                    secondary
                    small
                    onPress={() => setCandidate(p.id)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
      <Sheet
        visible={!!candidate}
        title="Add a co-founder"
        subtitle="Co-founders can manage projects, invite teammates, and view all team updates."
        onClose={() => setCandidate(null)}
      >
        <Text style={[s.body, { marginBottom: 12 }]}>
          Give {data!.profiles.find((p) => p.id === candidate)?.name} founder access to{' '}
          {data!.workspace.name}?
        </Text>
        <Button
          title="Confirm founder access"
          onPress={() =>
            promote(candidate!)
              .then(() => setCandidate(null))
              .catch((e) => setError(e.message))
          }
        />
      </Sheet>
    </>
  );
}
export function Settings() {
  const { data, me, setPreferences, leave } = useStore();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function change(cadence: number, enabled: boolean) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (enabled) await enableNotifications({ ...me!, cadence });
      await setPreferences(cadence, enabled);
      setMessage('Your reminder preferences are saved.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR ACCOUNT"
        title="Settings"
        description="Manage your account and work reminders."
      />
      <View style={{ maxWidth: 760, gap: 14 }}>
        <Card>
          <View style={s.row}>
            <Avatar name={me!.name} color={me!.avatar} size={52} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.h2}>{me!.name}</Text>
              <Text style={s.body}>{data!.workspace.name}</Text>
            </View>
            <Tag text={me!.role === 'founder' ? 'Founder' : 'Member'} />
          </View>
          <View style={s.divider} />
          <Text style={s.body}>
            {me!.role === 'founder'
              ? 'You can create projects, invite teammates, review everyone’s updates, and export the daily report.'
              : 'You can view team projects, share progress, revise your own updates, and manage your reminders.'}
          </Text>
        </Card>
        <Card>
          <Section
            title="Work reminders"
            subtitle="Choose when to report your completed and remaining work."
          />
          <View style={[s.row, { justifyContent: 'space-between', marginVertical: 12 }]}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.h3}>Work update notifications</Text>
              <Text style={s.body}>
                Check-ins, deadline heads-ups{me!.role === 'founder' ? ', and team updates' : ''}.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Work update notifications"
              value={me!.notifications_enabled}
              disabled={busy}
              trackColor={{ false: '#dbe2dc', true: '#87b595' }}
              thumbColor="white"
              onValueChange={(enabled) => change(me!.cadence, enabled)}
            />
          </View>
          <View style={s.divider} />
          <Text style={[s.label, { marginBottom: 12 }]}>How often should we check in?</Text>
          <View style={s.chips}>
            {[1, 2].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                disabled={busy}
                accessibilityState={{ selected: me!.cadence === n }}
                onPress={() => change(n, me!.notifications_enabled)}
                style={[s.chip, me!.cadence === n && s.chipActive]}
              >
                <Text style={s.chipText}>
                  Every {n} hour{n > 1 ? 's' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          <View
            style={{
              backgroundColor: '#f5f7f2',
              padding: 15,
              borderRadius: 10,
              marginTop: 20,
              gap: 7,
            }}
          >
            <View style={s.row}>
              <Icon name="notifications-outline" color={C.green} size={17} />
              <Text style={s.h3}>A 5-minute heads-up, too.</Text>
            </View>
            <Text style={s.body}>
              Get a reminder five minutes before each check-in and project deadline. Delivery timing
              depends on Android settings and network availability.
            </Text>
          </View>
          <View style={{ marginTop: 18 }}>
            <ErrorText text={error} />
            {message ? <Text style={{ color: C.green, fontSize: 12 }}>{message}</Text> : null}
          </View>
        </Card>
        {me!.role === 'founder' ? (
          <Card>
            <Section
              title="Daily work report"
              subtitle="Share today’s completed work, remaining tasks, blockers, and ETAs."
            />
            <Button
              title="Export today’s report"
              secondary
              icon="share-outline"
              onPress={() =>
                Share.share({ message: exportReport(data!) }).catch((e) => setError(e.message))
              }
            />
          </Card>
        ) : null}
        <Button
          title="Sign out"
          secondary
          icon="log-out-outline"
          onPress={() => leave().catch((e) => setError(e.message))}
        />
      </View>
    </>
  );
}
export function ProjectDetail({
  project: p,
  onClose,
  onUpdate,
  onRevise,
}: {
  project: Project | null;
  onClose: () => void;
  onUpdate: (id: string) => void;
  onRevise: (u: WorkUpdate) => void;
}) {
  const { data, me, archive } = useStore();
  const [error, setError] = useState('');
  if (!p) return null;
  const current = data!.projects.find((x) => x.id === p.id)!;
  const updates = data!.updates.filter((u) => u.project_id === p.id);
  const progress = projectProgress(p.id, updates);
  return (
    <Sheet visible={!!p} onClose={onClose} title={p.name} subtitle={p.description}>
      <ErrorText text={error} />
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
        <Tag text={current.archived ? 'Archived' : p.priority + ' priority'} />
        <Text style={s.body}>
          Due {dateLabel(p.deadline)}, {timeLabel(p.deadline)}
        </Text>
      </View>
      <Text style={[s.h2, { marginBottom: 12 }]}>{progress}% team progress</Text>
      <Text style={[s.small, { marginBottom: 12 }]}>
        Average of each contributor’s latest reported progress.
      </Text>
      <View style={[s.progress, { marginBottom: 24 }]}>
        <View style={{ width: `${progress}%`, height: 5, backgroundColor: p.color }} />
      </View>
      {!current.archived ? (
        <Button title="Post a project update" icon="add" onPress={() => onUpdate(p.id)} />
      ) : null}
      <View style={{ marginTop: 18, gap: 14 }}>
        {updates.map((u) => (
          <UpdateCard key={u.id} update={u} onRevise={current.archived ? undefined : onRevise} />
        ))}
        {!updates.length ? (
          <Text style={s.body}>No updates yet. Start the conversation.</Text>
        ) : null}
      </View>
      {me!.role === 'founder' ? (
        <View style={{ marginTop: 24 }}>
          <Button
            title={current.archived ? 'Restore project' : 'Archive project'}
            secondary
            icon="archive-outline"
            onPress={() => archive(p.id).catch((e) => setError(e.message))}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
