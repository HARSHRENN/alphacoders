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
  const now = useClock();
  const projects = data!.projects.filter((p) => !p.archived);
  const today = data!.updates.filter((u) => isToday(u.created_at));
  const checkedIn = new Set(today.map((u) => u.user_id)).size;
  const due = nextDue(me!.reminder_anchor, me!.cadence, now);
  const minutes = Math.ceil((due - now) / 60000);
  const founder = me!.role === 'founder';
  const firstProject = !data!.projects.length;
  return (
    <>
      <Heading title={`Hi, ${me!.name.split(' ')[0]}`} description={data!.workspace.name} />
      {projects.length ? (
        <Card
          style={{ backgroundColor: '#edf5f0', borderColor: '#c9dfd1', gap: 12, marginBottom: 18 }}
        >
          <View style={s.row}>
            <View style={[s.emptyIcon, { backgroundColor: 'white' }]}>
              <Icon name="create-outline" color={C.green} size={23} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.h2}>Share your progress</Text>
              <Text style={s.body}>Tell the team what you finished and what’s next.</Text>
            </View>
          </View>
          <Button title="Post work update" icon="add" onPress={() => onUpdate()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage work reminders"
            onPress={() => onNavigate('Settings')}
            style={({ pressed }) => [s.row, { minHeight: 44, opacity: pressed ? 0.6 : 1, gap: 7 }]}
          >
            <Icon name="time-outline" size={17} color={C.green} />
            <Text style={[s.small, { flex: 1 }]}>
              Next update in {minutes} min · {timeLabel(new Date(due).toISOString())}
            </Text>
            <Text style={[s.small, { color: C.green }]}>
              {me!.notifications_enabled ? 'Reminders on' : 'Reminders off'}
            </Text>
            <Icon name="chevron-forward" size={14} color={C.green} />
          </Pressable>
        </Card>
      ) : (
        <Card style={{ gap: 14, marginBottom: 16 }}>
          <View style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={s.emptyIcon}>
              <Icon name="layers-outline" color={C.green} size={23} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.h2}>
                {firstProject ? 'Start with a project' : 'No active projects'}
              </Text>
              <Text style={s.body}>
                {founder
                  ? 'Add the work your team is doing. Everyone can then share updates in that project.'
                  : 'Your founder will add projects here. You can post an update as soon as a project is ready.'}
              </Text>
            </View>
          </View>
          {founder ? (
            <Button
              title={firstProject ? 'Create first project' : 'Create project'}
              icon="add"
              onPress={onNewProject}
            />
          ) : (
            <Button title="View your team" secondary onPress={() => onNavigate('Team')} />
          )}
          {founder && !firstProject ? (
            <Link text="Open projects" onPress={() => onNavigate('Projects')} />
          ) : null}
        </Card>
      )}
      {projects.length ? (
        <>
          <Section
            title="Your projects"
            action={<Link text="View all" onPress={() => onNavigate('Projects')} />}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {projects.slice(0, 2).map((p) => (
              <View
                key={p.id}
                style={{ flexGrow: 1, flexBasis: width >= 700 ? '46%' : '100%', minWidth: 0 }}
              >
                <ProjectCard project={p} onPress={() => onProject(p)} />
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigate('Team')}
            style={({ pressed }) => [
              s.row,
              { minHeight: 48, marginBottom: 12, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Icon name="people-outline" color={C.green} />
            <Text style={[s.body, { flex: 1 }]}>
              {checkedIn} of {data!.profiles.length} teammates posted today
            </Text>
            <Icon name="chevron-forward" size={16} color={C.muted} />
          </Pressable>
          <Section
            title="Latest updates"
            action={<Link text="View all" onPress={() => onNavigate('Updates')} />}
          />
          <View style={{ gap: 12 }}>
            {data!.updates.slice(0, 2).map((u) => (
              <UpdateCard key={u.id} update={u} compact />
            ))}
            {!data!.updates.length ? (
              <Empty
                title="No updates yet"
                body="Your team’s work updates will appear here. Use “Post work update” to add the first one."
              />
            ) : null}
          </View>
        </>
      ) : (
        <Card style={{ gap: 14 }}>
          <Text style={s.h3}>How it works</Text>
          {[
            ['1', 'Create a project', 'Give the work a name and a deadline.'],
            ['2', 'Invite your team', 'Everyone signs in with their own account.'],
            ['3', 'Share work updates', 'Post what’s done, what remains, and when it will finish.'],
          ].map(([number, title, detail]) => (
            <View key={number} style={[s.row, { alignItems: 'flex-start' }]}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: C.mint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.green }}>{number}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.h3}>{title}</Text>
                <Text style={s.body}>{detail}</Text>
              </View>
            </View>
          ))}
          <View style={{ borderTopWidth: 1, borderColor: C.line }} />
          <Button
            title={founder ? 'Invite teammates' : 'View team'}
            secondary
            icon="people-outline"
            onPress={() => onNavigate('Team')}
          />
          <Link text="Set up work reminders" onPress={() => onNavigate('Settings')} />
        </Card>
      )}
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
          me!.role === 'founder' && data!.projects.length ? (
            <Button title="New project" icon="add" onPress={onNewProject} />
          ) : undefined
        }
      />
      {data!.projects.length ? (
        <>
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
        </>
      ) : null}
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
  onNavigate,
}: {
  onUpdate: () => void;
  onRevise: (u: WorkUpdate) => void;
  onNavigate: (tab: string) => void;
}) {
  const { data, me } = useStore();
  const now = useClock();
  const [scope, setScope] = useState('All updates');
  const [project, setProject] = useState('all');
  const [person, setPerson] = useState('all');
  const [period, setPeriod] = useState('Today');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount =
    Number(project !== 'all') + Number(person !== 'all') + Number(period !== 'Today');
  const hasProjects = data!.projects.some((p) => !p.archived);
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
        title="Work updates"
        description="See what’s done and what still needs attention."
        action={
          hasProjects && data!.updates.length ? (
            <Button title="Post update" icon="add" onPress={onUpdate} />
          ) : undefined
        }
      />
      {!data!.updates.length ? (
        <Empty
          title="No work updates yet"
          body={
            hasProjects
              ? 'Share what you finished, what is left, and when you’ll finish.'
              : 'Add a project first. Your team can then share work updates here.'
          }
          action={
            hasProjects ? (
              <Button title="Post first update" icon="add" onPress={onUpdate} />
            ) : (
              <Button title="View projects" secondary onPress={() => onNavigate('Projects')} />
            )
          }
        />
      ) : (
        <>
          <View style={[s.chips, { marginBottom: 10 }]}>
            {[
              { value: 'All updates', label: 'Everyone' },
              { value: 'My updates', label: 'My updates' },
              { value: 'Blocked', label: 'Needs help' },
            ].map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: scope === item.value }}
                onPress={() => setScope(item.value)}
                style={[s.chip, scope === item.value && s.chipActive]}
              >
                <Text style={s.chipText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter work updates"
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((open) => !open)}
            style={[s.row, { minHeight: 48, marginBottom: 10 }]}
          >
            <Icon name="options-outline" size={19} color={C.green} />
            <Text style={[s.h3, { flex: 1 }]}>Filters{filterCount ? ` (${filterCount})` : ''}</Text>
            <Text style={s.small}>
              {period === 'Today' || period === 'All time' ? period : `Last ${period}h`}
            </Text>
            <Icon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
          </Pressable>
          {filtersOpen ? (
            <Card style={{ marginBottom: 14, gap: 12 }}>
              <Text style={s.label}>When</Text>
              <View style={s.chips}>
                {['Today', '1', '2', 'All time'].map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityState={{ selected: period === t }}
                    onPress={() => setPeriod(t)}
                    style={[s.chip, period === t && s.chipActive]}
                  >
                    <Text style={s.chipText}>{['1', '2'].includes(t) ? `Last ${t}h` : t}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.label}>Project</Text>
              <View style={s.chips}>
                {[{ id: 'all', name: 'All projects' }, ...data!.projects].map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: project === p.id }}
                    onPress={() => setProject(p.id)}
                    style={[s.chip, project === p.id && s.chipActive]}
                  >
                    <Text style={s.chipText}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
              {me!.role === 'founder' ? (
                <>
                  <Text style={s.label}>Teammate</Text>
                  <View style={s.chips}>
                    {[{ id: 'all', name: 'Everyone' }, ...data!.profiles].map((p) => (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: person === p.id }}
                        onPress={() => setPerson(p.id)}
                        style={[s.chip, person === p.id && s.chipActive]}
                      >
                        <Text style={s.chipText}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              <Button title="Reset filters" secondary small onPress={resetFilters} />
            </Card>
          ) : null}
          <Text style={[s.small, { marginBottom: 12 }]}>
            {updates.length} update{updates.length === 1 ? '' : 's'} · Newest first
          </Text>
          <View style={{ gap: 12, maxWidth: 850 }}>
            {updates.map((u) => (
              <UpdateCard key={u.id} update={u} onRevise={onRevise} />
            ))}
          </View>
          {!updates.length ? (
            <Empty
              title="No matching updates"
              body="Try another time period or clear the filters."
              action={<Button title="Show today’s updates" secondary onPress={resetFilters} />}
            />
          ) : null}
        </>
      )}
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
        description="Invite teammates and see who posted an update today."
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
          <Text style={[s.label, { marginBottom: 12 }]}>Remind me to post an update</Text>
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
