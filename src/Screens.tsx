import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, useWindowDimensions, Share, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const wide = width > 1150;
  const now = useClock();
  const projects = data!.projects.filter((p) => !p.archived),
    today = data!.updates.filter((u) => isToday(u.created_at)),
    blocked = latestUpdates(data!.updates).filter((u) => u.blocker),
    reporters = new Set(today.map((u) => u.user_id));
  const due = nextDue(me!.reminder_anchor, me!.cadence, now);
  const minutes = Math.ceil((due - now) / 60000);
  const name = me!.name.split(' ')[0];
  const hour = new Date().getHours();
  return (
    <>
      <Heading
        eyebrow="A LITTLE CLARITY FOR YOUR DAY"
        title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${name} ☀`}
        description="Here’s how your team is moving things forward."
        action={<Button title="Post an update" icon="add" onPress={() => onUpdate()} />}
      />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, marginBottom: 26 }}>
        <LinearGradient
          colors={['#e2efdf', '#eef4e8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 25, borderRadius: 18, overflow: 'hidden', minHeight: 177 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.eyebrow, { color: '#5d7e58', fontSize: 9 }]}>
                IN SYNC, EVERY STEP OF THE WAY
              </Text>
              <Text
                style={{
                  fontSize: 23,
                  fontWeight: '600',
                  color: C.ink,
                  letterSpacing: -0.6,
                  marginTop: 12,
                }}
              >
                Big things start with{wide ? '\n' : ' '}small updates.
              </Text>
              <Text style={[s.body, { marginTop: 10, color: '#6f8369', maxWidth: 340 }]}>
                Keep the momentum going. A quick check-in today makes a clearer path for everyone.
              </Text>
            </View>
            <View
              style={{
                width: 100,
                height: 120,
                justifyContent: 'flex-end',
                flexDirection: 'row',
                gap: 6,
                alignItems: 'flex-end',
                transform: [{ rotate: '-8deg' }],
              }}
            >
              {[45, 72, 104].map((h, i) => (
                <View
                  key={h}
                  style={{
                    height: h,
                    width: 25,
                    backgroundColor: ['#bdcfa4', '#97b985', '#3b704c'][i],
                    borderRadius: 7,
                  }}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
        <Card
          style={{
            width: wide ? 285 : '100%',
            backgroundColor: '#193f32',
            borderColor: '#193f32',
            padding: 22,
          }}
        >
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontSize: 10, letterSpacing: 1.2, color: '#b1c7b9', fontWeight: '600' }}>
              YOUR NEXT CHECK-IN
            </Text>
            <Icon name="alarm-outline" color="#bbdf9d" size={20} />
          </View>
          <Text
            style={{
              fontSize: 34,
              letterSpacing: -1,
              color: 'white',
              fontWeight: '600',
              marginTop: 13,
            }}
          >
            {minutes}
            <Text style={{ fontSize: 16, color: '#b8ccbf', fontWeight: '400' }}> min</Text>
          </Text>
          <Text style={{ fontSize: 11, color: '#adc4b4', marginTop: 5 }}>
            Every {me!.cadence} hour{me!.cadence > 1 ? 's' : ''} ·{' '}
            {timeLabel(new Date(due).toISOString())}
          </Text>
          <View style={[s.row, { marginTop: 15, gap: 6 }]}>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 4,
                backgroundColor: me!.notifications_enabled ? '#c1e5a3' : '#dcba7c',
              }}
            />
            <Text style={{ fontSize: 10, color: '#c4d7c9' }}>
              {me!.notifications_enabled
                ? '5-minute heads-up enabled'
                : 'Enable reminders in Settings'}
            </Text>
          </View>
        </Card>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
        {[
          {
            label: 'Active projects',
            value: projects.length,
            icon: 'layers-outline' as const,
            note: 'Ideas turning into action',
            color: '#6b5cce',
            bg: '#f1eefb',
          },
          {
            label: 'Updates today',
            value: today.length,
            icon: 'chatbox-ellipses-outline' as const,
            note: `From ${reporters.size} team members`,
            color: '#3f8360',
            bg: '#eaf3e9',
          },
          {
            label: 'Team check-ins',
            value: `${reporters.size}/${data!.profiles.length}`,
            icon: 'people-outline' as const,
            note: 'People who checked in today',
            color: '#5887a8',
            bg: '#edf3f9',
          },
          {
            label: 'Needs attention',
            value: blocked.length,
            icon: 'flag-outline' as const,
            note: 'Open blockers to work through',
            color: '#bb8540',
            bg: '#fff3df',
          },
        ].map((item) => (
          <Card
            key={item.label}
            style={{ flex: 1, minWidth: width < 600 ? '44%' : 170, padding: 19 }}
          >
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 11, color: C.muted, flex: 1 }}>{item.label}</Text>
              <View style={{ padding: 7, borderRadius: 9, backgroundColor: item.bg }}>
                <Icon name={item.icon} color={item.color} size={17} />
              </View>
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '600',
                color: C.ink,
                marginTop: 8,
                letterSpacing: -1,
              }}
            >
              {item.value}
            </Text>
            <Text style={[s.small, { fontSize: 10, marginTop: 7 }]}>{item.note}</Text>
          </Card>
        ))}
      </View>
      <Section
        title="Projects in motion"
        subtitle="A shared view of what’s taking shape."
        action={<Link text="All projects" onPress={() => onNavigate('Projects')} />}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 30 }}>
        {projects.slice(0, 3).map((p) => (
          <ProjectCard key={p.id} project={p} onPress={() => onProject(p)} />
        ))}
        {!projects.length ? (
          <View style={{ flex: 1 }}>
            <Empty
              title="Your next chapter starts here"
              body="Create a project so your team has a place to share progress."
              action={
                me!.role === 'founder' ? (
                  <Button title="Create project" onPress={onNewProject} />
                ) : undefined
              }
            />
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
        <View style={{ flex: 1 }}>
          <Section
            title="The latest from your team"
            subtitle="Small wins, next steps, and everything in between."
            action={<Link text="All updates" onPress={() => onNavigate('Updates')} />}
          />
          <View style={{ gap: 12 }}>
            {data!.updates.slice(0, 3).map((u) => (
              <UpdateCard key={u.id} update={u} compact />
            ))}
            {!data!.updates.length ? (
              <Empty title="A fresh start" body="Your team’s first update will appear here." />
            ) : null}
          </View>
        </View>
        <View style={{ width: wide ? 285 : '100%' }}>
          <Section title="A little team pulse" subtitle="Today’s check-in activity." />
          <Card style={{ gap: 20 }}>
            {data!.profiles.slice(0, 5).map((p) => {
              const last = today.find((u) => u.user_id === p.id);
              return (
                <View key={p.id} style={s.row}>
                  <Avatar name={p.name} color={p.avatar} size={34} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 12, color: C.ink, fontWeight: '600' }}>
                      {p.name}
                      {p.id === me!.id ? ' (you)' : ''}
                    </Text>
                    <Text style={{ fontSize: 10, color: C.muted }}>
                      {last ? relative(last.created_at) : 'No check-in yet today'}
                    </Text>
                  </View>
                  <Icon
                    name={last ? 'checkmark-circle' : 'time-outline'}
                    color={last ? '#79a77a' : '#c2c9bf'}
                    size={18}
                  />
                </View>
              );
            })}
            <View style={{ height: 1, backgroundColor: C.line }} />
            <Link text="Meet your team" onPress={() => onNavigate('Team')} />
          </Card>
          <View
            style={{ padding: 18, marginTop: 14, borderRadius: 14, backgroundColor: '#eef1e8' }}
          >
            <View style={[s.row, { gap: 7, marginBottom: 7 }]}>
              <Icon name="sparkles-outline" size={14} color="#7c8b60" />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#697853' }}>
                A good habit, together
              </Text>
            </View>
            <Text style={{ fontSize: 11, lineHeight: 18, color: '#849075' }}>
              A quick update takes a minute. The clarity it brings lasts much longer.
            </Text>
          </View>
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
  const [filter, setFilter] = useState('Active'),
    [search, setSearch] = useState('');
  const projects = data!.projects.filter(
    (p) =>
      (filter === 'Archived' ? p.archived : !p.archived) &&
      (filter !== 'Completed' || projectProgress(p.id, data!.updates) === 100) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="FROM IDEA TO IMPACT"
        title="A place for every project."
        description="Keep the big picture clear, and the little details connected."
        action={
          me!.role === 'founder' ? (
            <Button title="New project" icon="add" onPress={onNewProject} />
          ) : undefined
        }
      />
      <View style={[s.row, { marginBottom: 24, flexWrap: 'wrap' }]}>
        <View style={[s.chips, { flex: 1 }]}>
          {['Active', 'Completed', 'Archived'].map((t) => (
            <Pressable
              accessibilityRole="button"
              key={t}
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
            style={{ paddingVertical: 13, color: C.ink, fontSize: 12, minWidth: 150 }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        {projects.map((p) => (
          <View key={p.id} style={{ flexGrow: 1, flexBasis: 280, maxWidth: 420 }}>
            <ProjectCard project={p} onPress={() => onProject(p)} />
          </View>
        ))}
      </View>
      {!projects.length ? (
        <Empty
          title="Nothing here just yet"
          body="Try a different filter or create your next project."
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
    [period, setPeriod] = useState('Today');
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
        eyebrow="PROGRESS, IN THEIR OWN WORDS"
        title="Every update tells a story."
        description="What’s done, what’s next, and where a little help goes a long way."
        action={<Button title="Post an update" icon="add" onPress={onUpdate} />}
      />
      <View style={[s.chips, { marginBottom: 18 }]}>
        {['All updates', 'My updates', 'Blocked'].map((t) => (
          <Pressable
            accessibilityRole="button"
            key={t}
            onPress={() => setScope(t)}
            style={[s.chip, scope === t && s.chipActive]}
          >
            <Text style={s.chipText}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ marginBottom: 22, padding: 16, gap: 14 }}>
        <View style={s.chips}>
          {['Today', '1', '2', 'All time'].map((t) => (
            <Pressable
              accessibilityRole="button"
              key={t}
              onPress={() => setPeriod(t)}
              style={[s.chip, period === t && s.chipActive]}
            >
              <Text style={s.chipText}>{['1', '2'].includes(t) ? `Last ${t}h` : t}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.chips}>
          {[{ id: 'all', name: 'All projects' }, ...data!.projects].map((p) => (
            <Pressable
              accessibilityRole="button"
              key={p.id}
              onPress={() => setProject(p.id)}
              style={[s.chip, project === p.id && s.chipActive]}
            >
              <Text style={s.chipText}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
        {me!.role === 'founder' ? (
          <View style={s.chips}>
            {[{ id: 'all', name: 'Everyone' }, ...data!.profiles].map((p) => (
              <Pressable
                accessibilityRole="button"
                key={p.id}
                onPress={() => setPerson(p.id)}
                style={[s.chip, person === p.id && s.chipActive]}
              >
                <Text style={s.chipText}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
          title="A moment of quiet"
          body="No updates match these filters. Your next check-in could be the first."
        />
      ) : null}
    </>
  );
}
export function Team() {
  const { data, me, promote } = useStore();
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
        eyebrow="GOOD WORK IS A TEAM SPORT"
        title="The people behind the progress."
        description="A shared rhythm. A little accountability. A team that moves together."
        action={
          me!.role === 'founder' ? (
            <Button title="Invite your team" icon="person-add-outline" onPress={invite} />
          ) : undefined
        }
      />
      <ErrorText text={error} />
      {me!.role === 'founder' ? (
        <Card style={{ marginBottom: 24, backgroundColor: '#edf3e9' }}>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            <Icon name="link-outline" color={C.green} />
            <View style={{ flex: 1, minWidth: 180, gap: 5 }}>
              <Text style={s.h3}>Make room for your people.</Text>
              <Text style={s.body}>
                {`Invite code: ${data!.workspace.invite_code} · New members get their own login.`}
              </Text>
            </View>
            <Tag text="Invite-only workspace" />
          </View>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        {data!.profiles.map((p) => {
          const updates = data!.updates.filter((u) => u.user_id === p.id && isToday(u.created_at));
          const projects = new Set(
            data!.updates.filter((u) => u.user_id === p.id).map((u) => u.project_id),
          );
          return (
            <Card key={p.id} style={{ flexBasis: 250, flexGrow: 1, maxWidth: 380, padding: 24 }}>
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
                <Avatar name={p.name} color={p.avatar} size={50} />
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
              <View style={[s.row, { marginTop: 22, gap: 7 }]}>
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
        <Text style={[s.body, { marginBottom: 20 }]}>
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
        eyebrow="MAKE ALPHACODERS YOUR OWN"
        title="A rhythm that works for you."
        description="Your account, your notifications, and a few thoughtful preferences."
      />
      <View style={{ maxWidth: 760, gap: 20 }}>
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
            title="Keep the updates flowing"
            subtitle="A gentle reminder to share your progress."
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
              title="Take the big picture with you"
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
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 20 }]}>
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
