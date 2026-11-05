import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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
  { hours: 4, label: 'In 4 hours' },
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
      <View style={[s.row, { gap: 7 }]}>
        <Icon name="calendar-outline" size={16} color={C.green} />
        <Text style={[s.body, { color: C.ink, flex: 1 }]}>
          {readableDate(value)} <Text style={s.small}>· your local time</Text>
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: custom }}
        onPress={() => setCustom((open) => !open)}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 13, color: C.green, fontWeight: '600' }}>
          {custom ? 'Hide custom date' : 'Choose another date or time'}
        </Text>
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
  const [project, setProject] = useState(
    revision?.project_id || projectId || data?.projects.find((p) => !p.archived)?.id || '',
  );
  const [completed, setCompleted] = useState(revision?.completed || '');
  const [remaining, setRemaining] = useState(revision?.remaining || '');
  const [blocker, setBlocker] = useState(revision?.blocker || '');
  const [progress, setProgress] = useState(String(revision?.progress ?? 0));
  const [eta, setEta] = useState(() =>
    localDate(new Date(revision?.eta || Date.now() + 4 * 3600000)),
  );
  const [period, setPeriod] = useState(revision?.period_hours || me?.cadence || 1);
  const [etaHours, setEtaHours] = useState<number | undefined>(revision ? undefined : 4);
  const [step, setStep] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(!!revision?.blocker);
  const [exactProgress, setExactProgress] = useState(
    !!revision && ![0, 25, 50, 75, 100].includes(revision.progress),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeProjects = data?.projects.filter((p) => !p.archived) || [];
  const selectedProject = activeProjects.find((p) => p.id === project);
  function next() {
    setError('');
    if (!selectedProject) {
      setError('Choose a project for this update.');
      return;
    }
    if (!completed.trim()) {
      setError('Tell your team what you finished.');
      return;
    }
    setStep(2);
  }
  async function save() {
    setError('');
    if (!progress.trim()) {
      setError('Choose how much of your work is finished.');
      return;
    }
    if (Number(progress) < 100 && !remaining.trim()) {
      setStep(1);
      setError('Add what is left to do. If everything is finished, choose 100% in the next step.');
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
      contentKey={step}
      title={revision ? 'Edit work update' : 'Post work update'}
      subtitle={step === 1 ? 'Step 1 of 2 · Your work' : 'Step 2 of 2 · Finish time'}
    >
      <View
        accessibilityLabel={`Step ${step} of 2`}
        style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}
      >
        {[1, 2].map((n) => (
          <View
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              backgroundColor: n <= step ? C.green : C.line,
            }}
          />
        ))}
      </View>
      <ErrorText text={error} />
      {step === 1 ? (
        <>
          <Text style={[s.label, { marginBottom: 6 }]}>Project</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose project"
            accessibilityState={{ expanded: pickerOpen, disabled: !!revision }}
            disabled={!!revision}
            onPress={() => setPickerOpen((open) => !open)}
            style={[
              s.row,
              {
                padding: 12,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 10,
                marginBottom: 14,
                minHeight: 48,
              },
            ]}
          >
            <Icon name="layers-outline" size={18} color={C.green} />
            <Text style={[s.h3, { flex: 1 }]}>{selectedProject?.name || 'Choose a project'}</Text>
            {!revision ? (
              <Icon name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
            ) : null}
          </Pressable>
          {pickerOpen ? (
            <View style={[s.chips, { marginBottom: 14 }]}>
              {activeProjects.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: project === p.id }}
                  onPress={() => {
                    setProject(p.id);
                    setPickerOpen(false);
                  }}
                  style={[s.chip, project === p.id && s.chipActive]}
                >
                  <Text style={s.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={[s.label, { marginBottom: 8 }]}>This update covers</Text>
          <View style={[s.chips, { marginBottom: 16 }]}>
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
            label="What did you finish? *"
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
            placeholder="e.g. Test sign-in on Android. Leave blank if all done."
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: helpOpen }}
            onPress={() => setHelpOpen((open) => !open)}
            style={[s.row, { minHeight: 44, marginBottom: 8 }]}
          >
            <Icon name="help-circle-outline" size={18} color={C.green} />
            <Text style={{ flex: 1, fontSize: 13, color: C.green }}>
              Need help with anything? (optional)
            </Text>
            <Icon name={helpOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.green} />
          </Pressable>
          {helpOpen ? (
            <Field
              label="What is stopping you?"
              value={blocker}
              onChangeText={setBlocker}
              placeholder="Tell the team what help you need"
            />
          ) : null}
          <Button title="Next: finish time" icon="arrow-forward" onPress={next} />
        </>
      ) : (
        <>
          <Text style={[s.body, { marginBottom: 16 }]}>
            {selectedProject?.name} · Last {period} hour{period > 1 ? 's' : ''}
          </Text>
          <Text style={[s.h3, { marginBottom: 10 }]}>How much of your work is finished?</Text>
          <View style={[s.chips, { marginBottom: 8 }]}>
            {[0, 25, 50, 75, 100].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: Number(progress) === n }}
                onPress={() => {
                  setProgress(String(n));
                  setExactProgress(false);
                }}
                style={[s.chip, Number(progress) === n && s.chipActive]}
              >
                <Text style={s.chipText}>{n}%</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.small, { marginBottom: 8 }]}>Choose 100% if all your work is done.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: exactProgress }}
            onPress={() => setExactProgress((open) => !open)}
            style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}
          >
            <Text style={{ color: C.green, fontSize: 13 }}>
              {exactProgress ? 'Hide exact percentage' : 'Enter an exact percentage'}
            </Text>
          </Pressable>
          {exactProgress ? (
            <Field
              label="Work finished (%)"
              value={progress}
              onChangeText={setProgress}
              keyboardType="numeric"
            />
          ) : null}
          <TimeOptions
            label="When will you finish?"
            value={eta}
            onChange={setEta}
            choices={finishChoices}
            selectedHours={etaHours}
            onSelectHours={setEtaHours}
          />
          {revision ? (
            <Text style={[s.small, { marginBottom: 14 }]}>
              Saving creates a new version. Your earlier update stays in the history.
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            <Button
              title={revision ? 'Save changes' : 'Share update with team'}
              icon="checkmark"
              loading={busy}
              onPress={save}
            />
            <Button
              title="Back to your work"
              secondary
              disabled={busy}
              onPress={() => {
                setStep(1);
                setError('');
              }}
            />
          </View>
        </>
      )}
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
