// AI consent — shared by the API (enforcement), the web app and the mobile app (consent screens).
//
// SproutCue's AI features send the photos and child details a parent picks to OpenAI, a
// third-party AI provider. Apple Guideline 5.1.2(i) requires telling people that and getting
// their explicit permission first, so every AI request is refused until the parent agrees.
//
// The grant is stored on public.profiles (ai_consent_at, ai_consent_version). When the text
// below changes in a way parents must agree to again, bump AI_CONSENT_VERSION: everyone is
// asked again on their next AI creation. The database only checks that consent exists
// (see 202610280001_ai_consent.sql); the version is checked by the API.

export const AI_CONSENT_VERSION = '2026-10-28';

/** Error code the API returns (HTTP 403) when an AI request arrives without consent. */
export const AI_CONSENT_REQUIRED = 'AI_CONSENT_REQUIRED';

/** The third-party AI provider named in the consent text and the Privacy Policy. */
export const AI_PROVIDER_NAME = 'OpenAI';

/**
 * @param {{ aiConsent?: { grantedAt?: string | null, version?: string | null } | null } | null | undefined} user
 * @returns {boolean} true when the parent agreed to the current version of the AI consent.
 */
export function hasAiConsent(user) {
  const consent = user?.aiConsent;
  return Boolean(consent?.grantedAt) && consent?.version === AI_CONSENT_VERSION;
}

/** True for an API error (ApiError or a parsed JSON body) that means "ask for AI consent". */
export function isAiConsentError(error) {
  return error?.code === AI_CONSENT_REQUIRED || error?.data?.code === AI_CONSENT_REQUIRED;
}

/** The consent record kept on the profile; `null` means no consent. */
export function normalizeAiConsent(grantedAt, version) {
  return grantedAt ? { grantedAt: String(grantedAt), version: String(version || '') } : null;
}

const COPY = {
  en: {
    eyebrow: 'Play Studio · AI features',
    title: 'Allow SproutCue to use AI for your creations?',
    intro: `Picture books, practice stories, toy play ideas, and playground stories are made with ${AI_PROVIDER_NAME}, a third-party AI service. When you ask for one, we send ${AI_PROVIDER_NAME} only what that creation needs:`,
    sends: [
      'The photos you choose for it (your child or a toy). Photos for picture books and stories are first checked to make sure they show one young child.',
      'Your child’s name or nickname, age, and the goals, interests, and story choices you pick.',
    ],
    neverSends: 'We never send your location, chat messages, or email address.',
    provider: `${AI_PROVIDER_NAME} does not use this data to train its models. It may keep it for up to 30 days to check for abuse, then deletes it.`,
    control: 'You can turn this off anytime in your account settings. Turning it off stops new AI creations; what you have already made stays until you delete it.',
    allow: 'Allow AI features',
    decline: 'Not now',
    privacyLink: 'Privacy Policy',
    declined: 'AI features stay off. You can allow them the next time you start a creation.',
    statusOn: (date) => `AI features are on${date ? ` (allowed ${date})` : ''}. Your photos and child details are sent to ${AI_PROVIDER_NAME} only when you make a creation.`,
    statusOff: `AI features are off. Nothing is sent to ${AI_PROVIDER_NAME}.`,
    turnOff: 'Turn off AI features',
    turnOffConfirm: 'Turn off AI features? New picture books, stories, and play ideas will stop, and any creation still waiting to start is cancelled. Your saved creations stay.',
    revoked: 'AI features are off.',
    settingsTitle: 'AI features',
  },
  'zh-CN': {
    eyebrow: 'Play Studio · AI 功能',
    title: '允许 SproutCue 使用 AI 为你生成内容吗？',
    intro: `绘本、练习故事、玩具玩法和游乐场故事由第三方 AI 服务 ${AI_PROVIDER_NAME} 生成。每次生成时，我们只会把这次创作需要的内容发送给 ${AI_PROVIDER_NAME}：`,
    sends: [
      '你为这次创作选择的照片（孩子或玩具）。绘本和故事的照片会先检查，确认照片里是一个小朋友。',
      '孩子的名字或昵称、年龄，以及你选择的目标、兴趣和故事选项。',
    ],
    neverSends: '我们绝不会发送你的位置、聊天消息或电子邮箱。',
    provider: `${AI_PROVIDER_NAME} 不会用这些数据训练模型，最多保留 30 天用于滥用检查，之后删除。`,
    control: '你可以随时在账户设置中关闭。关闭后不能再生成新内容；已经生成的内容会保留，直到你删除。',
    allow: '允许 AI 功能',
    decline: '暂不',
    privacyLink: '隐私政策',
    declined: 'AI 功能保持关闭。下次开始创作时可以再允许。',
    statusOn: (date) => `AI 功能已开启${date ? `（${date} 允许）` : ''}。只有在你生成内容时，照片和孩子信息才会发送给 ${AI_PROVIDER_NAME}。`,
    statusOff: `AI 功能已关闭，不会向 ${AI_PROVIDER_NAME} 发送任何内容。`,
    turnOff: '关闭 AI 功能',
    turnOffConfirm: '关闭 AI 功能？将无法生成新的绘本、故事和玩法，尚未开始的生成会被取消。已保存的内容会保留。',
    revoked: 'AI 功能已关闭。',
    settingsTitle: 'AI 功能',
  },
};

/** Consent screen text; `language` is 'en' (default) or 'zh-CN'. */
export function aiConsentCopy(language = 'en') {
  return COPY[language === 'zh-CN' ? 'zh-CN' : 'en'];
}
