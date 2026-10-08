// Family tab logic shared by apps/web (src/tabs/profile.js) and apps/mobile (Family tab):
// which playdates to list, how to label them, and the "AI creations" list.

/**
 * Date and time labels for a playdate row, e.g. { date: 'Sat, Oct 10', time: '10:00 AM – 11:30 AM' }.
 * @param {{ startsAt?: string, endsAt?: string }} playDate
 */
export function profilePlayDateTime(playDate) {
  const startsAt = new Date(playDate?.startsAt);
  const endsAt = new Date(playDate?.endsAt);
  if (Number.isNaN(startsAt.getTime())) return { date: 'Time not set', time: '' };
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = Number.isNaN(endsAt.getTime()) ? '' : ` – ${endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return { date, time: `${start}${end}` };
}

/**
 * Playdates the family created or joined, soonest first (undated ones last).
 * @template {{ startsAt?: string, isHost?: boolean, isJoined?: boolean }} T
 * @param {T[] | null | undefined} playDates
 * @returns {T[]}
 */
export function familyPlayDates(playDates) {
  return (Array.isArray(playDates) ? playDates : [])
    .filter((playDate) => playDate?.isHost || playDate?.isJoined)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.startsAt).getTime();
      const bTime = new Date(b.startsAt).getTime();
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    });
}

/**
 * "Created by you · Public · 2 families"
 * @param {{ status?: string, isHost?: boolean, visibility?: string, participantCount?: number | string }} playDate
 */
export function playDateSummary(playDate) {
  const isCancelled = playDate?.status === 'cancelled';
  const role = playDate?.isHost ? 'Created by you' : 'Joined playdate';
  const visibility = playDate?.visibility === 'private' ? 'Private' : 'Public';
  const count = Number(playDate?.participantCount) || 0;
  return `${role} · ${isCancelled ? 'Cancelled' : visibility} · ${count} ${count === 1 ? 'family' : 'families'}`;
}

/**
 * The newest AI creations across picture books, toy-play ideas and practice stories.
 * @param {{ pictureBooks?: any[], toyPlayAssets?: any[], practiceStoryAssets?: any[] }} [assets]
 * @param {number} [limit]
 * @returns {{ kind: 'book' | 'toy' | 'story', item: any, createdAt: string }[]}
 */
export function recentFamilyAssets({ pictureBooks = [], toyPlayAssets = [], practiceStoryAssets = [] } = {}, limit = 4) {
  return [
    ...pictureBooks.map((book) => ({ kind: 'book', item: book, createdAt: book.createdAt })),
    ...toyPlayAssets.map((asset) => ({ kind: 'toy', item: asset, createdAt: asset.createdAt })),
    ...practiceStoryAssets.map((asset) => ({ kind: 'story', item: asset, createdAt: asset.createdAt })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit);
}

/**
 * Title, subtitle and trailing label for an AI-creation row, matching the web Family tab.
 * @param {{ kind: 'book' | 'toy' | 'story', item: any }} entry
 * @param {string} [childName]
 * @returns {{ title: string, subtitle: string, action: string }}
 */
export function familyAssetRow(entry, childName = 'Your child') {
  const { kind, item } = entry;
  if (kind === 'story') {
    return {
      title: item.title || 'A little story',
      subtitle: `${item.goal || 'Everyday practice'} · ${(item.interests || []).join(', ')}`,
      action: 'Story →',
    };
  }
  if (kind === 'toy') {
    return {
      title: item.title || 'A new way to play',
      subtitle: `${item.toy?.name || 'Toy play'} · ${item.play?.durationMinutes || 5} minutes · Age ${item.childAgeMonths || ''} months`,
      action: item.language === 'zh-CN' ? '普通话玩法' : 'Play idea →',
    };
  }
  const pages = Object.values(item.pages || {});
  const ready = pages.filter((page) => page?.status === 'ready').length;
  return {
    title: item.title || item.template?.name || 'Picture book',
    subtitle: `${item.childName || childName} · ${ready}/${pages.length} pages ready`,
    action: '',
  };
}

export const TOY_PLAY_COPY = {
  en: {
    label: 'Saved play idea', close: 'Close', identified: 'Identified toy', duration: 'minutes', age: 'Age', goals: 'Developmental goals', materials: 'What you need', prompts: 'Try saying', steps: 'Play together', variations: 'Make it easier or harder', easier: 'Easier', harder: 'More challenge', safety: 'Grown-up check', delete: 'Delete play idea', deleting: 'Deleting…', confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
  },
  'zh-CN': {
    label: '普通话玩法', close: '关闭', identified: '识别到的玩具', duration: '分钟', age: '适合年龄', goals: '练习方向', materials: '需要准备', prompts: '可以这样说', steps: '一起玩', variations: '调整难度', easier: '更简单', harder: '增加挑战', safety: '家长安全检查', delete: '删除玩法', deleting: '正在删除…', confidence: { high: '高可信度', medium: '中等可信度', low: '低可信度' },
  },
};

/**
 * Confirmation text before deleting a saved asset (same wording as the web).
 * @param {'toy' | 'story'} kind
 * @param {{ title?: string, hasCoverImage?: boolean } | null | undefined} asset
 */
export function deleteAssetPrompt(kind, asset) {
  const label = kind === 'toy' ? 'saved play idea' : 'practice story';
  const image = asset?.hasCoverImage || kind === 'toy' ? ' and its generated image' : '';
  return {
    title: `Delete “${asset?.title || `this ${label}`}”?`,
    message: `This permanently removes the ${label}${image}.`,
    endpoint: kind === 'toy' ? '/family-assets/toy-plays' : '/family-assets/practice-stories',
    doneMessage: `${kind === 'toy' ? 'Play idea' : 'Practice story'} deleted.`,
    errorPrefix: `Could not delete the ${label}`,
  };
}
