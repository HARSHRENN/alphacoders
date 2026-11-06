import React from 'react';
import { View } from 'react-native';
import { useStore } from '../store';
import { useClock } from '../lib/useClock';
import { teamWorkSummary, formatWorkDuration } from '../lib/domain';
import { Text } from './Typography';
import { Card, Button, Tag, C, s } from './ui';

export function TeamProgress({ onTeam }: { onTeam: () => void }) {
  const { data } = useStore();
  const now = useClock();
  const summary = teamWorkSummary(data!, now);
  return (
    <Card
      style={{
        backgroundColor: C.green,
        borderColor: C.green,
        borderRadius: 28,
        padding: 20,
        gap: 16,
        marginBottom: 16,
      }}
    >
      <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
        <Text style={{ color: '#d6e0cc', fontSize: 13 }}>Today’s progress</Text>
        <Tag text="Founder" bg="#ffffff17" color={C.accent} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: C.white, fontSize: 36, fontWeight: '500', letterSpacing: -1 }}>
          {summary.members ? `${summary.updatedMembers} of ${summary.members}` : 'Welcome!'}
        </Text>
        <Text style={{ color: '#d6e0cc', fontSize: 13, lineHeight: 19 }}>
          {summary.members
            ? 'teammates sent an update today'
            : 'Invite a teammate to start seeing progress.'}
        </Text>
      </View>
      <View style={[s.row, { alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }]}>
        {[
          [String(summary.workingMembers), 'Working now'],
          [formatWorkDuration(summary.totalMs), 'Hours logged today'],
        ].map(([value, label]) => (
          <View key={label} style={{ flexGrow: 1, gap: 4 }}>
            <Text style={{ color: C.white, fontSize: 20, fontWeight: '600' }}>{value}</Text>
            <Text style={{ color: '#d6e0cc', fontSize: 11 }}>{label}</Text>
          </View>
        ))}
      </View>
      {summary.overdueProjects ? (
        <Text style={{ color: C.accent, fontSize: 12 }}>
          {summary.overdueProjects} project{summary.overdueProjects === 1 ? '' : 's'} past deadline
        </Text>
      ) : null}
      <Button
        title={summary.members ? 'View team & hours' : 'Invite your team'}
        tone="accent"
        onPress={onTeam}
      />
    </Card>
  );
}
