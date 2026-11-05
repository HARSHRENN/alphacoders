import React from 'react';
import { useClock } from '../lib/useClock';
import { View, Text, Pressable } from 'react-native';
import { Project } from '../types';
import { useStore } from '../store';
import { projectProgress, dateLabel } from '../lib/domain';
import { Card, Tag, Icon, Avatar, IconName, C, s } from './ui';
export function ProjectCard({ project: p, onPress }: { project: Project; onPress: () => void }) {
  const { data } = useStore();
  const progress = projectProgress(p.id, data!.updates);
  const contributors = data!.profiles.filter((person) =>
    data!.updates.some((u) => u.project_id === p.id && u.user_id === person.id),
  );
  const now = useClock();
  const overdue = Date.parse(p.deadline) < now && progress < 100;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${p.name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        minWidth: 0,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Card style={{ gap: 12 }}>
        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 0 }]}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 13,
              backgroundColor: p.color + '15',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={p.icon as IconName} color={p.color} size={20} />
          </View>
          <Tag
            text={overdue ? 'Overdue' : progress === 100 ? 'Completed' : p.priority + ' priority'}
            color={overdue ? C.red : p.priority === 'High' ? '#ae7736' : C.muted}
            bg={overdue ? '#fff0ed' : p.priority === 'High' ? '#fff5e8' : '#f0f3f1'}
          />
        </View>
        <Text style={[s.h2, { fontSize: 16, marginBottom: 0 }]}>{p.name}</Text>
        {p.description ? (
          <Text numberOfLines={2} style={[s.body, { fontSize: 12, lineHeight: 18 }]}>
            {p.description}
          </Text>
        ) : null}
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 0, marginBottom: 0 }]}>
          <Text style={s.small}>Progress</Text>
          <Text style={{ fontSize: 12, color: C.ink, fontWeight: '600' }}>{progress}%</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${p.name} progress`}
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={s.progress}
        >
          <View
            style={{ height: 5, width: `${progress}%`, backgroundColor: p.color, borderRadius: 5 }}
          />
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 0 }]}>
          <View style={{ flexDirection: 'row', paddingLeft: 6 }}>
            {contributors.slice(0, 3).map((person) => (
              <View
                key={person.id}
                style={{ marginLeft: -6, borderWidth: 2, borderColor: 'white', borderRadius: 20 }}
              >
                <Avatar name={person.name} color={person.avatar} size={26} />
              </View>
            ))}
            {!contributors.length ? <Text style={s.small}>Ready to begin</Text> : null}
          </View>
          <View style={[s.row, { gap: 5 }]}>
            <Icon name="calendar-outline" size={12} color={C.muted} />
            <Text style={s.small}>{dateLabel(p.deadline)}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
