import { Text } from './Typography';
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
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
import { Card, Button, Tag, Sheet, ErrorText, Empty, C, s } from './ui';
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
      <Card
        style={{
          marginBottom: 16,
          gap: 16,
          padding: 20,
          backgroundColor: C.green,
          borderColor: C.green,
          borderRadius: 28,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            right: -60,
            top: -86,
            width: 220,
            height: 220,
            borderRadius: 110,
            borderWidth: 1,
            borderColor: '#ffffff18',
          }}
        >
          <View
            style={{
              position: 'absolute',
              inset: 24,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: '#ffffff18',
            }}
          />
          <View
            style={{
              position: 'absolute',
              inset: 48,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: '#ffffff18',
            }}
          />
        </View>
        <View style={[s.row, { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }]}>
          <Text style={{ color: '#d6e0cc', fontSize: 13, fontWeight: '500' }}>Your work time</Text>
          <Tag
            text={active ? 'Working now' : 'Ready to start'}
            bg="#ffffff17"
            color={active ? C.accent : '#e5ebdf'}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: C.white,
              fontSize: 40,
              lineHeight: 50,
              fontWeight: '500',
              letterSpacing: -1.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {active
              ? formatWorkDuration(workDurationMs(active, 0, now), true)
              : formatWorkDuration(total)}
          </Text>
          <Text style={{ color: '#d6e0cc', fontSize: 12, lineHeight: 18 }}>
            {active
              ? `Started ${timeLabel(active.started_at)} · ${formatWorkDuration(total)} today`
              : 'Total time logged today'}
          </Text>
        </View>
        <View style={[s.row, { gap: 8 }]}>
          <View style={{ flex: 1 }}>
            <Button
              title={active ? 'Stop work' : 'Start work'}
              icon={active ? 'stop-circle-outline' : 'play-circle-outline'}
              tone="accent"
              loading={busy}
              onPress={toggle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="My history"
              icon="time-outline"
              tone="glass"
              onPress={() => setHistory(true)}
            />
          </View>
        </View>
        <Text style={{ color: '#d6e0cc', fontSize: 12, lineHeight: 18 }}>
          {active
            ? 'Your timer keeps running when you close the app.'
            : 'Start when you begin. Stop for a break or when you finish.'}
        </Text>
      </Card>
      <ErrorText text={error} />
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.body, { color: C.green, marginBottom: 16 }]}
        >
          {message}
        </Text>
      ) : null}
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
