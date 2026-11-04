import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Field, ErrorText, Icon, C, s, Tag } from './ui';
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
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, backgroundColor: C.bg }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flex: 1,
          flexDirection: width > 800 ? 'row' : 'column',
          minHeight: width > 800 ? 800 : undefined,
        }}
      >
        <LinearGradient
          colors={['#163e30', '#245b45']}
          style={{
            flex: 1,
            padding: width > 800 ? 64 : 30,
            justifyContent: 'space-between',
            minHeight: width > 800 ? 760 : 350,
          }}
        >
          <View style={[s.row, { gap: 10 }]}>
            <View
              style={{
                width: 34,
                height: 34,
                backgroundColor: '#daf7c0',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="pulse" color="#1b4934" size={24} />
            </View>
            <Text style={{ fontSize: 27, fontWeight: '700', color: 'white', letterSpacing: -1 }}>
              alphacoders
            </Text>
          </View>
          <View style={{ gap: 23, marginVertical: 40 }}>
            <Tag text="LESS CHASING. MORE DOING." color="#d4edc0" bg="#ffffff16" />
            <Text
              style={{
                fontSize: width > 800 ? 54 : 38,
                lineHeight: width > 800 ? 62 : 45,
                fontWeight: '600',
                letterSpacing: -2,
                color: 'white',
              }}
            >
              Great work.{'\n'}Always in sync.
            </Text>
            <Text style={{ fontSize: 15, color: '#b8cfc1', lineHeight: 25, maxWidth: 350 }}>
              A little clarity goes a long way. Bring your people, projects, and progress together
              in one thoughtful workspace.
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {[24, 42, 33, 58, 47, 72, 61, 88, 76, 104, 90, 120].map((h, i) => (
                <View
                  key={i}
                  style={{
                    height: h,
                    width: width > 800 ? 17 : 12,
                    backgroundColor: i > 8 ? '#c2e59a' : '#6f9a76',
                    borderRadius: 5,
                    alignSelf: 'flex-end',
                    opacity: 0.45 + i * 0.045,
                  }}
                />
              ))}
            </View>
          </View>
          <Text style={{ fontSize: 12, color: '#b8cfc1' }}>
            Small updates. Meaningful momentum.
          </Text>
        </LinearGradient>
        <View
          style={{
            flex: 1,
            padding: width > 800 ? 64 : 28,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{ width: '100%', maxWidth: 380 }}>
            <Text style={s.eyebrow}>YOUR TEAM’S NEXT CHAPTER</Text>
            <Text style={[s.title, { marginTop: 12, marginBottom: 10 }]}>
              {session
                ? session.user.emailVerified
                  ? 'Make yourself at home'
                  : 'Check your inbox.'
                : mode === 'login'
                  ? 'Welcome to your workday.'
                  : mode === 'reset'
                    ? 'Let’s get you back in.'
                    : 'A better way to work.'}
            </Text>
            <Text style={[s.body, { marginBottom: 30 }]}>
              {session
                ? session.user.emailVerified
                  ? 'Create your team workspace or join with a founder’s invite code.'
                  : `Verify ${session.user.email} before creating or joining a workspace.`
                : 'Clear updates. Connected teams. A calmer way to get things done.'}
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
                      setMessage('Verification email sent. Check your inbox and spam folder.');
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
                <View style={[s.chips, { marginBottom: 24 }]}>
                  {['Create workspace', 'Join team'].map((t, i) => (
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
                    label="Workspace invite code"
                    value={code}
                    onChangeText={setCode}
                    placeholder="Ask your founder for the invite code"
                  />
                ) : (
                  <Field
                    label="Workspace name"
                    value={workspace}
                    onChangeText={setWorkspace}
                    placeholder="Your workspace name"
                  />
                )}
              </>
            ) : (
              <>
                <Field
                  label="Work email"
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
                      : 'Create workspace'
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
                  style={{ paddingVertical: 20 }}
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
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
