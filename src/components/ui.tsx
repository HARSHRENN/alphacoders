import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
export const C = {
  bg: '#f6f8f7',
  white: '#ffffff',
  ink: '#18382f',
  muted: '#64766d',
  green: '#246d50',
  mint: '#dff2e8',
  line: '#e7ece8',
  orange: '#c47a30',
  softOrange: '#fff2df',
  red: '#ba5650',
};
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({
  name,
  size = 20,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <Ionicons name={name} size={size} color={color} />;
export function Button({
  title,
  onPress,
  secondary = false,
  icon,
  disabled = false,
  loading = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        small && { paddingVertical: 10, minHeight: 44 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={secondary ? C.green : 'white'} />
      ) : icon ? (
        <Icon name={icon} size={18} color={secondary ? C.ink : 'white'} />
      ) : null}
      <Text style={[s.buttonText, secondary && { color: C.ink }]}>{title}</Text>
    </Pressable>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Tag({
  text,
  color = C.green,
  bg = C.mint,
}: {
  text: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>{text}</Text>
    </View>
  );
}
export function Avatar({
  name,
  color = C.mint,
  size = 36,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={{ color: C.ink, fontSize: size * 0.31, fontWeight: '700' }}>
        {name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </Text>
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secureTextEntry = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputShell, focused && { borderColor: C.green, backgroundColor: C.white }]}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#7f8f85"
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={
            keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences'
          }
          style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ expanded: revealed }}
            onPress={() => setRevealed((current) => !current)}
            style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={[s.heading, width < 600 && { flexDirection: 'column', alignItems: 'flex-start' }]}>
      <View style={{ flexShrink: 1, minWidth: 0, gap: 5 }}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={s.title}>{title}</Text>
        {description ? <Text style={s.body}>{description}</Text> : null}
      </View>
      {action ? (
        <View style={width < 600 ? { alignSelf: 'stretch' } : { marginLeft: 'auto' }}>
          {action}
        </View>
      ) : null}
    </View>
  );
}
export function Section({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[s.row, { marginBottom: 12, marginTop: 4 }]}>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.h2}>{title}</Text>
        {subtitle ? <Text style={s.body}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
export function Link({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: C.green }}>{text}</Text>
      <Icon name="arrow-forward" size={14} color={C.green} />
    </Pressable>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <View style={s.emptyIcon}>
          <Icon name="layers-outline" color={C.green} size={22} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.h3}>{title}</Text>
          <Text style={s.body}>{body}</Text>
        </View>
      </View>
      {action}
    </Card>
  );
}
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  contentKey,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  contentKey?: string | number;
}) {
  const { width } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.overlay, width < 600 && { justifyContent: 'flex-end', padding: 8 }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modal}
        >
          <View style={[s.row, { padding: 16, borderBottomWidth: 1, borderColor: C.line }]}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.h2}>{title}</Text>
              {subtitle ? <Text style={s.body}>{subtitle}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              onPress={onClose}
              style={s.iconButton}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView
            key={contentKey}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function ErrorText({ text }: { text: string }) {
  return text ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 14, backgroundColor: '#fff0ed', borderRadius: 10, marginBottom: 16 }}
    >
      <Text style={{ color: C.red, fontSize: 13, lineHeight: 20 }}>{text}</Text>
    </View>
  ) : null;
}
export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 16,
  },
  button: {
    minHeight: 46,
    backgroundColor: C.green,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  buttonText: { fontSize: 13, color: 'white', fontWeight: '600' },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, alignSelf: 'flex-start' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: C.ink },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d8e2db',
    backgroundColor: '#fafcfb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    padding: 12,
    fontSize: 15,
    color: C.ink,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  title: { fontSize: 26, fontWeight: '700', color: C.ink, letterSpacing: -1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7, color: C.muted },
  body: { fontSize: 13, lineHeight: 20, color: C.muted },
  h2: { fontSize: 17, fontWeight: '600', color: C.ink, letterSpacing: -0.3 },
  h3: { fontSize: 14, fontWeight: '600', color: C.ink },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: '#10291f88',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: C.white,
    borderRadius: 22,
    maxWidth: 640,
    width: '100%',
    maxHeight: '95%',
    overflow: 'hidden',
  },
  iconButton: { padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 10 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  small: { fontSize: 11, color: C.muted, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  chipActive: { backgroundColor: C.mint, borderColor: '#b3d5c3' },
  chipText: { fontSize: 12, color: C.ink },
  progress: { height: 5, backgroundColor: '#edf1ed', borderRadius: 6, overflow: 'hidden' },
  space: { marginBottom: 18 },
});
