import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = resolve('data');
const DATA_FILE = join(DATA_DIR, 'app-state.json');

export function defaultStore() {
  return { users: {}, posts: [] };
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function readStore() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return defaultStore();
    throw error;
  }
}

export async function writeStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

export async function mutateStore(mutator) {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

export function findUserByEmail(store, email) {
  const normalized = normalizeEmail(email);
  return Object.values(store.users).find((user) => normalizeEmail(user.email) === normalized);
}

export function publicUserSummary(user) {
  return {
    id: user.id,
    email: user.email || '',
    displayName: user.displayName,
    updatedAt: user.updatedAt,
  };
}

export function createUser({ displayName = 'Aaron Family', email = '' } = {}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  return {
    id,
    email: normalizeEmail(email),
    displayName,
    createdAt: now,
    updatedAt: now,
    socialLinks: { icloudPhotosUrl: '', instagramUrl: '', tiktokUrl: '' },
    location: null,
    foodPlan: { favorites: ['peas', 'broccoli', 'banana'], weeklyMenu: [] },
    amazonErrands: {
      tasks: [
        { title: 'Diapers and wipes', cadence: 'Monthly', status: 'planned' },
        { title: 'Toddler outfit deals', cadence: 'Weekly', status: 'watching' },
      ],
    },
  };
}

export function updateUser(user, patch) {
  Object.assign(user, patch, { updatedAt: new Date().toISOString() });
  return user;
}

function fallbackCaption({ tone = '温柔可爱', fileName = 'today', mediaType = 'video' }) {
  const theme = tone === '车车主题'
    ? '车车、小脚步和好奇心一起出发'
    : tone === '俏皮活泼'
      ? '小小能量满格，快乐一路蹦出来'
      : tone === '季节感'
        ? '把今天的天气和笑脸都收藏起来'
        : '软软糯糯的一天，被小小的笑容点亮';
  const format = mediaType === 'photo' ? '三连拍' : '小电影';
  return `今日份Aaron${format}：${theme}。${fileName.replace(/\.[^.]+$/, '')} 这一刻太值得珍藏啦。#Aaron成长日记 #两岁日常`;
}

function extractTextFromOpenAI(data) {
  if (typeof data.output_text === 'string') return data.output_text.trim();
  return data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((part) => part.type === 'output_text' && part.text)
    ?.map((part) => part.text)
    ?.join('\n')
    ?.trim() || '';
}

export async function generateAiCaption(payload) {
  const imageDataUrls = Array.isArray(payload.imageDataUrls) && payload.imageDataUrls.length > 0
    ? payload.imageDataUrls
    : [payload.thumbnailDataUrl].filter(Boolean);

  if (!process.env.OPENAI_API_KEY || imageDataUrls.length === 0) {
    return { caption: fallbackCaption(payload), source: 'local-fallback' };
  }

  const mediaType = payload.mediaType === 'photo' ? 'photo set' : 'toddler family video frame';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CAPTION_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Write one warm, natural Simplified Chinese social media caption for a ${mediaType}. Tone: ${payload.tone || '温柔可爱'}. Mention visible details from the image content if relevant. Keep it under 80 Chinese characters plus 2-3 hashtags. Do not invent unsafe or private details.`,
          },
          ...imageDataUrls.slice(0, 3).map((imageUrl) => ({ type: 'input_image', image_url: imageUrl })),
        ],
      }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI caption request failed: ${response.status} ${detail}`);
  }

  const caption = extractTextFromOpenAI(await response.json());
  return { caption: caption || fallbackCaption(payload), source: caption ? 'openai' : 'local-fallback' };
}
