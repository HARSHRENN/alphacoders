import { Text } from './Typography';
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useStore } from '../store';
import { Button, Field, Sheet, ErrorText, Empty, s, Icon, C } from './ui';
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
function readableDate(value: string) {
  try {
    return new Date(parseLocal(value)).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Enter a valid date and time';
  }
}
const finishChoices = [
  { hours: 1, label: 'In 1 hour' },
  { hours: 2, label: 'In 2 hours' },
  { hours: 24, label: 'In 1 day' },
];
const deadlineChoices = [
  { hours: 24, label: 'Tomorrow' },
  { hours: 72, label: 'In 3 days' },
  { hours: 168, label: 'In 1 week' },
];
function TimeOptions({
  label,
  value,
  onChange,
  choices,
  selectedHours,
  onSelectHours,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { hours: number; label: string }[];
  selectedHours?: number;
  onSelectHours: (hours: number | undefined) => void;
}) {
  const [custom, setCustom] = useState(false);
  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      <Text style={s.h3}>{label}</Text>
      <View style={s.chips}>
        {choices.map((choice) => (
          <Pressable
            key={choice.hours}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedHours === choice.hours && !custom }}
            onPress={() => {
              onSelectHours(choice.hours);
              setCustom(false);
              onChange(localDate(new Date(Date.now() + choice.hours * 3600000)));
            }}
            style={[s.chip, selectedHours === choice.hours && !custom && s.chipActive]}
          >
            <Text style={s.chipText}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pick a date & time"
        accessibilityState={{ expanded: custom }}
        onPress={() => setCustom((open) => !open)}
        style={[s.row, { minHeight: 44, gap: 7 }]}
      >
        <Icon name="calendar-outline" size={16} color={C.green} />
        <Text style={[s.body, { color: C.ink, flex: 1 }]}>{readableDate(value)}</Text>
        <Icon name={custom ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
      </Pressable>
      {custom ? (
        <Field
          label="Date and time (YYYY-MM-DD HH:mm)"
          value={value}
          onChangeText={(next) => {
            onSelectHours(undefined);
            onChange(next);
          }}
          placeholder="2026-11-06 18:00"
        />
      ) : null}
    </View>
  );
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
  const activeProjects = data?.projects.filter((project) => !project.archived) || [];
  const [project, setProject] = useState(
    revision?.project_id || projectId || activeProjects[0]?.id || '',
  );
  const [completed, setCompleted] = useState(revision?.completed || '');
  const [remaining, setRemaining] = useState(revision?.remaining || '');
  const [blocker, setBlocker] = useState(revision?.blocker || '');
  const [progress, setProgress] = useState(String(revision?.progress ?? 0));
  const [eta, setEta] = useState(() =>
    localDate(new Date(revision?.eta || Date.now() + 2 * 3600000)),
  );
  const [period, setPeriod] = useState(revision?.period_hours || me?.cadence || 1);
  const [etaHours, setEtaHours] = useState<number | undefined>(revision ? undefined : 2);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    !!revision?.blocker || (!!revision && ![0, 25, 50, 75, 100].includes(revision.progress)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedProject = activeProjects.find((item) => item.id === project);
  async function save() {
    setError('');
    if (!selectedProject) {
      setError('Choose a project.');
      return;
    }
    if (!completed.trim()) {
      setError('Tell your team what you finished.');
      return;
    }
    if (
      !progress.trim() ||
      !Number.isInteger(Number(progress)) ||
      Number(progress) < 0 ||
      Number(progress) > 100
    ) {
      setError('Enter a whole-number percentage from 0 to 100.');
      return;
    }
    if (Number(progress) < 100 && !remaining.trim()) {
      setError('Tell us what is left, or choose 100% if all your work is done.');
      return;
    }
    setBusy(true);
    try {
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
  if (!activeProjects.length)
    return (
      <Sheet visible={visible} onClose={onClose} title="No projects yet">
        <Empty
          title="A project is needed"
          body="Ask your founder to add a project, then send your update here."
          action={<Button title="Got it" onPress={onClose} />}
        />
      </Sheet>
    );
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={revision ? 'Edit update' : 'Send work update'}
      subtitle="What is done, what is next, and when it will finish."
    >
      {activeProjects.length > 1 && !revision ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose project"
            accessibilityState={{ expanded: pickerOpen }}
            onPress={() => setPickerOpen((open) => !open)}
            style={[
              s.row,
              {
                padding: 12,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 14,
                minHeight: 48,
                marginBottom: 14,
              },
            ]}
          >
            <Icon name="layers-outline" size={18} color={C.green} />
            <Text style={[s.h3, { flex: 1 }]}>{selectedProject?.name || 'Choose a project'}</Text>
            <Icon name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
          </Pressable>
          {pickerOpen ? (
            <View style={[s.chips, { marginBottom: 14 }]}>
              {activeProjects.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: project === item.id }}
                  onPress={() => {
                    setProject(item.id);
                    setPickerOpen(false);
                  }}
                  style={[s.chip, project === item.id && s.chipActive]}
                >
                  <Text style={s.chipText}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[s.h3, { marginBottom: 16 }]}>{selectedProject?.name}</Text>
      )}
      <Field
        label="What did you finish?"
        value={completed}
        onChangeText={setCompleted}
        multiline
        placeholder="e.g. Finished the login screen"
      />
      <Field
        label="What is left to do?"
        value={remaining}
        onChangeText={setRemaining}
        multiline
        placeholder="Leave blank if all your work is done"
      />
      <Text style={[s.label, { marginBottom: 8 }]}>Work finished (%)</Text>
      <View style={[s.chips, { marginBottom: 16 }]}>
        {[0, 25, 50, 75, 100].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: Number(progress) === value }}
            onPress={() => setProgress(String(value))}
            style={[s.chip, Number(progress) === value && s.chipActive]}
          >
            <Text style={s.chipText}>{value}%</Text>
          </Pressable>
        ))}
      </View>
      <TimeOptions
        label="When will you finish?"
        value={eta}
        onChange={setEta}
        choices={finishChoices}
        selectedHours={etaHours}
        onSelectHours={setEtaHours}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        onPress={() => setMoreOpen((open) => !open)}
        style={[s.row, { minHeight: 44, justifyContent: 'space-between', marginBottom: 8 }]}
      >
        <Text style={{ color: C.green, fontSize: 13, fontWeight: '600' }}>
          {moreOpen ? 'Fewer options' : 'More options'}
        </Text>
        <Icon name={moreOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.green} />
      </Pressable>
      {moreOpen ? (
        <View style={{ padding: 14, backgroundColor: C.bg, borderRadius: 14, marginBottom: 16 }}>
          <Field
            label="Need help? (optional)"
            value={blocker}
            onChangeText={setBlocker}
            placeholder="Tell your team what is stopping you"
          />
          <Field
            label="Exact progress (%)"
            value={progress}
            onChangeText={setProgress}
            keyboardType="numeric"
          />
          <Text style={[s.label, { marginBottom: 8 }]}>This update covers</Text>
          <View style={s.chips}>
            {[1, 2].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: period === value }}
                onPress={() => setPeriod(value)}
                style={[s.chip, period === value && s.chipActive]}
              >
                <Text style={s.chipText}>
                  Last {value} hour{value === 1 ? '' : 's'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {revision ? (
        <Text style={[s.small, { marginBottom: 12 }]}>
          The earlier version stays in your history.
        </Text>
      ) : null}
      <ErrorText text={error} />
      <Button
        title={revision ? 'Save update' : 'Send update'}
        icon="checkmark"
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
    [busy, setBusy] = useState(false),
    [detailsOpen, setDetailsOpen] = useState(false),
    [deadlineHours, setDeadlineHours] = useState<number | undefined>(168);
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
      subtitle="Give the work a name and choose a due date."
    >
      <Field
        label="Project name *"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Customer portal"
      />
      <TimeOptions
        label="When is it due?"
        value={deadline}
        onChange={setDeadline}
        choices={deadlineChoices}
        selectedHours={deadlineHours}
        onSelectHours={setDeadlineHours}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((open) => !open)}
        style={[s.row, { minHeight: 44, marginBottom: 14 }]}
      >
        <Icon name="options-outline" size={18} color={C.green} />
        <Text style={{ color: C.green, flex: 1, fontSize: 13 }}>
          Add details, priority, or color (optional)
        </Text>
        <Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.green} />
      </Pressable>
      {detailsOpen ? (
        <>
          <Field
            label="Project details"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What should the team know?"
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
        </>
      ) : null}
      <ErrorText text={error} />
      <Button title="Create project" icon="add" loading={busy} onPress={save} />
    </Sheet>
  );
}
