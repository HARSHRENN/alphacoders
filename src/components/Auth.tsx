import { Text } from './Typography';
import React, { useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionView } from './MotionView';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Field, ErrorText, Icon, C, s } from './ui';
import { useStore } from '../store';
import { supabase, ensureDatabaseAccess } from '../lib/supabase';
import { firebaseAuth, authError } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
export function Auth() {
  const { session, refresh, leave, reloadAccount, error: connectionError } = useStore();
  const { width } = useWindowDimensions();
  const desktop = width > 800;
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [workspace, setWorkspace] = useState(''),
    [code, setCode] = useState(''),
    [joining, setJoining] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function submit() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (!supabase || !firebaseAuth)
        throw new Error(
          'Your workspace server is not connected yet. Connect the server before creating an account.',
        );
      if (session) {
        if (!session.user.emailVerified) {
          await reloadAccount();
          if (!firebaseAuth.currentUser?.emailVerified)
            throw new Error('Open the verification email first, then tap “I verified my email”.');
          return;
        }
        if (!name.trim()) throw new Error('Enter your full name.');
        await ensureDatabaseAccess();
        const { error: e } = await supabase.rpc(
          joining ? 'join_workspace' : 'create_workspace',
          joining
            ? { display_name: name.trim(), code: code.trim() }
            : { display_name: name.trim(), workspace_name: workspace.trim() },
        );
        if (e) throw e;
        await refresh();
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { user } = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        setPassword('');
        await sendEmailVerification(user);
        setMessage('Verification email sent. Check your inbox and spam folder.');
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(firebaseAuth, email.trim());
        setMessage('If an account exists for this address, you’ll receive a password reset email.');
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        setPassword('');
      }
    } catch (e: any) {
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexGrow: 1, flexDirection: desktop ? 'row' : 'column' }}>
            <LinearGradient
              colors={[C.green, '#2e4a36']}
              style={{
                flex: desktop ? 1 : undefined,
                padding: desktop ? 48 : 20,
                gap: desktop ? 32 : 10,
                justifyContent: 'center',
              }}
            >
              <View style={[s.row, { gap: 10 }]}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: C.accent,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="pulse" color="#1b4934" size={24} />
                </View>
                <Text
                  style={{ fontSize: 26, fontWeight: '700', color: 'white', letterSpacing: -1 }}
                >
                  alphacoders
                </Text>
              </View>
              {desktop ? (
                <>
                  <Text
                    style={{
                      fontSize: 44,
                      lineHeight: 50,
                      fontWeight: '600',
                      letterSpacing: -1.5,
                      color: 'white',
                    }}
                  >
                    Your team.{'\n'}Your progress.{'\n'}One place.
                  </Text>
                  <Text style={{ fontSize: 15, lineHeight: 24, color: '#c9ded1', maxWidth: 340 }}>
                    Track projects, share what’s done, and keep the next steps clear.
                  </Text>
                  <View style={{ gap: 14 }}>
                    {[
                      'Completed work and next steps',
                      'Hourly or two-hourly reminders',
                      'Shared updates for your whole team',
                    ].map((label) => (
                      <View key={label} style={s.row}>
                        <Icon name="checkmark-circle-outline" size={20} color={C.accent} />
                        <Text style={{ color: '#e1eee6', fontSize: 13, flex: 1 }}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={{ color: '#c9ded1', fontSize: 13 }}>Work updates made easy.</Text>
              )}
            </LinearGradient>
            <View
              style={{
                flex: desktop ? 1 : undefined,
                padding: desktop ? 40 : 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ width: '100%', maxWidth: 400 }}>
                <MotionView
                  key={`${mode}-${session ? (session.user.emailVerified ? 'workspace' : 'verify') : 'auth'}`}
                >
                  <Text style={s.eyebrow}>{session ? 'ACCOUNT SETUP' : 'YOUR TEAM WORKSPACE'}</Text>
                  <Text style={[s.title, { marginTop: 8, marginBottom: 6 }]}>
                    {session
                      ? session.user.emailVerified
                        ? 'Set up your team'
                        : 'Check your inbox.'
                      : mode === 'login'
                        ? 'Welcome back'
                        : mode === 'reset'
                          ? 'Reset your password'
                          : 'Create your account'}
                  </Text>
                  <Text style={[s.body, { marginBottom: 20 }]}>
                    {session
                      ? session.user.emailVerified
                        ? 'Create a team, or enter the invite code your founder shared.'
                        : `Verify ${session.user.email} before creating or joining a workspace.`
                      : mode === 'signup'
                        ? 'Create a login, verify your email, then create or join a team.'
                        : mode === 'reset'
                          ? 'We’ll email you a link to choose a new password.'
                          : 'Sign in to see your projects and share a work update.'}
                  </Text>
                  {session && !session.user.emailVerified ? (
                    <View style={{ marginBottom: 18 }}>
                      <Button
                        title="Resend verification email"
                        secondary
                        loading={busy}
                        onPress={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            if (firebaseAuth?.currentUser)
                              await sendEmailVerification(firebaseAuth.currentUser);
                            setMessage(
                              'Verification email sent. Check your inbox and spam folder.',
                            );
                          } catch (e) {
                            setError(authError(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </View>
                  ) : session ? (
                    <>
                      <View style={[s.chips, { marginBottom: 16 }]}>
                        {['Create a team', 'Join a team'].map((t, i) => (
                          <Pressable
                            accessibilityRole="button"
                            key={t}
                            onPress={() => setJoining(!!i)}
                            style={[s.chip, joining === !!i && s.chipActive]}
                          >
                            <Text style={s.chipText}>{t}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Field label="Your full name" value={name} onChangeText={setName} />
                      {joining ? (
                        <Field
                          label="Team invite code"
                          value={code}
                          onChangeText={setCode}
                          placeholder="Ask your founder for the invite code"
                        />
                      ) : (
                        <Field
                          label="Team name"
                          value={workspace}
                          onChangeText={setWorkspace}
                          placeholder="Your team name"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Field
                        label="Email address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        placeholder="you@company.com"
                      />
                      {mode !== 'reset' ? (
                        <Field
                          label="Password"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          placeholder="At least 8 characters"
                        />
                      ) : null}
                    </>
                  )}
                  <ErrorText text={error || connectionError} />
                  {message ? (
                    <Text style={[s.body, { color: C.green, marginBottom: 18 }]}>{message}</Text>
                  ) : null}
                  <Button
                    title={
                      session
                        ? !session.user.emailVerified
                          ? 'I verified my email'
                          : joining
                            ? 'Join workspace'
                            : 'Create team'
                        : mode === 'login'
                          ? 'Sign in'
                          : mode === 'reset'
                            ? 'Send reset email'
                            : 'Create account'
                    }
                    icon="arrow-forward"
                    onPress={submit}
                    loading={busy}
                  />
                  {!session ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setMode(mode === 'login' ? 'signup' : 'login');
                          setError('');
                          setMessage('');
                        }}
                        style={{ paddingVertical: 14 }}
                      >
                        <Text style={[s.body, { textAlign: 'center' }]}>
                          {mode === 'login'
                            ? 'New here? Create an account'
                            : 'Already have an account? Sign in'}
                        </Text>
                      </Pressable>
                      {mode === 'login' ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setMode('reset');
                            setError('');
                            setMessage('');
                          }}
                          style={{ paddingBottom: 20 }}
                        >
                          <Text style={[s.body, { textAlign: 'center' }]}>Forgot password?</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <View style={{ marginTop: 18 }}>
                      <Button
                        title="Sign out"
                        secondary
                        onPress={() => leave().catch((e) => setError(e.message))}
                      />
                    </View>
                  )}
                </MotionView>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
