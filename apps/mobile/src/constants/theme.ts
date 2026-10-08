import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

// SproutCue design tokens for React Native.
// Source of truth: apps/web/src/styles.css (:root custom properties and component styles).

export const Colors = {
  // Core
  ink: '#34281f', // --color-ink
  muted: '#75685e', // --color-muted
  faint: '#9a8b80',
  brand: '#e86f3d', // --color-brand
  brandStrong: '#c84f23', // --color-brand-strong
  brandSoft: '#fff0e5', // --color-brand-soft
  brandBorder: '#e8c9b4', // inputs, secondary buttons
  sun: '#f5b942', // --color-sun
  sunSoft: '#fff3df',
  sunInk: '#8a5a13',
  // Surfaces
  paper: '#fffaf4', // --color-paper (app background)
  surface: '#ffffff', // --color-surface
  surfaceSoft: '#fff6ed', // --color-surface-soft
  line: '#edd9ca', // --color-line
  chipBorder: '#edcfb8',
  chipInk: '#5f4a3d',
  // Greens
  success: '#387158', // --color-success
  greenSoft: '#eaf1da',
  greenInk: '#49603a',
  sprout: '#1f4a36', // brand wordmark
  navInk: '#5c6b60',
  // Welcome flow (web .welcome-*)
  brandDeep: '#a94825', // welcome wordmark
  capsLabel: '#8c988f', // uppercase field labels
  lede: '#5c6b60',
  inputBorder: '#e7e0d2',
  progressLine: '#efd9c8',
  previewPanel: '#fff4ea',
  noticeBg: '#fff1e6',
  noticeBorder: '#efd0ba',
  familyCardFrom: '#b85029',
  familyCardTo: '#e57743',
  familyCardKid: '#f6b73c',
  familyCardKidInk: '#7a5410',
  familyCardParent: '#e2643b',
  dayActive: '#ffd2ad',
  dayActiveInk: '#6c2e18',
  status: '#e2643b',
  // Family tab (web .family-*, .profile-playdate)
  childCardFrom: '#fff7ee',
  childCardMid: '#fffdf9',
  childCardTo: '#f8efe4',
  orb: '#f5b97d',
  groupLabel: '#8c4c2f',
  rowBg: '#fffaf5',
  rowBorder: '#f0dfd1',
  rowBorderPressed: '#e7c3a8',
  pinBg: '#e4efe6',
  pinInk: '#2f6b4e',
  rowTitle: '#243d44',
  rowMeta: '#6d7b80',
  rowNote: '#5d7469',
  assetTile: '#f7e8d8',
  assetInk: '#a34d2b',
  storyTile: '#eceaf7',
  storyInk: '#675d9b',
  storyAccent: '#625990',
  toyTile: '#eaf1da',
  toyInk: '#587145',
  countBg: '#fff0e4',
  countInk: '#9f4524',
  safetyBg: '#f8f1e8',
  safetyBorder: '#d98a4e',
  variationsBg: '#fff7eb',
  tipsBg: '#fff7ed',
  // Today tab (web .today-*)
  intentActiveBg: '#fff7ef',
  intentActiveBorder: '#e9aa7d',
  plansFrom: '#fff8ed',
  plansTo: '#fffdf9',
  locationPillBorder: '#f0c9ad',
  weatherBg: '#fffdf8',
  storyGreenBg: '#e8f0df',
  storyGreenInk: '#4f6943',
  sceneBg: '#faf8f4',
  sceneText: '#52615a',
  sceneCue: '#7b6c60',
  quoteBg: '#fff4e7',
  featureBase: '#6b3e2d',
  // Discover tab (web .discover-*)
  locationFrom: '#fff1e3',
  locationTo: '#fff9f2',
  locationBorder: '#edcdb6',
  viewSwitchBg: '#f3e8de',
  mapBg: '#e9ede2',
  mapWater: '#c8dfe2',
  mapRoad: '#fffdf7',
  pinPlaydate: '#fff1dd',
  pinEvent: '#fff0ea',
  pinStory: '#f1e9fb',
  resultPlace: '#97877b',
  contextBg: '#fff6e4',
  contextBorder: '#efd59e',
  contextInk: '#79551e',
  factDivider: '#eee3d9',
  heroBg: '#ead9ca',
  selectionHint: '#9a897b',
  // Playdate invitation (web .shared-playdate-*, .playdate-update-banner)
  inviteBg: '#fffdf8',
  inviteBorder: '#e8dfcf',
  inviteKicker: '#4d7960',
  inviteLive: '#4b9b6c',
  inviteLiveHalo: '#e5f3e8',
  inviteTitle: '#203e3a',
  inviteDivider: '#eadfcd',
  inviteDateTile: '#fae8b7',
  inviteDateInk: '#ae7620',
  inviteStrong: '#2b4641',
  inviteMeta: '#718078',
  invitePin: '#e06c3d',
  inviteNoteBg: '#f6f4ec',
  inviteNoteInk: '#5e7068',
  inviteConfirm: '#34734f',
  invitePrivacy: '#8a978f',
  planBg: '#e1efe2',
  planBorder: '#c9dfcc',
  planArt: '#f7dba0',
  planTitle: '#24483d',
  planStat: '#2a6045',
  planStatLabel: '#6c8274',
  updateBg: '#fff7e2',
  updateBorder: 'rgba(198, 137, 56, 0.45)',
  updateTitle: '#8a5a16',
  updateInk: '#654b2b',
  // States
  danger: '#b3261e',
  dangerWeb: '#b94b27',
  dangerBorder: '#f1bba5',
  dangerSoft: '#fdecea',
  overlay: 'rgba(63, 38, 23, 0.48)',
} as const;

// Avatar backgrounds, matching the chat redesign palette.
export const AvatarColors = ['#e86f3d', '#62b486', '#f5b942', '#8d7bd1', '#4fa3c7'] as const;

export const Radius = {
  xs: 8,
  sm: 12,
  control: 14, // --radius-control
  md: 18,
  card: 22, // --radius-card
  xl: 28,
  pill: 999,
} as const;

// 4px base scale; web uses 8px multiples with 16–24px page gutters.
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 48,
  nine: 64,
} as const;

export const Layout = {
  gutter: 20,
  maxContentWidth: 720,
  minTouch: 44,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)' },
  default: { sans: 'normal', rounded: 'normal' },
});

// Type scale mirrored from the web: eyebrow, display titles, body, small labels.
export const Type = {
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: Colors.brandStrong },
  display: { fontSize: 36, fontWeight: '800', letterSpacing: -1.2, lineHeight: 38, color: Colors.ink },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 30, color: Colors.ink },
  heading: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2, color: Colors.ink },
  body: { fontSize: 16, lineHeight: 23, color: Colors.ink },
  bodyMuted: { fontSize: 15, lineHeight: 21, color: Colors.muted },
  label: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  small: { fontSize: 13, lineHeight: 18, color: Colors.muted },
  tiny: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#8c4c2f' },
  caps: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: '#8c988f' },
} satisfies Record<string, TextStyle>;

const shadow = (opacity: number, radius: number, y: number, elevation: number) =>
  Platform.select({
    web: { boxShadow: `0 ${y}px ${radius * 2}px rgba(101, 61, 29, ${opacity})` },
    default: {
      shadowColor: '#653d1d',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: y },
      elevation,
    },
  });

export const Shadow = {
  card: shadow(0.08, 15, 10, 2), // --shadow-card
  float: shadow(0.18, 24, 18, 8), // --shadow-float
  button: shadow(0.2, 9, 7, 3), // primary button glow
};

// Back-compat for screens written in phase 1.
export const MaxContentWidth = Layout.maxContentWidth;
