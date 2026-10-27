import { blockConfirmCopy, unblockConfirmCopy } from '@sproutcue/shared/user-blocks';
import { Alert, Platform } from 'react-native';

import { apiRequest } from './api';

// Chat safety — blocking another family. Same endpoints as the web chat:
//   GET    /blocks             → { blocks: [{ userId, displayName, createdAt }] }
//   POST   /blocks  { userId } → { block }
//   DELETE /blocks  { userId } → { block }
// The server hides a blocked family's messages and direct chat and refuses direct messages
// both ways; after a change, refresh the chat list (useChat().refresh) to pick that up.

export type BlockedFamily = { userId: string; displayName: string; createdAt: string };

export async function listBlockedFamilies(): Promise<BlockedFamily[]> {
  const data = await apiRequest<{ blocks?: BlockedFamily[] }>('/blocks');
  return data.blocks || [];
}

export async function blockFamily(userId: string) {
  await apiRequest('/blocks', { method: 'POST', body: JSON.stringify({ userId }) });
}

export async function unblockFamily(userId: string) {
  await apiRequest('/blocks', { method: 'DELETE', body: JSON.stringify({ userId }) });
}

type Copy = { title: string; message: string; confirm: string };

function confirmDestructive(copy: Copy, onConfirm: () => void, destructive: boolean) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${copy.title}\n\n${copy.message}`)) onConfirm();
    return;
  }
  Alert.alert(copy.title, copy.message, [
    { text: 'Cancel', style: 'cancel' },
    { text: copy.confirm, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** "Block Priya?" confirm (native alert), then onConfirm. */
export function confirmBlock(name: string, onConfirm: () => void) {
  confirmDestructive(blockConfirmCopy(name) as Copy, onConfirm, true);
}

export function confirmUnblock(name: string, onConfirm: () => void) {
  confirmDestructive(unblockConfirmCopy(name) as Copy, onConfirm, false);
}
