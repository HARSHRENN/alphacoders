import { Text } from './src/components/Typography';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from './src/store';
import { MotionView } from './src/components/MotionView';
import { Auth } from './src/components/Auth';
import { Overview, Projects, Updates, Team, Settings, ProjectDetail } from './src/Screens';
import { UpdateForm, ProjectForm } from './src/components/Forms';
import { Icon, Avatar, IconName, ErrorText, C, s } from './src/components/ui';
import { Project, WorkUpdate } from './src/types';
import { router, useLocalSearchParams } from 'expo-router';
const tabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'Overview', label: 'Home', icon: 'home-outline' },
  { name: 'Projects', label: 'Projects', icon: 'layers-outline' },
  { name: 'Updates', label: 'Updates', icon: 'chatbubbles-outline' },
  { name: 'Team', label: 'Team', icon: 'people-outline' },
  { name: 'Settings', label: 'Settings', icon: 'settings-outline' },
];
function Workspace() {
  const { data, me, loading, error, refresh, clearError } = useStore();
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;
  const { section } = useLocalSearchParams<{ section?: string }>();
  const tab = tabs.find((item) => item.name.toLowerCase() === section)?.name || 'Overview';
  const setTab = useCallback((name: string) => {
    router.replace(
      name === 'Overview'
        ? '/'
        : { pathname: '/[section]', params: { section: name.toLowerCase() } },
    );
  }, []);
  const [compose, setCompose] = useState(false),
    [newProject, setNewProject] = useState(false),
    [project, setProject] = useState<Project | null>(null),
    [target, setTarget] = useState<string>(),
    [revision, setRevision] = useState<WorkUpdate>(),
    [refreshing, setRefreshing] = useState(false),
    [localError, setLocalError] = useState('');
  const post = (id?: string) => {
    if (me?.role !== 'member') return;
    setProject(null);
    setRevision(undefined);
    setTarget(id);
    setCompose(true);
  };
  const revise = (u: WorkUpdate) => {
    setProject(null);
    setRevision(u);
    setCompose(true);
  };
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    let subscription: { remove: () => void } | undefined;
    import('expo-notifications')
      .then(async (N) => {
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        const handle = (r: any) => {
          if (!alive) return;
          const payload = r.notification.request.content.data;
          setTab('Updates');
          if (typeof payload.projectId === 'string') setTarget(payload.projectId);
        };
        subscription = N.addNotificationResponseReceivedListener(handle);
        const last = await N.getLastNotificationResponseAsync();
        if (last) {
          handle(last);
          await N.clearLastNotificationResponseAsync();
        }
      })
      .catch((e) => setLocalError(e.message));
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [setTab]);
  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.green} />
      </View>
    );
  if (!data || !me) return <Auth />;
  const nav = (bottom = false) =>
    tabs
      .filter((item) => !bottom || (item.name !== 'Settings' && item.name !== 'Updates'))
      .map((item) => {
        const selected =
          tab === item.name || (bottom && tab === 'Updates' && item.name === 'Overview');
        return (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{
              selected: selected,
            }}
            onPress={() => setTab(item.name)}
            style={({ pressed }) => [
              bottom ? styles.bottomItem : styles.navItem,
              selected && styles.navActive,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Icon name={item.icon} size={bottom ? 21 : 19} color={selected ? C.white : C.muted} />
            <Text
              style={{
                fontSize: bottom ? 12 : 13,
                color: selected ? C.white : C.muted,
                fontWeight: selected ? '600' : '400',
              }}
            >
              {item.label}
            </Text>
            {!bottom && item.name === 'Updates' ? (
              <View
                style={{
                  marginLeft: 'auto',
                  backgroundColor: '#e4eddf',
                  borderRadius: 5,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, color: '#67805c' }}>{data.updates.length}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {desktop ? (
          <View style={styles.sidebar}>
            <View style={[s.row, { paddingHorizontal: 14, marginBottom: 24 }]}>
              <View style={styles.logoIcon}>
                <Icon name="pulse" size={24} color={C.accent} />
              </View>
              <Text style={styles.logo}>alphacoders</Text>
            </View>
            <View style={styles.workspacePicker}>
              <View
                style={{
                  width: 31,
                  height: 31,
                  borderRadius: 8,
                  backgroundColor: '#e3ecdf',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#65805b' }}>
                  {data.workspace.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.ink }}>
                  {data.workspace.name}
                </Text>
                <Text style={{ fontSize: 10, color: C.muted }}>Team workspace</Text>
              </View>
            </View>
            <Text style={[s.eyebrow, { fontSize: 9, paddingHorizontal: 16, marginBottom: 14 }]}>
              WORKSPACE
            </Text>
            <View style={{ gap: 7 }}>{nav()}</View>
            <View style={{ flex: 1 }} />
            <View
              style={[
                s.row,
                { padding: 14, borderTopWidth: 1, borderColor: C.line, marginTop: 18 },
              ]}
            >
              <Avatar name={me.name} color={me.avatar} size={33} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.ink }}>{me.name}</Text>
                <Text style={{ fontSize: 10, color: C.muted }}>
                  {me.role === 'founder' ? 'Founder' : 'Team member'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Account settings"
                onPress={() => setTab('Settings')}
              >
                <Icon name="ellipsis-horizontal" size={18} color={C.muted} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={[styles.topbar, { paddingHorizontal: desktop ? 24 : 16 }]}>
            <View style={[s.row, { gap: 9 }]}>
              {!desktop ? (
                tab === 'Updates' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to Home"
                    onPress={() => setTab('Overview')}
                    style={{ minHeight: 44, minWidth: 36, justifyContent: 'center' }}
                  >
                    <Icon name="arrow-back" />
                  </Pressable>
                ) : (
                  <View style={styles.logoIcon}>
                    <Icon name="pulse" color={C.accent} size={21} />
                  </View>
                )
              ) : (
                <Icon name="home-outline" size={14} color={C.muted} />
              )}
              {desktop ? (
                <>
                  <Text style={{ fontSize: 12, color: C.muted }}>Workspace</Text>
                  <Text style={{ fontSize: 12, color: C.muted }}>/</Text>
                  <Text style={{ fontSize: 12, color: C.ink }}>
                    {tab === 'Overview' ? 'Home' : tab}
                  </Text>
                </>
              ) : (
                <Text style={styles.logo}>{tab === 'Updates' ? 'Updates' : 'alphacoders'}</Text>
              )}
            </View>
            <View style={[s.row, { gap: 14 }]}>
              {desktop ? (
                <Text style={{ fontSize: 11, color: C.muted }}>
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notification settings"
                onPress={() => setTab('Settings')}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 22,
                }}
              >
                <Icon name="notifications-outline" size={19} />
                {me.notifications_enabled ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: 7,
                      top: 6,
                      width: 5,
                      height: 5,
                      borderRadius: 4,
                      backgroundColor: '#81a76f',
                    }}
                  />
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile and settings"
                onPress={() => setTab('Settings')}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Avatar name={me.name} color={me.avatar} size={32} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            key={tab}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: desktop ? 24 : 16,
              paddingBottom: 24,
              maxWidth: 1280,
              width: '100%',
              alignSelf: 'center',
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={C.green}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    await refresh();
                  } catch (e: any) {
                    setLocalError(e.message);
                  } finally {
                    setRefreshing(false);
                  }
                }}
              />
            }
          >
            <ErrorText text={error || localError} />
            {error || localError ? (
              <Pressable
                onPress={() => {
                  clearError();
                  setLocalError('');
                }}
              >
                <Text style={[s.small, { marginBottom: 12 }]}>Dismiss</Text>
              </Pressable>
            ) : null}
            <MotionView key={tab}>
              {tab === 'Overview' ? (
                <Overview
                  onUpdate={post}
                  onProject={setProject}
                  onNavigate={setTab}
                  onNewProject={() => setNewProject(true)}
                />
              ) : tab === 'Projects' ? (
                <Projects onProject={setProject} onNewProject={() => setNewProject(true)} />
              ) : tab === 'Updates' ? (
                <Updates onUpdate={() => post()} onRevise={revise} onNavigate={setTab} />
              ) : tab === 'Team' ? (
                <Team />
              ) : (
                <Settings />
              )}
            </MotionView>
          </ScrollView>
          {!desktop ? <View style={styles.bottomNav}>{nav(true)}</View> : null}
        </View>
      </View>
      <ProjectDetail
        project={project}
        onClose={() => setProject(null)}
        onUpdate={post}
        onRevise={revise}
      />
      {compose ? (
        <UpdateForm
          visible={compose}
          onClose={() => setCompose(false)}
          projectId={target}
          revision={revision}
        />
      ) : null}
      {newProject ? <ProjectForm visible onClose={() => setNewProject(false)} /> : null}
    </SafeAreaView>
  );
}
export default Workspace;
const styles = StyleSheet.create({
  sidebar: {
    width: 225,
    backgroundColor: '#fbfcf9',
    borderRightWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingTop: 24,
  },
  logoIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { fontSize: 20, color: C.ink, letterSpacing: -0.8, fontWeight: '700' },
  workspacePicker: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 9,
  },
  navActive: { backgroundColor: C.green },
  topbar: {
    minHeight: 68,
    backgroundColor: C.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomNav: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.line,
    padding: 6,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 28,
    backgroundColor: C.white,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 22,
  },
});
