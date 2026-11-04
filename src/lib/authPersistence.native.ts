// Firebase exports this API under Metro's react-native condition. Its browser
// declaration (used by this universal project's typecheck) omits the RN export.
// @ts-expect-error React Native runtime export, verified in Firebase's rn entry.
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const authPersistence = getReactNativePersistence(AsyncStorage);
