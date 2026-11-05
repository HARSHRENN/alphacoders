import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { WorkUpdate } from '../types';
import { useStore } from '../store';
import { relative, timeLabel, dateLabel } from '../lib/domain';
import { Avatar, Tag, Icon, Link, C, s, Card } from './ui';
export function UpdateCard({
  update: u,
  onRevise,
  compact = false,
}: {
  update: WorkUpdate;
  onRevise?: (u: WorkUpdate) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const details = !compact || expanded;
  const { data, me } = useStore();
  const person = data!.profiles.find((p) => p.id === u.user_id);
  const project = data!.projects.find((p) => p.id === u.project_id);
  const revised = data!.updates.some((other) => other.supersedes === u.id);
  return (
    <Card style={{ padding: 16 }}>
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <Avatar name={person?.name || 'Team member'} color={person?.avatar} size={38} />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
            <Text style={s.h3}>{person?.name}</Text>
            <Text style={s.small}>{relative(u.created_at)}</Text>
            {u.supersedes ? <Tag text="Revision" /> : null}
            {revised ? <Tag text="Earlier version" color={C.muted} bg="#f0f3f1" /> : null}
          </View>
          <Text style={[s.small, { color: project?.color }]}>
            {project?.name} <Text style={{ color: C.muted }}> · Last {u.period_hours}h</Text>
          </Text>
        </View>
        <Tag text={`${u.progress}%`} color={C.green} bg="#edf5ef" />
      </View>
      <View style={{ marginTop: 12, gap: 10 }}>
        <View style={[s.row, { alignItems: 'flex-start', gap: 9 }]}>
          <Icon name="checkmark-circle" color="#6b9d73" size={16} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.label}>Completed</Text>
            <Text
              numberOfLines={compact && !expanded ? 3 : undefined}
              style={[s.body, { color: '#455d50' }]}
            >
              {u.completed}
            </Text>
          </View>
        </View>
        {details ? (
          <View style={[s.row, { alignItems: 'flex-start', gap: 9 }]}>
            <Icon name="ellipse-outline" color={C.muted} size={16} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.label}>Remaining</Text>
              <Text style={s.body}>{u.remaining || 'All work completed.'}</Text>
            </View>
          </View>
        ) : null}
        {u.blocker ? (
          <View
            style={{
              backgroundColor: '#fff7eb',
              padding: 11,
              borderRadius: 8,
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Icon name="flag-outline" color={C.orange} size={15} />
            <Text style={{ fontSize: 12, lineHeight: 18, color: '#9b743e', flex: 1 }}>
              Blocker: {u.blocker}
            </Text>
          </View>
        ) : null}
      </View>
      {details ? (
        <View style={[s.row, { marginTop: 14, justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Text style={s.small}>
            Finish by: {dateLabel(u.eta)}, {timeLabel(u.eta)}
          </Text>
          {u.user_id === me?.id && !revised && onRevise ? (
            <Link text="Revise update" onPress={() => onRevise(u)} />
          ) : null}
        </View>
      ) : null}
      {compact ? (
        <Link
          text={expanded ? 'Show less' : 'Remaining work & finish time'}
          onPress={() => setExpanded((open) => !open)}
        />
      ) : null}
    </Card>
  );
}
