import AsyncStorage from '@react-native-async-storage/async-storage';
import { createChunkedStorage } from '@sproutcue/shared/chunked-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Supabase session storage backed by the iOS Keychain / Android Keystore (expo-secure-store).
// Sessions can exceed SecureStore's ~2 KB value limit, so they're split into chunks
// (see packages/shared/src/chunked-storage.js, which is unit-tested).
// On web (the Expo browser preview) SecureStore isn't available, so AsyncStorage
// (localStorage) is used instead.

export type SupabaseStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const options: SecureStore.SecureStoreOptions = {
  // Readable after the first unlock, so token refresh still works when the app wakes in the background.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const keychainStorage = createChunkedStorage({
  get: (key) => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
});

const webStorage: SupabaseStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const sessionStorage: SupabaseStorage = Platform.OS === 'web' ? webStorage : keychainStorage;
