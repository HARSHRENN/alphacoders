import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore } from '../store';
import { Profile } from '../types';
import {
  workDayStart,
  workDurationMs,
  workTotalMs,
  formatWorkDuration,
  dateLabel,
  timeLabel,
} from '../lib/domain';
import { Card, Button, Icon, Tag, Sheet, ErrorText, Empty, C, s } from './ui';
import { UpdateCard } from './UpdateCard';

function useWorkNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), active ? 1000 : 30000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
export function WorkClock() {
  const { data, me, startWork, stopWork } = useStore();
  const mine = data!.work_sessions.filter((work) => work.user_id === me!.id);
  const active = mine.find((work) => !work.ended_at);
  const tick = useWorkNow(!!active);
  const now = mine.reduce(
    (latest, work) => Math.max(latest, Date.parse(work.ended_at || work.started_at)),
    tick,
  );
  const total = workTotalMs(mine, workDayStart(now), now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState(false);
  async function toggle() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (active) {
        await stopWork(active.id);
        setMessage('Work stopped. Your time is saved.');
      } else await startWork();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card style={{ marginBottom: 16, gap: 12, borderColor: active ? '#b5d5c1' : C.line }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <View style={[s.row, { gap: 8 }]}>
            <Icon name="timer-outline" color={C.green} size={21} />
            <Text style={s.h3}>Your work time</Text>
          </View>
          <Tag
            text={active ? 'Working now' : 'Clock stopped'}
            bg={active ? C.mint : '#f0f3f1'}
            color={active ? C.green : C.muted}
          />
        </View>
        <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: C.ink,
                fontSize: 30,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {active
                ? formatWorkDuration(workDurationMs(active, 0, now), true)
                : formatWorkDuration(total)}
            </Text>
            <Text style={s.small}>
              {active
                ? `Current session · Started ${timeLabel(active.started_at)}`
                : 'Total time today'}
            </Text>
          </View>
          {active ? (
            <View style={{ gap: 4 }}>
              <Text style={s.h3}>{formatWorkDuration(total)}</Text>
              <Text style={s.small}>Total today</Text>
            </View>
          ) : null}
        </View>
        <Button
          title={active ? 'Stop work' : 'Start work'}
          icon={active ? 'stop-circle-outline' : 'play-circle-outline'}
          secondary={!!active}
          loading={busy}
          onPress={toggle}
        />
        <Text style={s.small}>
          {active
            ? 'Time keeps running when you close the app. Tap Stop work when you finish.'
            : 'Start when you begin working. Stop when you take a break or finish.'}
        </Text>
        <ErrorText text={error} />
        {message ? (
          <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.green }]}>
            {message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setHistory(true)}
          style={[
            s.row,
            {
              minHeight: 44,
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderColor: C.line,
              paddingTop: 8,
            },
          ]}
        >
          <Text style={{ fontSize: 13, color: C.green, fontWeight: '600' }}>
            View my work & time
          </Text>
          <Icon name="chevron-forward" size={16} color={C.green} />
        </Pressable>
      </Card>
      {history ? <WorkTimeHistory person={me!} onClose={() => setHistory(false)} /> : null}
    </>
  );
}
export function WorkTimeHistory({ person, onClose }: { person: Profile; onClose: () => void }) {
  const { data } = useStore();
  const sessions = data!.work_sessions.filter((work) => work.user_id === person.id);
  const tick = useWorkNow(sessions.some((work) => !work.ended_at));
  const now = sessions.reduce(
    (latest, work) => Math.max(latest, Date.parse(work.ended_at || work.started_at)),
    tick,
  );
  const [days, setDays] = useState(1);
  const from = workDayStart(now, days);
  const visible = sessions
    .filter(
      (work) =>
        Date.parse(work.started_at) <= now && (!work.ended_at || Date.parse(work.ended_at) >= from),
    )
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const updates = data!.updates.filter(
    (update) =>
      update.user_id === person.id &&
      Date.parse(update.created_at) >= from &&
      Date.parse(update.created_at) <= now,
  );
  return (
    <Sheet
      visible
      title={`${person.name} · Work & time`}
      subtitle="Start and stop times are saved by the server."
      onClose={onClose}
    >
      <View style={[s.chips, { marginBottom: 14 }]}>
        {[
          { days: 1, label: 'Today' },
          { days: 7, label: 'Last 7 days' },
          { days: 30, label: 'Last 30 days' },
        ].map((item) => (
          <Pressable
            key={item.days}
            accessibilityRole="button"
            accessibilityState={{ selected: days === item.days }}
            onPress={() => setDays(item.days)}
            style={[s.chip, days === item.days && s.chipActive]}
          >
            <Text style={s.chipText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ backgroundColor: '#edf5f0', marginBottom: 16, gap: 5 }}>
        <Text style={s.body}>Total logged in this period</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: C.ink }}>
          {formatWorkDuration(workTotalMs(visible, from, now))}
        </Text>
        <Text style={s.small}>
          {visible.length} work session{visible.length === 1 ? '' : 's'} · {updates.length} work
          update{updates.length === 1 ? '' : 's'}
        </Text>
      </Card>
      <Text style={[s.h3, { marginBottom: 6 }]}>Work sessions</Text>
      <Text style={[s.small, { marginBottom: 12 }]}>
        Times shown in your local time. Durations count only time inside the selected period.
      </Text>
      <View style={{ gap: 10, marginBottom: 20 }}>
        {visible.map((work) => (
          <Card key={work.id} style={{ gap: 9 }}>
            <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Text style={s.h3}>
                {dateLabel(work.started_at)} · {timeLabel(work.started_at)}
              </Text>
              <Tag text={work.ended_at ? 'Stopped' : 'Working now'} />
            </View>
            <Text style={s.body}>Start: {new Date(work.started_at).toLocaleString()}</Text>
            <Text style={s.body}>
              Stop: {work.ended_at ? new Date(work.ended_at).toLocaleString() : 'Still working'}
            </Text>
            <Text style={[s.h3, { color: C.green }]}>
              {formatWorkDuration(workDurationMs(work, from, now), true)} in this period
            </Text>
          </Card>
        ))}
        {!visible.length ? (
          <Empty
            title="No time logged"
            body="Work sessions appear here after Start work is used."
          />
        ) : null}
      </View>
      <Text style={[s.h3, { marginBottom: 12 }]}>Work updates in this period</Text>
      <View style={{ gap: 10 }}>
        {updates.map((update) => (
          <UpdateCard key={update.id} update={update} />
        ))}
        {!updates.length ? (
          <Text style={s.body}>No work updates posted in this period.</Text>
        ) : null}
      </View>
    </Sheet>
  );
}
