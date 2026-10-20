import { photoCheckDetails, photoCheckHelp, photoCheckLabel, splitPhotoProblems } from '@sproutcue/shared/photo-check';
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

export type ChildCheck = { status?: 'unchecked' | 'passed' | 'rejected' | 'error' | string; code?: string | null; severity?: string | null };
export type SavedPhoto = { id: string; label?: string; contentUrl?: string; sourceKind?: string; createdAt?: string; childCheck?: ChildCheck };
export type PhotoLanguage = 'en' | 'zh-CN';
/** Why one photo can't be used (or, for severity "warning", might not look great). */
export type PhotoProblem = { code: string; severity: string | null; label: string; message: string };

/**
 * The child-photo check rejected one or more photos. `uploads` is keyed by the picked photo's uri,
 * `saved` by saved-photo id, so screens can mark exactly which photos to remove or replace.
 */
export class PhotoCheckBlockedError extends Error {
  uploads: Record<string, PhotoProblem>;
  saved: Record<string, PhotoProblem>;
  constructor(message: string, uploads: Record<string, PhotoProblem> = {}, saved: Record<string, PhotoProblem> = {}) {
    super(message);
    this.name = 'PhotoCheckBlockedError';
    this.uploads = uploads;
    this.saved = saved;
  }
}

function blockedMessage(count: number, language: PhotoLanguage) {
  if (language === 'zh-CN') return `${count} 张照片无法使用。请移除或更换后再试。${photoCheckHelp(language)}`;
  return `${count === 1 ? '1 photo can’t' : `${count} photos can’t`} be used. Remove or replace ${count === 1 ? 'it' : 'them'} and try again. ${photoCheckHelp(language)}`;
}

function problemFrom(details: any, language: PhotoLanguage): PhotoProblem {
  return details.photoErrors?.[0] || { code: details.code, severity: details.severity, label: photoCheckLabel(details.code, language), message: details.message };
}

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
  { label, sourceKind, index, total, language = 'en', onChecking }: { label: string; sourceKind: 'picture_book' | 'practice_story' | 'toy_play'; index: number; total: number; language?: PhotoLanguage; onChecking?: () => void },
): Promise<SavedPhoto> {
  if (!supabase) throw new Error('Private photo storage is unavailable in this build.');
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error('Sign in again before uploading photos.');
  const storagePath = incomingPhotoPath(data.user.id, uploadId(), photo.mimeType);
  const bytes = await photoBytes(photo);
  const { error } = await supabase.storage.from('family-assets').upload(storagePath, bytes, { contentType: photo.mimeType, upsert: false });
  if (error) throw new Error(`Photo ${index + 1} of ${total} could not upload: ${error.message}`);
  onChecking?.();
  try {
    const result = await apiRequest<{ photo: SavedPhoto }>('/family-assets/photos/direct-upload', {
      method: 'POST',
      body: { storagePath, originalName: photo.fileName, mimeType: photo.mimeType, byteSize: bytes.byteLength || photo.fileSize, label, sourceKind, photoIndex: index, language },
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

/**
 * Uploads photos of the child for a picture book or story, one at a time. The server checks each
 * one. Photos already in `cache` (keyed by uri) are reused, so a retry only sends replacements.
 * A rejected photo doesn't stop the rest; afterwards a PhotoCheckBlockedError lists every rejected
 * photo. Returns the saved photos in the same order as `photos`.
 */
export async function uploadChildPhotos(
  photos: PickedPhoto[],
  options: { label: string; sourceKind: 'picture_book' | 'practice_story'; language?: PhotoLanguage; cache: Map<string, SavedPhoto> },
  onProgress?: (text: string) => void,
) {
  const language = options.language || 'en';
  const mandarin = language === 'zh-CN';
  const saved: SavedPhoto[] = [];
  const problems: Record<string, PhotoProblem> = {};
  for (const [index, photo] of photos.entries()) {
    const cached = options.cache.get(photo.uri);
    if (cached) {
      saved.push(cached);
      continue;
    }
    const position = `${index + 1}${mandarin ? '/' : ' of '}${photos.length}`;
    onProgress?.(mandarin ? `正在上传照片 ${position}…` : `Uploading photo ${position}…`);
    try {
      const result = await uploadAiPhoto(photo, {
        label: options.label, sourceKind: options.sourceKind, index, total: photos.length, language,
        onChecking: () => onProgress?.(mandarin ? `正在检查照片 ${position}…` : `Checking photo ${position}…`),
      });
      options.cache.set(photo.uri, result);
      saved.push(result);
    } catch (error) {
      const details = photoCheckDetails(error, language);
      if (!details) throw error;
      if (details.severity === 'retry') throw new Error(details.message);
      problems[photo.uri] = problemFrom(details, language);
    }
  }
  const count = Object.keys(problems).length;
  if (count) throw new PhotoCheckBlockedError(blockedMessage(count, language), problems);
  return saved;
}

/**
 * Turns a 422 from creating a book or story into a PhotoCheckBlockedError pointing at the picked
 * photos (`photos`, aligned with `uploaded`) and saved photos (`savedPhotoIds`, sent first).
 * Any other error is returned unchanged.
 */
export function photoCheckErrorFor(
  error: unknown,
  { language = 'en', photos = [], uploaded = [], savedPhotoIds = [] }: { language?: PhotoLanguage; photos?: PickedPhoto[]; uploaded?: SavedPhoto[]; savedPhotoIds?: string[] },
) {
  const details = photoCheckDetails(error, language);
  if (!details) return error;
  if (details.severity === 'retry') return new Error(details.message);
  const { saved, uploads } = splitPhotoProblems(details, { savedPhotoIds, uploadedPhotoIds: uploaded.map((photo) => photo.id), uploadOffset: savedPhotoIds.length });
  const byUri: Record<string, PhotoProblem> = {};
  Object.entries(uploads).forEach(([index, problem]) => {
    const photo = photos[Number(index)];
    if (photo) byUri[photo.uri] = problem as PhotoProblem;
  });
  const count = Object.keys(byUri).length + Object.keys(saved).length;
  return new PhotoCheckBlockedError(count ? blockedMessage(count, language) : `${details.message} ${details.help}`, byUri, saved as Record<string, PhotoProblem>);
}
