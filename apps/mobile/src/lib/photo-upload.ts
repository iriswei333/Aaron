import { incomingPhotoPath, photoMimeType } from '@sproutcue/shared/studio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { apiRequest } from './api';
import { supabase } from './supabase';

// Photos for Play Studio: pick from the library or camera (expo-image-picker), then upload
// privately the same way the web does — straight to Supabase Storage ({user}/incoming/…),
// then POST /family-assets/photos/direct-upload so the API files it with the family's photos.
//
// HEIC: on iOS the picker hands back a JPEG ("compatible" representation), and the API also
// converts HEIC/HEIF itself, so iPhone photos work either way.

export type PickedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
};

export type SavedPhoto = { id: string; label?: string; contentUrl?: string; sourceKind?: string; createdAt?: string };

export class PhotoPermissionError extends Error {}

function toPicked(asset: ImagePicker.ImagePickerAsset, index: number): PickedPhoto {
  const mimeType = photoMimeType({ mimeType: asset.mimeType, fileName: asset.fileName }) || 'image/jpeg';
  return {
    uri: asset.uri,
    fileName: asset.fileName || `photo-${Date.now()}-${index}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType,
    fileSize: asset.fileSize || 0,
    width: asset.width,
    height: asset.height,
  };
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  exif: false,
  // iOS: export HEIC photos as JPEG so every step (preview, upload, AI) can read them.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

/** Opens the photo library. `limit` > 1 allows choosing several at once. Returns [] if cancelled. */
export async function pickPhotos(limit = 1): Promise<PickedPhoto[]> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.accessPrivileges !== 'limited') {
      throw new PhotoPermissionError('Photo access is off for SproutCue. Allow it in Settings to choose photos.');
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...PICKER_OPTIONS,
    allowsMultipleSelection: limit > 1,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map(toPicked);
}

/** Opens the camera for one photo. Returns null if cancelled. */
export async function takePhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PhotoPermissionError('Camera access is off for SproutCue. Allow it in Settings to take a photo.');
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets[0]) return null;
  return toPicked(result.assets[0], 0);
}

async function photoBytes(photo: PickedPhoto): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(photo.uri)).arrayBuffer();
  return new File(photo.uri).arrayBuffer();
}

function uploadId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Uploads one photo privately and returns the saved family photo (web saveDirectAiPhoto). */
export async function uploadAiPhoto(
  photo: PickedPhoto,
  { label, sourceKind, index, total }: { label: string; sourceKind: 'picture_book' | 'practice_story' | 'toy_play'; index: number; total: number },
): Promise<SavedPhoto> {
  if (!supabase) throw new Error('Private photo storage is unavailable in this build.');
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error('Sign in again before uploading photos.');
  const storagePath = incomingPhotoPath(data.user.id, uploadId(), photo.mimeType);
  const bytes = await photoBytes(photo);
  const { error } = await supabase.storage.from('family-assets').upload(storagePath, bytes, { contentType: photo.mimeType, upsert: false });
  if (error) throw new Error(`Photo ${index + 1} of ${total} could not upload: ${error.message}`);
  try {
    const result = await apiRequest<{ photo: SavedPhoto }>('/family-assets/photos/direct-upload', {
      method: 'POST',
      body: { storagePath, originalName: photo.fileName, mimeType: photo.mimeType, byteSize: bytes.byteLength || photo.fileSize, label, sourceKind },
      timeoutMs: 60_000,
    });
    return result.photo;
  } catch (uploadError) {
    await supabase.storage.from('family-assets').remove([storagePath]).catch(() => {});
    throw uploadError;
  }
}

/** Uploads several photos one at a time, reporting progress ("Uploading photo 2 of 3…"). */
export async function uploadAiPhotos(
  photos: PickedPhoto[],
  options: { label: string; sourceKind: 'picture_book' | 'practice_story' | 'toy_play' },
  onProgress?: (text: string) => void,
) {
  const saved: SavedPhoto[] = [];
  for (const [index, photo] of photos.entries()) {
    onProgress?.(`Uploading photo ${index + 1} of ${photos.length}…`);
    saved.push(await uploadAiPhoto(photo, { ...options, index, total: photos.length }));
  }
  return saved;
}
