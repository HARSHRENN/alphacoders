import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore } from '../store';
import { Button, Field, Sheet, ErrorText, Empty, s, Icon } from './ui';
import { WorkUpdate } from '../types';
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function parseLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
    throw new Error('Use YYYY-MM-DD HH:mm for the date and time.');
  const date = new Date(value.replace(' ', 'T'));
  if (!Number.isFinite(date.getTime()) || localDate(date) !== value)
    throw new Error('Enter a valid calendar date and time.');
  return date.toISOString();
}
export function UpdateForm({
  visible,
  onClose,
  projectId,
  revision,
}: {
  visible: boolean;
  onClose: () => void;
  projectId?: string;
  revision?: WorkUpdate;
}) {
  const { data, me, addUpdate } = useStore();
  const [project, setProject] = useState(
      revision?.project_id || projectId || data?.projects.find((p) => !p.archived)?.id || '',
    ),
    [completed, setCompleted] = useState(revision?.completed || ''),
    [remaining, setRemaining] = useState(revision?.remaining || ''),
    [blocker, setBlocker] = useState(revision?.blocker || ''),
    [progress, setProgress] = useState(String(revision?.progress ?? 25)),
    [eta, setEta] = useState(() => localDate(new Date(revision?.eta || Date.now() + 4 * 3600000))),
    [period, setPeriod] = useState(revision?.period_hours || me?.cadence || 1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!progress.trim()) throw new Error('Enter a progress percentage.');
      await addUpdate({
        project_id: project,
        completed: completed.trim(),
        remaining: remaining.trim(),
        blocker: blocker.trim(),
        progress: Number(progress),
        eta: parseLocal(eta),
        period_hours: period,
        supersedes: revision?.id || null,
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data?.projects.some((p) => !p.archived))
    return (
      <Sheet visible={visible} onClose={onClose} title="Add a project first">
        <Empty
          title="No active projects"
          body={
            me?.role === 'founder'
              ? 'Create a project in the Projects tab, then post your work update here.'
              : 'Ask your founder to create a project before posting an update.'
          }
          action={<Button title="Got it" onPress={onClose} />}
        />
      </Sheet>
    );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={revision ? 'Revise your update' : 'Post work update'}
      subtitle="Share completed work, what remains, and when you’ll finish."
    >
      <Text style={[s.label, { marginBottom: 10 }]}>Project</Text>
      <View style={[s.chips, { marginBottom: 14 }]}>
        {data?.projects
          .filter((p) => !p.archived)
          .map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              disabled={!!revision}
              accessibilityState={{ selected: project === p.id, disabled: !!revision }}
              onPress={() => setProject(p.id)}
              style={[s.chip, project === p.id && s.chipActive]}
            >
              <Text style={s.chipText}>{p.name}</Text>
            </Pressable>
          ))}
      </View>
      <Text style={[s.label, { marginBottom: 10 }]}>Reporting period</Text>
      <View style={[s.chips, { marginBottom: 14 }]}>
        {[1, 2].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: period === n }}
            onPress={() => setPeriod(n)}
            style={[s.chip, period === n && s.chipActive]}
          >
            <Text style={s.chipText}>
              Last {n} hour{n > 1 ? 's' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="What did you complete? *"
        value={completed}
        onChangeText={setCompleted}
        multiline
        placeholder="Share the progress you made in this reporting period…"
      />
      <Field
        label="What’s left to do?"
        value={remaining}
        onChangeText={setRemaining}
        multiline
        placeholder="The next steps and remaining work…"
      />
      <Field
        label="Any blockers? (optional)"
        value={blocker}
        onChangeText={setBlocker}
        placeholder="Where could your team help?"
      />
      <Field
        label="Your work progress (%) *"
        value={progress}
        onChangeText={setProgress}
        keyboardType="numeric"
      />
      <View style={[s.chips, { marginTop: -8, marginBottom: 14 }]}>
        {[0, 25, 50, 75, 100].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: Number(progress) === n }}
            onPress={() => setProgress(String(n))}
            style={[s.chip, Number(progress) === n && s.chipActive]}
          >
            <Text style={s.chipText}>{n}%</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Expected finish · local time (YYYY-MM-DD HH:mm) *"
        value={eta}
        onChangeText={setEta}
      />
      <View style={[s.chips, { marginTop: -8, marginBottom: 14 }]}>
        {[2, 4, 24].map((h) => (
          <Pressable
            key={h}
            accessibilityRole="button"
            onPress={() => setEta(localDate(new Date(Date.now() + h * 3600000)))}
            style={s.chip}
          >
            <Text style={s.chipText}>In {h === 24 ? '1 day' : `${h} hours`}</Text>
          </Pressable>
        ))}
      </View>
      {revision ? (
        <Text style={[s.body, { marginBottom: 16 }]}>
          This adds a new revision. The original update stays in your team’s history.
        </Text>
      ) : null}
      <ErrorText text={error} />
      <Button
        title={revision ? 'Publish revision' : 'Publish update'}
        icon="arrow-up"
        loading={busy}
        onPress={save}
      />
    </Sheet>
  );
}
export function ProjectForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addProject } = useStore();
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [deadline, setDeadline] = useState(() => localDate(new Date(Date.now() + 7 * 86400000))),
    [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium'),
    [color, setColor] = useState('#6b5cce'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await addProject({
        name,
        description,
        deadline: parseLocal(deadline),
        priority,
        color,
        icon: 'layers-outline',
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Create project"
      subtitle="Add a goal, priority, and deadline for the team."
    >
      <Field
        label="Project name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Customer portal"
      />
      <Field
        label="What are we building?"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Field
        label="Deadline · local time (YYYY-MM-DD HH:mm) *"
        value={deadline}
        onChangeText={setDeadline}
      />
      <Text style={[s.label, { marginBottom: 10 }]}>Priority</Text>
      <View style={[s.chips, { marginBottom: 14 }]}>
        {(['Low', 'Medium', 'High'] as const).map((p) => (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: priority === p }}
            onPress={() => setPriority(p)}
            style={[s.chip, priority === p && s.chipActive]}
          >
            <Text style={s.chipText}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[s.label, { marginBottom: 10 }]}>Project color</Text>
      <View style={[s.chips, { marginBottom: 16 }]}>
        {[
          ['#6b5cce', 'Purple'],
          ['#cf7846', 'Orange'],
          ['#378b7b', 'Teal'],
          ['#447ab4', 'Blue'],
          ['#b75976', 'Rose'],
        ].map(([c, label]) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${label}`}
            accessibilityState={{ selected: color === c }}
            onPress={() => setColor(c)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: c,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {color === c ? <Icon name="checkmark" color="white" /> : null}
          </Pressable>
        ))}
      </View>
      <ErrorText text={error} />
      <Button title="Create project" icon="add" loading={busy} onPress={save} />
    </Sheet>
  );
}
