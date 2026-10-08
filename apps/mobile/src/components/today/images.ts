// Bundled fallbacks for plans and adventures without their own photo
// (the web uses /backgrounds/parenting-*-default.png).
export const TODAY_IMAGES = {
  home: require('@/assets/images/today-home.jpg'),
  playground: require('@/assets/images/today-playground.jpg'),
} as const;

export function todayImageSource(image: string | undefined, imageKey: string) {
  if (image) return { uri: image };
  return TODAY_IMAGES[imageKey === 'home' ? 'home' : 'playground'];
}
