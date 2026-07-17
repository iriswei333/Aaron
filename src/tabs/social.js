import { apiRequest, escapeHtml, icon } from '../shared.js';

export function resetSocialState(state) {
  state.media = [];
  state.generatedCaption = '';
  state.captionStatus = '';
}

async function copyText(value) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall through to the textarea copy fallback.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand?.('copy');
  textarea.remove();
}

function handleFiles(ctx, files) {
  const { state } = ctx;
  state.generatedCaption = '';
  state.captionStatus = '';
  const selected = Array.from(files || []).slice(0, 8).map((file, index) => ({
    file,
    name: file.name,
    kind: file.type.startsWith('video') ? 'video' : 'photo',
    score: 98 - index * 7 - (file.type.startsWith('video') ? 2 : 0),
    reason: file.type.startsWith('video') ? '视频优先：动作和声音更适合记录今天的故事。' : '照片清晰、表情自然，适合当天分享。',
    url: URL.createObjectURL(file),
  }));
  const video = selected.find((item) => item.kind === 'video');
  state.media = video ? [video] : selected.filter((item) => item.kind === 'photo').slice(0, 3);
  ctx.renderCurrent();
}

function extractVideoFrame(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = videoUrl;
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(0.5, Math.max(0, (video.duration || 1) / 3));
    }, { once: true });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const width = Math.min(video.videoWidth || 720, 720);
        const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 720)));
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    }, { once: true });
    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Could not read a frame from this video.'));
    }, { once: true });
  });
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this photo.'));
    };
    image.src = objectUrl;
  });
}

async function generateMediaCaption(ctx) {
  const { state } = ctx;
  if (state.media.length === 0 || !state.user) return;
  const video = state.media.find((item) => item.kind === 'video');
  const photos = state.media.filter((item) => item.kind === 'photo');
  state.captionStatus = video ? 'Reading video frame…' : 'Reading selected photos…';
  ctx.renderCurrent();
  try {
    const imageDataUrls = video
      ? [await extractVideoFrame(video.url)]
      : await Promise.all(photos.slice(0, 3).map((photo) => imageFileToDataUrl(photo.file)));
    state.captionStatus = 'Generating caption…';
    ctx.renderCurrent();
    const result = await apiRequest('/social-media/caption', {
      method: 'POST',
      body: JSON.stringify({
        fileName: video ? video.name : photos.map((photo) => photo.name).join(', '),
        mediaType: video ? 'video' : 'photo',
        tone: state.captionTone,
        imageDataUrls,
      }),
    });
    state.generatedCaption = result.caption;
    state.captionStatus = result.source === 'openai'
      ? `AI caption generated from ${video ? 'video frame' : 'selected photos'}.`
      : 'Local fallback caption generated. Add OPENAI_API_KEY for AI vision captions.';
  } catch (error) {
    state.captionStatus = `Caption failed: ${error.message}`;
  }
  ctx.renderCurrent();
}

export function renderSocial(ctx) {
  const { state } = ctx;
  const caption = state.generatedCaption || (state.media.length === 1 && state.media[0].kind === 'video'
    ? `今日份Aaron小电影🎬：两岁的小小探险家，把平凡的一天玩成了冒险。${state.captionTone}，每一秒都想珍藏。`
    : '今日份Aaron三连拍📷：小手忙着探索，笑容负责发光。两岁的快乐很简单，有爱、有玩具，也有一点点甜甜的惊喜。#Aaron成长日记');

  ctx.layout(`<main class="grid two-cols"><section class="panel upload-panel"><p class="eyebrow">Today’s best post</p><h2>Pick best 3 photos or 1 video</h2><p>Upload today’s Apple Photos exports. The app selects one video if present; otherwise it picks the top three photos and drafts a Chinese caption.</p><label class="upload-box">${icon('⬆️')}<span>Choose photos or video</span><input id="media-input" type="file" accept="image/*,video/*" multiple /></label><label class="input-label" for="tone">Caption tone</label><select id="tone"><option>温柔可爱</option><option>俏皮活泼</option><option>季节感</option><option>车车主题</option></select><button id="generate-caption" ${state.media.length > 0 ? '' : 'disabled'}>Generate AI caption</button><p class="muted">${escapeHtml(state.captionStatus || 'Photo captions use selected images; video captions use a thumbnail frame and the backend AI service.')}</p></section><section class="panel"><h2>Selected media</h2><div class="media-grid">${state.media.length === 0 ? '<p class="muted">No media selected yet. Upload today’s photos or a video.</p>' : state.media.map((pick) => `<article class="media-card">${pick.kind === 'video' ? `<video src="${pick.url}" controls></video>` : `<img src="${pick.url}" alt="${pick.name}" />`}<h3>${pick.name}</h3><p>Score ${pick.score}/100 • ${pick.reason}</p></article>`).join('')}</div><div class="caption-box"><h3>Chinese caption</h3><p id="caption">${escapeHtml(caption)}</p><button id="copy-caption">➕ Copy caption</button></div></section></main>`);

  document.getElementById('tone').value = state.captionTone;
  document.getElementById('tone').addEventListener('change', (event) => {
    state.captionTone = event.target.value;
    state.generatedCaption = '';
    ctx.renderCurrent();
  });
  document.getElementById('media-input').addEventListener('change', (event) => handleFiles(ctx, event.target.files));
  document.getElementById('generate-caption').addEventListener('click', () => generateMediaCaption(ctx));
  document.getElementById('copy-caption').addEventListener('click', () => copyText(caption));
}
