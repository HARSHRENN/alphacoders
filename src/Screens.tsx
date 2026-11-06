import { Text } from './components/Typography';
import React, { useState } from 'react';
import { View, Pressable, TextInput, useWindowDimensions, Share, Switch } from 'react-native';
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
import { TeamProgress } from './components/TeamProgress';
import { WorkClock, WorkTimeHistory } from './components/TimeTracking';
import {
  dateLabel,
  timeLabel,
  relative,
  isToday,
  nextDue,
  exportReport,
  projectProgress,
  workDayStart,
  workTotalMs,
  formatWorkDuration,
} from './lib/domain';
import { useClock } from './lib/useClock';
import { enableNotifications } from './lib/notifications';

type Navigation = {
  onUpdate: (id?: string) => void;
  onProject: (p: Project) => void;
  onNavigate: (tab: string) => void;
  onNewProject: () => void;
};
export function Overview({ onUpdate, onNavigate, onNewProject }: Navigation) {
  const { data, me } = useStore();
  const now = useClock();
  const founder = me!.role === 'founder';
  const hasProjects = data!.projects.some((project) => !project.archived);
  const due = nextDue(me!.reminder_anchor, me!.cadence, now);
  const recent = (
    founder ? data!.updates : data!.updates.filter((update) => update.user_id === me!.id)
  ).slice(0, founder ? 3 : 1);
  return (
    <>
      <Heading
        title={founder ? 'Team today' : `Hi, ${me!.name.split(' ')[0]}`}
        description={data!.workspace.name}
      />
      {founder ? <TeamProgress onTeam={() => onNavigate('Team')} /> : <WorkClock />}
      {!hasProjects ? (
        <Empty
          title={founder ? 'Add your first project' : 'Your projects will appear here'}
          body={
            founder
              ? 'Give your team a project and a deadline to get started.'
              : 'Your founder will add projects. You can already use your work timer.'
          }
          action={
            founder ? (
              <Button title="Create project" icon="add" onPress={onNewProject} />
            ) : undefined
          }
        />
      ) : !founder ? (
        <View style={{ gap: 6, marginBottom: 20 }}>
          <Button title="Send work update" icon="create-outline" onPress={() => onUpdate()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Update reminder settings"
            onPress={() => onNavigate('Settings')}
            style={{ minHeight: 36, justifyContent: 'center' }}
          >
            <Text style={[s.small, { textAlign: 'center' }]}>
              {me!.notifications_enabled
                ? `Next reminder at ${timeLabel(new Date(due).toISOString())}`
                : 'Turn on update reminders in Settings'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {hasProjects ? (
        <>
          <Section
            title={founder ? 'Recent work updates' : 'Your latest update'}
            action={<Link text="View all" onPress={() => onNavigate('Updates')} />}
          />
          <View style={{ gap: 12 }}>
            {recent.map((update) => (
              <UpdateCard key={update.id} update={update} compact />
            ))}
            {!recent.length ? (
              <Empty
                title={founder ? 'Waiting for team updates' : 'No update sent yet'}
                body={
                  founder
                    ? 'Completed work, remaining tasks, and finish times will appear here.'
                    : 'Use Send work update to tell your team what you finished and what is next.'
                }
              />
            ) : null}
          </View>
        </>
      ) : null}
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
          me!.role === 'member' && hasProjects && data!.updates.length ? (
            <Button title="Post update" icon="add" onPress={onUpdate} />
          ) : undefined
        }
      />
      {!data!.updates.length ? (
        <Empty
          title="No work updates yet"
          body={
            me!.role === 'founder'
              ? 'Your team’s completed work, remaining tasks, and finish times will appear here.'
              : hasProjects
                ? 'Share what you finished, what is left, and when you’ll finish.'
                : 'Add a project first. Your team can then share work updates here.'
          }
          action={
            hasProjects && me!.role === 'member' ? (
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
            ]
              .filter((item) => me!.role === 'member' || item.value !== 'My updates')
              .map((item) => (
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
              <UpdateCard
                key={u.id}
                update={u}
                onRevise={me!.role === 'member' ? onRevise : undefined}
              />
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
  const [manageAccess, setManageAccess] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [timePerson, setTimePerson] = useState<string | null>(null);
  const now = useClock();
  const selectedPerson = data!.profiles.find((person) => person.id === timePerson);
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
      <Heading title="Team" description="Your people and their work hours." />
      <ErrorText text={error} />
      {me!.role === 'founder' ? (
        <Card style={{ marginBottom: 16, backgroundColor: C.mint, gap: 8 }}>
          <Text style={s.label}>Team invite code</Text>
          <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <Text style={{ fontSize: 22, color: C.ink, fontWeight: '600' }}>
              {data!.workspace.invite_code}
            </Text>
            <Button title="Share invite" small icon="share-outline" onPress={invite} />
          </View>
          <Text style={s.small}>Teammates enter this code after creating an account.</Text>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[...data!.profiles]
          .sort(
            (a, b) =>
              Number(b.role === 'member') - Number(a.role === 'member') ||
              a.name.localeCompare(b.name),
          )
          .map((p) => {
            const updates = data!.updates.filter(
              (u) => u.user_id === p.id && isToday(u.created_at),
            );
            const projects = new Set(
              data!.updates.filter((u) => u.user_id === p.id).map((u) => u.project_id),
            );
            const canViewTime = p.role === 'member' && (me!.role === 'founder' || p.id === me!.id);
            const workSessions = data!.work_sessions.filter((work) => work.user_id === p.id);
            const working = workSessions.some((work) => !work.ended_at);
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
                {p.role === 'member' ? (
                  <>
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
                          {canViewTime
                            ? formatWorkDuration(workTotalMs(workSessions, workDayStart(now), now))
                            : projects.size}
                        </Text>
                        <Text style={s.small}>
                          {canViewTime ? 'Time today' : 'Projects contributed'}
                        </Text>
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
                    {canViewTime ? (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        {working ? <Tag text="Working now" /> : null}
                        <Button
                          title="Work & hours"
                          secondary
                          small
                          icon="timer-outline"
                          onPress={() => setTimePerson(p.id)}
                        />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={[s.body, { marginTop: 8 }]}>
                    Manages projects and reviews team progress.
                  </Text>
                )}
                {manageAccess && me!.role === 'founder' && p.role === 'member' ? (
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
      {me!.role === 'founder' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: manageAccess }}
          onPress={() => setManageAccess((open) => !open)}
          style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}
        >
          <Text style={{ color: C.muted, fontSize: 13 }}>
            {manageAccess ? 'Hide access settings' : 'Manage team access'}
          </Text>
        </Pressable>
      ) : null}
      {selectedPerson ? (
        <WorkTimeHistory person={selectedPerson} onClose={() => setTimePerson(null)} />
      ) : null}
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
    [message, setMessage] = useState(''),
    [signingOut, setSigningOut] = useState(false),
    [signOutError, setSignOutError] = useState('');
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
        description={
          me!.role === 'founder'
            ? 'Manage your account and team notifications.'
            : 'Manage your account and work reminders.'
        }
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
            title={me!.role === 'founder' ? 'Team notifications' : 'Work reminders'}
            subtitle={
              me!.role === 'founder'
                ? 'Receive team progress changes and project deadline alerts.'
                : 'Choose when to report your completed and remaining work.'
            }
          />
          <View style={[s.row, { justifyContent: 'space-between', marginVertical: 12 }]}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.h3}>Work update notifications</Text>
              <Text style={s.body}>
                {me!.role === 'founder'
                  ? 'Team updates and project deadlines.'
                  : 'Check-ins and deadline heads-ups.'}
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
          {me!.role === 'member' ? (
            <>
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
            </>
          ) : null}
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
              {me!.role === 'founder'
                ? 'Review team progress five minutes before a project deadline.'
                : 'Get a reminder five minutes before each check-in and project deadline.'}{' '}
              Delivery timing depends on Android settings and network availability.
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
        <Text style={s.small}>
          {me!.role === 'member'
            ? 'Signing out also stops your running work timer. Stay connected until your time is saved.'
            : 'Sign out of your founder account on this device.'}
        </Text>
        <ErrorText text={signOutError} />
        <Button
          title={me!.role === 'member' ? 'Stop work & sign out' : 'Sign out'}
          secondary
          icon="log-out-outline"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            setSignOutError('');
            try {
              await leave();
            } catch (e: any) {
              setSignOutError(e.message);
            } finally {
              setSigningOut(false);
            }
          }}
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
      {!current.archived && me!.role === 'member' ? (
        <Button title="Post a project update" icon="add" onPress={() => onUpdate(p.id)} />
      ) : null}
      <View style={{ marginTop: 18, gap: 14 }}>
        {updates.map((u) => (
          <UpdateCard
            key={u.id}
            update={u}
            onRevise={current.archived || me!.role === 'founder' ? undefined : onRevise}
          />
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
