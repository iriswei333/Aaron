import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { ChatPhoto } from './chat';
import { PhotoPermissionError } from './photo-upload';

// Photos in family chat travel inside the message as a JPEG data URL (same as the web chat).
// The API keeps at most 400,000 characters of it, so we shrink each photo until it fits —
// longest side 1280 px first, then smaller and more compressed if needed.
const MAX_DATA_URL_CHARS = 380_000;
const STEPS: { side: number; compress: number }[] = [
  { side: 1280, compress: 0.62 },
  { side: 1080, compress: 0.55 },
  { side: 900, compress: 0.5 },
  { side: 720, compress: 0.45 },
  { side: 560, compress: 0.4 },
];

export class ChatPhotoTooLargeError extends Error {}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  exif: false,
  // iOS: export HEIC as JPEG so it can be resized.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<ChatPhoto> {
  const landscape = (asset.width || 0) >= (asset.height || 0);
  const longest = Math.max(asset.width || 0, asset.height || 0);
  for (const step of STEPS) {
    const context = ImageManipulator.manipulate(asset.uri);
    if (!longest || longest > step.side) context.resize(landscape ? { width: step.side } : { height: step.side });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: step.compress, format: SaveFormat.JPEG, base64: true });
    const dataUrl = `data:image/jpeg;base64,${result.base64 || ''}`;
    if (result.base64 && dataUrl.length <= MAX_DATA_URL_CHARS) {
      return { uri: result.uri, dataUrl, width: result.width, height: result.height, bytes: Math.round((result.base64.length * 3) / 4) };
    }
  }
  throw new ChatPhotoTooLargeError('That photo is too detailed to send in chat. Try a different one.');
}

/** Lets the parent take or choose one photo, ready to send. Returns null if they cancel. */
export async function pickChatPhoto(source: 'camera' | 'library'): Promise<ChatPhoto | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PhotoPermissionError('Camera access is off for SproutCue. Allow it in Settings to take a photo.');
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    return result.canceled || !result.assets[0] ? null : shrink(result.assets[0]);
  }
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.accessPrivileges !== 'limited') {
      throw new PhotoPermissionError('Photo access is off for SproutCue. Allow it in Settings to choose photos.');
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  return result.canceled || !result.assets[0] ? null : shrink(result.assets[0]);
}
