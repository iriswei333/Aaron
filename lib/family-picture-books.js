import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { createFamilyPhoto, readFamilyPhoto } from './family-photos.js';

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'picture-books.json');
const BUCKET = 'family-assets';
const DEFAULT_TEMPLATE_SLUG = 'career-recognition-v1';
const KINDERGARTEN_TEMPLATE_SLUG = 'kindergarten-transition-zh-v1';
const KINDERGARTEN_GIRL_TEMPLATE_SLUG = 'kindergarten-transition-zh-v2';
const EMOTIONS_TEMPLATE_SLUG = 'emotion-recognition-zh-v1';
const COLORS_TEMPLATE_SLUG = 'color-recognition-zh-v1';
const BODY_TEMPLATE_SLUG = 'body-recognition-zh-v1';
const TRANSPORT_TEMPLATE_SLUG = 'transport-recognition-zh-v1';
const FAMILY_LOVE_TEMPLATE_SLUG = 'family-love-zh-v1';
const MOON_IMAGINATION_TEMPLATE_SLUG = 'moon-imagination-zh-v1';
const SQUARES_TEMPLATE_SLUG = 'square-recognition-zh-v1';
const FAMILY_LOVE_BOY_TEMPLATE_SLUG = 'family-love-zh-v2';
const MOON_IMAGINATION_BOY_TEMPLATE_SLUG = 'moon-imagination-zh-v2';
const SQUARES_BOY_TEMPLATE_SLUG = 'square-recognition-zh-v2';
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const CAREER_FALLBACK_PAGES = [
  ['cover', 0, 'cover', null, '我的第一本职业认知书', 'My First Jobs', '中英双语•0-3岁宝宝职业启蒙', 'A Bilingual Book of Jobs for Babies', { layout: 'four-career cover', ageBadge: '0-3岁适用' }],
  ['doctor', 1, 'career', 'doctor', '医生', 'Doctor', '医生帮助我们保持健康。', 'Doctors help us stay healthy.', { angle: 'full face', expression: 'gentle closed-lip smile', scene: 'white doctor coat, aqua clothing, toy stethoscope examining teddy bear, toy medical kit' }],
  ['firefighter', 2, 'career', 'firefighter', '消防员', 'Firefighter', '消防员灭火，保护我们。', 'Firefighters put out fires and keep us safe.', { angle: 'three-quarter left', expression: 'natural open-mouth laugh', scene: 'coral firefighter costume, toy hose, toy fire truck' }],
  ['police-officer', 3, 'career', 'police-officer', '警察', 'Police Officer', '警察保护我们的安全。', 'Police officers keep us safe.', { angle: 'looking down, slight right turn', expression: 'focused neutral closed mouth', scene: 'soft navy uniform, toy walkie-talkie, toy police car, no weapons' }],
  ['astronaut', 4, 'career', 'astronaut', '宇航员', 'Astronaut', '宇航员探索太空。', 'Astronauts explore space.', { angle: 'three-quarter right, slightly up', expression: 'quiet wonder, small relaxed O mouth', scene: 'ivory astronaut suit, toy rocket, helmet beside child' }],
  ['chef', 5, 'career', 'chef', '厨师', 'Chef', '厨师制作美味的食物。', 'Chefs make delicious food.', { angle: 'looking down, slight left turn', expression: 'contented asymmetric closed-lip smile', scene: 'cream chef coat, apricot apron, soft chef hat, mixing bowl' }],
  ['teacher', 6, 'career', 'teacher', '老师', 'Teacher', '老师帮助我们学习。', 'Teachers help us learn.', { angle: 'full face with gentle tilt', expression: 'encouraging mid-speech expression', scene: 'sky-blue cardigan, animal picture book, small book stack' }],
  ['pilot', 7, 'career', 'pilot', '飞行员', 'Pilot', '飞行员驾驶飞机。', 'Pilots fly airplanes.', { angle: 'three-quarter right', expression: 'playful wink and closed-lip grin', scene: 'navy pilot jacket, comfortable cap, toy airplane' }],
  ['scientist', 8, 'career', 'scientist', '科学家', 'Scientist', '科学家探索世界。', 'Scientists explore the world.', { angle: 'looking down, three-quarter left', expression: 'curious slight brow furrow', scene: 'white lab coat, toy magnifying glass, leaf, no chemicals' }],
  ['race-car-driver', 9, 'career', 'race-car-driver', '赛车手', 'Race Car Driver', '赛车手驾驶赛车。', 'Race car drivers drive race cars.', { angle: 'full face, chin slightly raised', expression: 'proud tooth-showing grin', scene: 'cream racing suit, toy trophy, toy race car' }],
].map(([pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec]) => ({
  id: `fallback-${pageKey}`, pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec,
}));

const KINDERGARTEN_FALLBACK_PAGES = [
  ['cover', 0, 'cover', null, '我要上幼儿园啦！', 'Going to Kindergarten!', '和小象一起，开启新的一天。', 'A new day begins with a little elephant friend.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'at the warm Elephant Kindergarten gate, child with a light-blue backpack faces the school and turns back to invite the reader', expression: 'bright, reassured smile', angle: 'three-quarter back with face turned toward camera' }],
  ['morning-ready', 1, 'story', 'morning-ready', '今天有点不一样', 'A Different Morning', '今天，我要去幼儿园啦。', 'Today, I am going to kindergarten.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a warm morning bedroom, getting dressed beside a small backpack and shoes, a parent hand gently adjusts the child’s collar', expression: 'curious and calm', angle: 'three-quarter right' }],
  ['courage-sticker', 2, 'story', 'courage-sticker', '小象勇气贴纸', 'My Little Elephant Sticker', '紧张的时候，摸摸它，就像家人在身边。', 'When I feel wobbly, I can touch it and feel my family near.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a parent hand places a small elephant courage sticker on the backpack shoulder strap', expression: 'watching with a hopeful small smile', angle: 'looking down, three-quarter left' }],
  ['walk-to-school', 3, 'story', 'walk-to-school', '我们去幼儿园', 'Off We Go', '我背好小书包，出发啦。', 'My little backpack is on. Off I go.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'walking toward kindergarten in soft morning light, holding an adult hand shown only from the shoulder down', expression: 'excited open-mouth smile', angle: 'full face, walking toward camera' }],
  ['school-gate', 4, 'story', 'school-gate', '小象幼儿园', 'Elephant Kindergarten', '门口的小象在欢迎我。', 'The little elephant welcomes me.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'at a nature-inspired kindergarten entrance with wood, green hills, rainbow decoration and a friendly elephant mascot', expression: 'wide-eyed wonder', angle: 'looking slightly upward, three-quarter right' }],
  ['goodbye-hug', 5, 'story', 'goodbye-hug', '抱一抱，再见', 'A Hug, Then Goodbye', '妈妈爸爸会回来接我。', 'My family will come back for me.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a safe goodbye hug with an adult crouched from behind, no adult face visible', expression: 'a tiny tearful but brave smile', angle: 'profile, resting against the hug' }],
  ['new-classroom', 6, 'story', 'new-classroom', '新的教室', 'A New Classroom', '这里有书，有植物，还有好多玩具。', 'There are books, plants, and so many toys.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'exploring a sunny classroom with low wooden shelves, plants, books and an elephant cushion', expression: 'quietly interested', angle: 'three-quarter back, head turned left' }],
  ['meet-teacher', 7, 'story', 'meet-teacher', '老师你好', 'Hello, Teacher', '老师笑着和我打招呼。', 'My teacher smiles and says hello.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a teacher kneels nearby with open hands at child height; teacher is softly rendered and secondary', expression: 'shy closed-lip smile', angle: 'full face with lowered chin' }],
  ['elephant-friend', 8, 'story', 'elephant-friend', '小象朋友', 'My Elephant Friend', '小象说：我们一起玩吧！', 'My elephant friend says, Let’s play.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'meeting a round plush elephant toy in a cozy reading corner', expression: 'delighted giggle', angle: 'looking down at the toy, three-quarter right' }],
  ['morning-circle', 9, 'story', 'morning-circle', '早安圈圈时间', 'Morning Circle', '我们一起唱歌，听故事。', 'We sing and listen to a story together.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'sitting in a small story circle with classmates softly in the background', expression: 'listening with an open, relaxed mouth', angle: 'left profile' }],
  ['building-blocks', 10, 'story', 'building-blocks', '搭一座高高的塔', 'Building a Tall Tower', '我和朋友一起搭积木。', 'My friend and I build with blocks.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'building a colorful wooden block tower with one toddler friend', expression: 'concentrating with tongue slightly out', angle: 'looking down, full face' }],
  ['snack-time', 11, 'story', 'snack-time', '点心时间', 'Snack Time', '小手洗干净，点心真香。', 'Clean hands, and a yummy snack.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'having a simple fruit snack at a child-size table with an elephant placemat', expression: 'pleased little chew', angle: 'three-quarter left' }],
  ['wash-hands', 12, 'story', 'wash-hands', '泡泡洗小手', 'Bubbly Clean Hands', '搓一搓，冲一冲，小手干净啦。', 'Rub, rinse, and my hands are clean.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'washing hands at a low sink with gentle soap bubbles and elephant tile detail', expression: 'surprised happy O mouth', angle: 'looking down from three-quarter right' }],
  ['outdoor-play', 13, 'story', 'outdoor-play', '户外游戏', 'Outdoor Play', '风吹过来，我跑呀跑。', 'The breeze comes by, and I run and run.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'running in a safe kindergarten garden with soft grass, rainbow and elephant play sculpture', expression: 'joyful laugh', angle: 'three-quarter forward motion' }],
  ['missing-home', 14, 'story', 'missing-home', '想家了怎么办', 'When I Miss Home', '我摸摸小象贴纸，深呼吸。', 'I touch my elephant sticker and take a deep breath.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a quiet moment by a sunny classroom window, hand touching the elephant sticker on the backpack', expression: 'thoughtful, settling after a small frown', angle: 'side profile looking down' }],
  ['friend-shares', 15, 'story', 'friend-shares', '朋友一起玩', 'Friends Play Together', '朋友把玩具分给我。', 'A friend shares a toy with me.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a classmate offers a toy elephant; other child remains secondary and unidentifiable', expression: 'surprised grateful smile', angle: 'three-quarter left, reaching forward' }],
  ['art-time', 16, 'story', 'art-time', '画一只小象', 'Painting an Elephant', '我画了一只大耳朵小象。', 'I paint an elephant with big ears.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'making a watercolor elephant painting at an art table, sleeves gently rolled up', expression: 'proud focused smile', angle: 'looking down, three-quarter right' }],
  ['pickup-smile', 17, 'story', 'pickup-smile', '家人来接我啦', 'My Family Is Here', '我跑过去，给家人一个大大的拥抱。', 'I run over for a great big hug.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'at pick-up time near the gate, running toward an adult shown from behind only', expression: 'beaming toothy smile', angle: 'full face, running toward camera' }],
  ['blessing', 18, 'story', 'blessing', '明天也会很勇敢', 'Brave Again Tomorrow', '幼儿园里，有新的朋友和新的快乐。', 'At kindergarten, new friends and joys are waiting.', { templateKind: 'kindergarten-transition', maleMainCharacter: true, imageSize: '2048x1024', scene: 'a peaceful warm sunset outside Elephant Kindergarten with backpack and elephant sticker visible', expression: 'confident relaxed smile', angle: 'three-quarter back, looking over shoulder' }],
].map(([pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec]) => ({
  id: `fallback-kindergarten-${pageKey}`, pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec,
}));

const KINDERGARTEN_GIRL_FALLBACK_PAGES = KINDERGARTEN_FALLBACK_PAGES.map((page) => ({
  ...page,
  id: `fallback-kindergarten-girl-${page.pageKey}`,
  titleZh: page.pageKey === 'cover' ? '我要上幼儿园啦！' : page.titleZh,
  titleEn: page.pageKey === 'cover' ? 'Going to Kindergarten!' : page.titleEn,
  generationSpec: {
    ...page.generationSpec,
    templateVariant: 'female-main-character',
    maleMainCharacter: false,
    femaleMainCharacter: true,
    palette: 'peach, lilac, butter yellow, sage and soft sky blue',
    backpack: 'a light-lilac backpack with the elephant courage sticker',
  },
}));

const RECOGNITION_ANGLES = [
  'full face', 'three-quarter left', 'looking down', 'three-quarter right', 'left profile',
  'full face with gentle tilt', 'looking slightly upward', 'right profile', 'three-quarter left', 'full face',
];

function recognitionPages({ key, titleZh, titleEn, subtitleZh, subtitleEn, theme, coverScene, entries, character = {} }) {
  return [
    { pageKey: 'cover', pageOrder: 0, pageType: 'cover', careerKey: null, titleZh, titleEn, bodyZh: subtitleZh, bodyEn: subtitleEn, generationSpec: { templateKind: 'recognition', recognitionTheme: theme, scene: coverScene, imageSize: '1024x1024', cover: true, ...character } },
    ...entries.map(([pageKey, itemZh, itemEn, scene, expression], index) => ({
      pageKey, pageOrder: index + 1, pageType: 'story', careerKey: pageKey, titleZh: itemZh, titleEn: itemEn,
      bodyZh: `这是${itemZh}。`, bodyEn: `This is ${itemEn.toLowerCase()}.`,
      generationSpec: { templateKind: 'recognition', recognitionTheme: theme, scene, expression, angle: RECOGNITION_ANGLES[index], imageSize: '1024x1024', ...character },
    })),
  ].map((page) => ({ id: `fallback-${key}-${page.pageKey}`, ...page }));
}

const EMOTIONS_FALLBACK_PAGES = recognitionPages({
  key: 'emotions', titleZh: '我的情绪小书', titleEn: 'My Little Feelings Book', subtitleZh: '认识每一种心情。', subtitleEn: 'Every feeling is welcome.', theme: 'emotions', coverScene: 'a warm collage of the same child showing several natural emotions with pastel hearts and clouds',
  entries: [
    ['happy', '开心', 'Happy', 'smiling while holding a bright sun toy', 'natural open-mouth laugh'], ['sad', '伤心', 'Sad', 'hugging a soft teddy beside a small rain cloud illustration', 'gentle downturned mouth with watery eyes, not distressed'], ['angry', '生气', 'Angry', 'stomping near a red cushion with a safe dragon-breath doodle', 'small determined frown'], ['scared', '害怕', 'Scared', 'holding a parent hand beside a friendly shadow puppet', 'wide eyes and small O mouth'], ['surprised', '惊讶', 'Surprised', 'opening a gift box with paper stars', 'wide-eyed delighted gasp'], ['shy', '害羞', 'Shy', 'peeking around a large picture book', 'bashful closed-lip smile'], ['proud', '自豪', 'Proud', 'holding a simple block tower', 'proud chin-up grin'], ['worried', '担心', 'Worried', 'touching an elephant courage sticker while a parent hand is nearby', 'thoughtful slight brow furrow'], ['calm', '平静', 'Calm', 'taking a soft breathing moment with a cloud pillow', 'relaxed closed-lip smile'], ['excited', '兴奋', 'Excited', 'jumping beside colorful streamers', 'big sparkling smile'],
  ],
});

const COLORS_FALLBACK_PAGES = recognitionPages({
  key: 'colors', titleZh: '我的颜色小书', titleEn: 'My Little Colors Book', subtitleZh: '一起发现缤纷的颜色。', subtitleEn: 'Let’s discover colorful things.', theme: 'colors', coverScene: 'the child surrounded by a gentle rainbow of simple, real toddler-safe objects',
  entries: [
    ['red', '红色', 'Red', 'holding a red apple and a red toy block', 'pleased smile'], ['orange', '橙色', 'Orange', 'holding an orange and an orange toy ball', 'curious look'], ['yellow', '黄色', 'Yellow', 'holding a yellow rubber duck and a yellow sun card', 'bright smile'], ['green', '绿色', 'Green', 'examining a green leaf and a green toy dinosaur', 'quiet wonder'], ['blue', '蓝色', 'Blue', 'stacking blue blocks beside a blue toy boat', 'focused smile'], ['purple', '紫色', 'Purple', 'holding a purple flower and a purple crayon', 'soft delighted smile'], ['pink', '粉色', 'Pink', 'holding a pink flower and pink balloon', 'happy giggle'], ['brown', '棕色', 'Brown', 'hugging a brown teddy bear', 'cozy closed-lip smile'], ['black', '黑色', 'Black', 'rolling a black toy car on a white mat', 'concentrating expression'], ['white', '白色', 'White', 'holding a white cloud plush against a pale sky doodle', 'peaceful smile'],
  ],
});

const BODY_FALLBACK_PAGES = recognitionPages({
  key: 'body', titleZh: '我的身体小书', titleEn: 'My Little Body Book', subtitleZh: '认识我可爱的身体。', subtitleEn: 'Let’s learn about my wonderful body.', theme: 'body-parts', coverScene: 'the child pointing to a playful body-outline illustration with friendly labels omitted',
  entries: [
    ['eyes', '眼睛', 'Eyes', 'pointing to their eyes with a small mirror nearby', 'wide awake smile'], ['ears', '耳朵', 'Ears', 'cupping ears to listen to a tiny bell', 'listening expression'], ['nose', '鼻子', 'Nose', 'smelling a safe flower', 'curious sniff'], ['mouth', '嘴巴', 'Mouth', 'making a gentle kiss face beside a bubble wand', 'playful kiss face'], ['hands', '小手', 'Hands', 'waving both hands beside paint handprints', 'friendly wave'], ['feet', '小脚', 'Feet', 'standing on colorful footprint stickers', 'proud smile'], ['tummy', '肚子', 'Tummy', 'patting tummy after a pretend snack', 'contented smile'], ['hair', '头发', 'Hair', 'brushing hair with a toddler brush', 'calm focused look'], ['knees', '膝盖', 'Knees', 'bending knees during a simple dance pose', 'happy bounce'], ['teeth', '牙齿', 'Teeth', 'brushing teeth with a child-safe brush', 'big toothy grin'],
  ],
});

const TRANSPORT_FALLBACK_PAGES = recognitionPages({
  key: 'transport', titleZh: '我的交通工具小书', titleEn: 'My Little Vehicles Book', subtitleZh: '一起认识会移动的朋友。', subtitleEn: 'Let’s meet things that move.', theme: 'transportation', coverScene: 'the child with a safe, playful collection of toy vehicles on a white studio floor',
  entries: [
    ['car', '汽车', 'Car', 'pushing a red toy car on a road mat', 'excited smile'], ['bus', '公交车', 'Bus', 'holding a yellow toy bus beside a simple bus-stop doodle', 'curious look'], ['train', '火车', 'Train', 'guiding a wooden train on tracks', 'focused joy'], ['airplane', '飞机', 'Airplane', 'lifting a toy airplane toward cloud doodles', 'looking up with wonder'], ['ship', '轮船', 'Ship', 'floating a toy ship in a shallow pretend-water tray', 'quiet delighted smile'], ['bicycle', '自行车', 'Bicycle', 'wearing a helmet beside a small balance bike', 'proud grin'], ['fire-truck', '消防车', 'Fire Truck', 'holding a toy fire truck with a soft water-spray doodle', 'engaged open-mouth smile'], ['excavator', '挖掘机', 'Excavator', 'scooping kinetic sand with a toy excavator', 'serious concentration'], ['ambulance', '救护车', 'Ambulance', 'driving a toy ambulance toward a teddy bear', 'kind caring smile'], ['rocket', '火箭', 'Rocket', 'placing a toy rocket on a launch pad with star doodles', 'amazed small O mouth'],
  ],
});

function gentleStoryPages({ key, titleZh, titleEn, subtitleZh, subtitleEn, theme, coverScene, entries, character = { femaleMainCharacter: true } }) {
  return [
    { pageKey: 'cover', pageOrder: 0, pageType: 'cover', careerKey: null, titleZh, titleEn, bodyZh: subtitleZh, bodyEn: subtitleEn, generationSpec: { templateKind: 'gentle-story', storyTheme: theme, scene: coverScene, imageSize: '2048x1024', cover: true, ...character } },
    ...entries.map(([pageKey, pageTitleZh, pageTitleEn, bodyZh, bodyEn, scene, expression, angle], index) => ({
      pageKey, pageOrder: index + 1, pageType: 'story', careerKey: pageKey, titleZh: pageTitleZh, titleEn: pageTitleEn, bodyZh, bodyEn,
      generationSpec: { templateKind: 'gentle-story', storyTheme: theme, scene, expression, angle, imageSize: '2048x1024', ...character },
    })),
  ].map((page) => ({ id: `fallback-${key}-${page.pageKey}`, ...page }));
}

const FAMILY_LOVE_FALLBACK_PAGES = gentleStoryPages({
  key: 'family-love', titleZh: '我们的爱抱抱', titleEn: 'Our Love Hugs', subtitleZh: '爱在每一天的小动作里。', subtitleEn: 'Love lives in little everyday moments.', theme: 'family-love', coverScene: 'a little girl and a mother figure from behind share a gentle hug in a warm sunlit home',
  entries: [
    ['morning-hug', '早安抱抱', 'Morning Hug', '早上醒来，我先抱抱妈妈。', 'When I wake up, we share a hug.', 'a cozy bedroom morning hug, adult shown only from behind', 'sleepy happy smile', 'three-quarter right'],
    ['hold-hands', '牵牵手', 'Holding Hands', '小手牵着大手，走呀走。', 'My small hand holds a big hand as we walk.', 'walking outside while holding an adult hand shown from the shoulder down', 'bright smile', 'full face'],
    ['little-kiss', '亲亲脸颊', 'A Little Kiss', '轻轻亲一下，爱就飞出来。', 'A little kiss sends love flying.', 'giving a gentle kiss toward an adult cheek cropped softly out of frame', 'playful kiss face', 'left profile'],
    ['share-snack', '一起分享', 'Sharing Together', '我把好吃的分给妈妈。', 'I share something yummy with my mom.', 'sharing a fruit snack at a small table, adult hand accepting a piece', 'proud caring smile', 'looking down'],
    ['read-together', '一起读书', 'Reading Together', '故事书里，也有我们的爱。', 'Our love is in every story we read.', 'reading a picture book beside a parent shown as a soft shoulder silhouette', 'quiet interested smile', 'three-quarter left'],
    ['dance', '跳个小舞', 'A Little Dance', '音乐响起来，我们转圈圈。', 'Music plays, and we twirl around.', 'dancing with an adult whose face is out of frame', 'open-mouth laugh', 'three-quarter motion'],
    ['helping', '我来帮忙', 'I Can Help', '我也会帮忙收好玩具。', 'I can help put toys away.', 'placing blocks into a basket beside an adult hand', 'focused proud smile', 'looking down'],
    ['rainy-day', '雨天也温暖', 'Warm on a Rainy Day', '下雨了，伞下还是暖暖的。', 'Even on rainy days, we feel warm together.', 'under one umbrella, adult shown only from behind', 'cozy closed-lip smile', 'three-quarter right'],
    ['goodnight', '晚安亲亲', 'Goodnight Kiss', '晚安，妈妈，我爱你。', 'Goodnight, Mom. I love you.', 'tucked into bed with a parent hand smoothing the blanket', 'peaceful sleepy smile', 'full face with gentle tilt'],
    ['love-always', '爱一直都在', 'Love Is Always Here', '不管在哪里，爱一直都在。', 'Wherever we are, love is always here.', 'holding a heart-shaped family drawing in warm window light', 'confident calm smile', 'three-quarter left'],
  ],
});

const MOON_IMAGINATION_FALLBACK_PAGES = gentleStoryPages({
  key: 'moon-imagination', titleZh: '月亮的小秘密', titleEn: 'The Moon’s Little Secret', subtitleZh: '和月亮朋友一起想象。', subtitleEn: 'Let’s imagine with our moon friend.', theme: 'moon-imagination', coverScene: 'a little girl in gentle pajamas looks at a friendly glowing moon with soft animal friends in an original dreamlike night garden',
  entries: [
    ['moon-hello', '月亮你好', 'Hello, Moon', '月亮圆圆的，在天上眨眼睛。', 'The round moon twinkles in the sky.', 'waving to a moon above a quiet garden', 'wide-eyed wonder', 'looking upward'],
    ['what-taste', '月亮是什么味道', 'What Could the Moon Taste Like?', '月亮会不会甜甜的？', 'Could the moon taste sweet?', 'imagining moon-shaped fruit with a small rabbit friend', 'curious thoughtful smile', 'three-quarter right'],
    ['reach-high', '伸得高高', 'Reach Up High', '我踮起脚尖，想碰一碰月亮。', 'I stand on tiptoe and reach for the moon.', 'reaching upward safely on grass', 'determined grin', 'full face'],
    ['animal-friends', '朋友来帮忙', 'Friends Come Along', '小动物们也想一起看看。', 'Animal friends want to look too.', 'friendly original woodland animals gather beside the child', 'delighted giggle', 'three-quarter left'],
    ['moonlight-path', '月光小路', 'A Moonlit Path', '月光变成一条亮亮的小路。', 'Moonlight becomes a shining little path.', 'walking along a silver-blue path with animal friends', 'quiet awe', 'three-quarter back'],
    ['cloud-boat', '云朵小船', 'Cloud Boat', '我们坐上软软的云朵小船。', 'We ride a soft cloud boat in our imaginations.', 'sitting on a cloud boat above a dreamy garden', 'joyful laugh', 'three-quarter forward'],
    ['share-wish', '分享愿望', 'Sharing Wishes', '我把一个愿望送给月亮。', 'I send one wish to the moon.', 'holding a paper star toward the moon', 'hopeful small smile', 'left profile'],
    ['moon-glow', '月亮的光', 'Moon Glow', '月亮把温柔的光送给大家。', 'The moon shares gentle light with everyone.', 'moonlight softly illuminating child and toy animal friends', 'peaceful smile', 'full face'],
    ['home-again', '回到家里', 'Back Home', '月亮陪我走回温暖的家。', 'The moon walks me home in its gentle light.', 'walking home holding an adult hand from the shoulder down', 'sleepy contented smile', 'three-quarter right'],
    ['goodnight-moon', '晚安，月亮', 'Goodnight, Moon', '我闭上眼睛，月亮还在窗外。', 'I close my eyes, and the moon is still outside.', 'falling asleep with moonlight through the window', 'calm closed eyes smile', 'full face'],
  ],
});

const SQUARES_FALLBACK_PAGES = recognitionPages({
  key: 'squares', titleZh: '世界有很多正方形', titleEn: 'So Many Squares Around Us', subtitleZh: '一起在生活里找正方形。', subtitleEn: 'Let’s find squares in everyday life.', theme: 'squares', coverScene: 'a little girl surrounded by clear square-shaped toddler-safe objects and soft geometric line art', character: { femaleMainCharacter: true },
  entries: [
    ['square-window', '正方形窗户', 'Square Window', '窗户是正方形的。', 'The window is a square.', 'looking through a small square window frame', 'curious smile'], ['square-block', '正方形积木', 'Square Block', '积木是正方形的。', 'The block is a square.', 'stacking square wooden blocks', 'focused smile'], ['square-cracker', '正方形饼干', 'Square Cracker', '饼干是正方形的。', 'The cracker is a square.', 'holding a square cracker at snack time', 'pleased little chew'], ['square-photo', '正方形照片', 'Square Photo', '照片是正方形的。', 'The photo is a square.', 'holding a small square family drawing', 'warm smile'], ['square-puzzle', '正方形拼图', 'Square Puzzle', '拼图是正方形的。', 'The puzzle is a square.', 'fitting a square puzzle piece', 'concentrating look'], ['square-gift', '正方形礼物', 'Square Gift', '礼物盒是正方形的。', 'The gift box is a square.', 'opening a square gift box with paper stars', 'surprised happy O mouth'], ['square-tile', '正方形地砖', 'Square Tile', '地砖是正方形的。', 'The tile is a square.', 'standing on colorful square floor tiles', 'proud grin'], ['square-book', '正方形书本', 'Square Book', '书本是正方形的。', 'The book is a square.', 'reading a square board book', 'quiet interested smile'], ['square-cushion', '正方形靠垫', 'Square Cushion', '靠垫是正方形的。', 'The cushion is a square.', 'hugging a square cushion', 'cozy smile'], ['square-found', '我找到正方形啦', 'I Found a Square', '生活里有好多正方形。', 'There are squares all around us.', 'pointing joyfully at several square objects in a room', 'beaming smile'],
  ],
});

function boyVariantPages(pages, key) {
  return pages.map((page) => ({
    ...page,
    id: `fallback-${key}-${page.pageKey}`,
    generationSpec: {
      ...page.generationSpec,
      femaleMainCharacter: false,
      maleMainCharacter: true,
      templateVariant: 'male-main-character',
      scene: page.generationSpec.scene?.replaceAll('little girl', 'little boy'),
    },
  }));
}

const FAMILY_LOVE_BOY_FALLBACK_PAGES = boyVariantPages(FAMILY_LOVE_FALLBACK_PAGES, 'family-love-boy');
const MOON_IMAGINATION_BOY_FALLBACK_PAGES = boyVariantPages(MOON_IMAGINATION_FALLBACK_PAGES, 'moon-imagination-boy');
const SQUARES_BOY_FALLBACK_PAGES = boyVariantPages(SQUARES_FALLBACK_PAGES, 'squares-boy');

const FALLBACK_TEMPLATES = {
  [DEFAULT_TEMPLATE_SLUG]: { id: 'fallback-career-recognition-v1', slug: DEFAULT_TEMPLATE_SLUG, version: 1, name: 'My First Jobs', description: 'Bilingual career-recognition book for toddlers ages 0–3.', pages: CAREER_FALLBACK_PAGES },
  [KINDERGARTEN_TEMPLATE_SLUG]: { id: 'fallback-kindergarten-transition-zh-v1', slug: KINDERGARTEN_TEMPLATE_SLUG, version: 1, name: '我要上幼儿园啦！', description: 'A warm Mandarin-English story for a child’s kindergarten transition.', pages: KINDERGARTEN_FALLBACK_PAGES },
  [KINDERGARTEN_GIRL_TEMPLATE_SLUG]: { id: 'fallback-kindergarten-transition-zh-v2', slug: KINDERGARTEN_GIRL_TEMPLATE_SLUG, version: 2, name: '我要上幼儿园啦！·女孩版', description: 'A warm Mandarin-English kindergarten story with a girl as the main character.', pages: KINDERGARTEN_GIRL_FALLBACK_PAGES },
  [EMOTIONS_TEMPLATE_SLUG]: { id: 'fallback-emotion-recognition-zh-v1', slug: EMOTIONS_TEMPLATE_SLUG, version: 1, name: '我的情绪小书', description: 'A bilingual toddler book for recognizing feelings and beginning family conversations.', pages: EMOTIONS_FALLBACK_PAGES },
  [COLORS_TEMPLATE_SLUG]: { id: 'fallback-color-recognition-zh-v1', slug: COLORS_TEMPLATE_SLUG, version: 1, name: '我的颜色小书', description: 'A bilingual toddler book for discovering colors through everyday objects.', pages: COLORS_FALLBACK_PAGES },
  [BODY_TEMPLATE_SLUG]: { id: 'fallback-body-recognition-zh-v1', slug: BODY_TEMPLATE_SLUG, version: 1, name: '我的身体小书', description: 'A bilingual toddler book for learning body-part words through safe everyday actions.', pages: BODY_FALLBACK_PAGES },
  [TRANSPORT_TEMPLATE_SLUG]: { id: 'fallback-transport-recognition-zh-v1', slug: TRANSPORT_TEMPLATE_SLUG, version: 1, name: '我的交通工具小书', description: 'A bilingual toddler book for recognizing familiar vehicles.', pages: TRANSPORT_FALLBACK_PAGES },
  [FAMILY_LOVE_TEMPLATE_SLUG]: { id: 'fallback-family-love-zh-v1', slug: FAMILY_LOVE_TEMPLATE_SLUG, version: 1, name: '我们的爱抱抱', description: 'A warm Mandarin-English family-affection story with a girl as the main character.', pages: FAMILY_LOVE_FALLBACK_PAGES },
  [MOON_IMAGINATION_TEMPLATE_SLUG]: { id: 'fallback-moon-imagination-zh-v1', slug: MOON_IMAGINATION_TEMPLATE_SLUG, version: 1, name: '月亮的小秘密', description: 'An original Mandarin-English moon-imagination bedtime story with a girl as the main character.', pages: MOON_IMAGINATION_FALLBACK_PAGES },
  [SQUARES_TEMPLATE_SLUG]: { id: 'fallback-square-recognition-zh-v1', slug: SQUARES_TEMPLATE_SLUG, version: 1, name: '世界有很多正方形', description: 'A bilingual girl-led toddler book for finding squares in everyday life.', pages: SQUARES_FALLBACK_PAGES },
  [FAMILY_LOVE_BOY_TEMPLATE_SLUG]: { id: 'fallback-family-love-zh-v2', slug: FAMILY_LOVE_BOY_TEMPLATE_SLUG, version: 2, name: '我们的爱抱抱·男孩版', description: 'A warm Mandarin-English family-affection story with a boy as the main character.', pages: FAMILY_LOVE_BOY_FALLBACK_PAGES },
  [MOON_IMAGINATION_BOY_TEMPLATE_SLUG]: { id: 'fallback-moon-imagination-zh-v2', slug: MOON_IMAGINATION_BOY_TEMPLATE_SLUG, version: 2, name: '月亮的小秘密·男孩版', description: 'An original Mandarin-English moon-imagination bedtime story with a boy as the main character.', pages: MOON_IMAGINATION_BOY_FALLBACK_PAGES },
  [SQUARES_BOY_TEMPLATE_SLUG]: { id: 'fallback-square-recognition-zh-v2', slug: SQUARES_BOY_TEMPLATE_SLUG, version: 2, name: '世界有很多正方形·男孩版', description: 'A bilingual boy-led toddler book for finding squares in everyday life.', pages: SQUARES_BOY_FALLBACK_PAGES },
};

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
function extensionFor(mimeType) { return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'; }
function localBookDir(bookId) { return join(LOCAL_ROOT, bookId); }
function missing(message) { const error = new Error(message); error.code = 'NOT_FOUND'; return error; }

function mimeTypeFor(photo) {
  const declared = (photo.type || '').toLowerCase();
  if (IMAGE_TYPES.has(declared)) return declared;
  const name = (photo.name || '').toLowerCase();
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return declared;
}

async function readLocalState() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { books: [] }; throw error; }
}
async function saveLocalState(state) { await mkdir(LOCAL_ROOT, { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }

function validatePhotos(formData) {
  const photos = formData.getAll('photos').filter((item) => item && typeof item.arrayBuffer === 'function');
  if (photos.length > MAX_PHOTOS) throw new Error('Choose no more than 5 child reference photos.');
  for (const photo of photos) {
    if (!IMAGE_TYPES.has(mimeTypeFor(photo))) throw new Error('Photos must be JPEG, PNG, WebP, HEIC, or HEIF files.');
    if (photo.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 20 MB or smaller.');
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
    throw new Error('The combined reference photos must be 90 MB or smaller.');
  }
  return photos;
}

function savedPhotoIds(formData) {
  const values = formData.getAll('savedPhotoIds').flatMap((value) => {
    try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : [value]; }
    catch { return [value]; }
  });
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, MAX_PHOTOS);
}

async function normalizeReferencePhoto(photo) {
  const mimeType = mimeTypeFor(photo);
  const buffer = Buffer.from(await photo.arrayBuffer());
  if (!HEIC_TYPES.has(mimeType)) return { buffer, mimeType, byteSize: buffer.length };
  try {
    const converted = await sharp(buffer, { failOn: 'none', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    return { buffer: converted, mimeType: 'image/jpeg', byteSize: converted.length };
  } catch (error) {
    throw new Error('This HEIC photo could not be converted. Please choose a different iPhone photo or share it as JPEG.');
  }
}

function serialize(book) {
  return {
    id: book.id, title: book.title || 'My First Jobs', childId: book.childId || null, childName: book.childName || '',
    template: { slug: book.templateSlug, version: book.templateVersion || 1, name: book.templateName || book.title || '' }, status: book.status,
    generation: { model: book.model || null, quality: book.quality || null },
    createdAt: book.createdAt, updatedAt: book.updatedAt, sourcePhotoCount: book.sourcePhotos.length,
    pages: Object.fromEntries(book.pages.map((page) => [page.pageKey, {
      pageOrder: page.pageOrder, pageType: page.pageType, titleZh: page.titleZh || '', titleEn: page.titleEn || '', status: page.status, error: page.error || null,
      url: page.storagePath ? `/api/family-assets/picture-book-assets?bookAssetId=${encodeURIComponent(book.id)}&pageKey=${encodeURIComponent(page.pageKey)}` : null,
    }])),
  };
}

function identityRules() {
  return 'Use the uploaded photos only to preserve this same child’s stable identity: facial proportions, natural eye shape, nose width, cheeks, ears, lip shape at rest, warm skin tone, dark hairline and toddler age. Do not copy a source photo’s expression, gaze or camera angle. Generate the requested expression and pose with natural anatomy. Preserve skin texture, asymmetry, hair strands and toddler proportions. Avoid enlarged eyes, doll proportions, pasted-on faces, waxy skin, smoothing, watermarks and logos.';
}

function characterDirection(spec) {
  if (spec.maleMainCharacter) return 'The main child is a little boy. Preserve his actual hair texture, facial features and toddler proportions from the uploaded photos. Never add adult-like styling or a different identity.';
  if (spec.femaleMainCharacter) return 'The main child is a little girl. Preserve her actual hair texture, facial features and toddler proportions from the uploaded photos. Never add makeup, adult-like styling or a different identity.';
  return '';
}

function kindergartenPrompt(page) {
  const spec = page.generationSpec || {};
  const pageText = `Render exactly in the clean lower text area, Chinese above English: ${page.titleZh} / ${page.titleEn} / ${page.bodyZh} / ${page.bodyEn}.`;
  const character = characterDirection(spec);
  const variantDetails = spec.femaleMainCharacter ? `Use this gentle palette: ${spec.palette}. Show ${spec.backpack} when a backpack appears.` : '';
  return `Create one finished 2:1 horizontal bilingual toddler picture-book spread for a child starting kindergarten. ${identityRules()} ${character} ${variantDetails} Use an original, high-end hand-painted children’s-book illustration: warm opaque brushwork layered with transparent watercolor washes, subtle colored-pencil texture and natural watercolor-paper grain. It should feel soft, safe, imaginative, real and comforting for a three-year-old, while retaining the child's natural photographic identity and toddler proportions. Do not imitate or reproduce any existing book artwork. The left half holds a warm setting and narrative space; the right half centers the child’s action and emotion. Keep the bottom 22% calm and uncluttered for the bilingual text. Scene: ${spec.scene}. Required head angle: ${spec.angle}. Required expression: ${spec.expression}. Use a warm natural kindergarten with wood furniture, low shelves, plants, books, green hill decorations and soft daylight. Repeat a friendly round elephant motif as a gentle companion in an appropriate prop, sticker, toy or decoration. Adults, when needed, may only be shown from behind, as hands, shoulders, a blurred distant profile, or a crouching partial silhouette; never render a recognizable adult face. ${pageText} Use friendly hand-lettered typography, Chinese larger than English. No watermark, brand logo, extra copy or age sticker.`;
}

function recognitionPrompt(page) {
  const spec = page.generationSpec || {};
  const character = characterDirection(spec);
  if (spec.cover) {
    return `Create one finished 1:1 square bilingual toddler recognition-book cover. ${identityRules()} ${character} Theme: ${spec.recognitionTheme}. Pure white background with ample negative space, soft studio lighting, premium international children’s-publication photo-collage styling, delicate contact shadows and sparse pastel line-art accents. Scene: ${spec.scene || `the child surrounded by clear, toddler-safe ${spec.recognitionTheme} objects`}. Show the same child naturally interacting with several clear, toddler-safe themed props. Keep the child’s real identity and age-appropriate proportions. Center the title area in the upper third and render exactly: ${page.titleZh}; ${page.titleEn}; ${page.bodyZh}; ${page.bodyEn}. Use warm rounded typography, Chinese larger than English. No watermark, logo, extra writing or adult-like styling.`;
  }
  return `Create one finished 1:1 square bilingual toddler recognition-book page. ${identityRules()} ${character} Theme: ${spec.recognitionTheme}. Pure white background, premium children’s-publication photo-collage styling, soft studio lighting, ample negative space, realistic toddler-safe props, delicate contact shadows and a few faint pastel line-art accents. Scene: ${spec.scene || `the child safely learning about ${page.titleEn.toLowerCase()} with one clear themed prop`}. Required expression: ${spec.expression || 'natural curious expression'}. Required angle: ${spec.angle || 'three-quarter view'}. Keep the requested expression, gaze, head angle and body pose anatomically consistent. Place the child and props in the upper 66% of the page. In the lower third, render exactly four centered lines in clear rounded typography with Chinese larger than English: ${page.titleZh}; ${page.titleEn}; ${page.bodyZh}; ${page.bodyEn}. No watermark, logo, cover title or extra writing.`;
}

function gentleStoryPrompt(page) {
  const spec = page.generationSpec || {};
  const character = characterDirection(spec);
  const text = `Render exactly in the calm lower text area, Chinese above English: ${page.titleZh} / ${page.titleEn} / ${page.bodyZh} / ${page.bodyEn}.`;
  return `Create one finished 2:1 horizontal bilingual toddler picture-book spread. ${identityRules()} ${character} Theme: ${spec.storyTheme}. Use an original, premium hand-painted children’s-book illustration with warm opaque brushwork, transparent watercolor washes, fine colored-pencil texture and natural watercolor-paper grain. Do not imitate or reproduce an existing book, title, layout or artwork. The left half holds a soft environment and narrative space; the right half centers the child’s action and emotion. Scene: ${spec.scene || 'a warm child-safe story moment'}. Required expression: ${spec.expression || 'natural gentle smile'}. Required head angle: ${spec.angle || 'three-quarter view'}. Keep adult faces out of frame or shown only from behind, as hands, shoulders or soft silhouettes unless reference photos for them are supplied. Keep the bottom 22% uncluttered for the bilingual text. ${text} Use friendly hand-lettered typography with Chinese larger than English. No watermark, brand logo, extra copy or adult-like styling.`;
}

function pagePrompt(page) {
  if (page.generationSpec?.templateKind === 'kindergarten-transition') return kindergartenPrompt(page);
  if (page.generationSpec?.templateKind === 'recognition') return recognitionPrompt(page);
  if (page.generationSpec?.templateKind === 'gentle-story') return gentleStoryPrompt(page);
  if (page.pageType === 'cover') return `Create one finished 1:1 square front cover for My First Jobs. ${identityRules()} Pure white background, premium international children’s publishing photo-collage style, soft studio lighting and faint pastel outlined career illustrations. Show four full-body portraits of the same child: doctor, firefighter, police officer and astronaut. Each expression and angle must be different: doctor full-face gentle closed-lip smile; firefighter three-quarter left natural open-mouth laugh; police officer looking down at a toy radio with focused neutral mouth; astronaut three-quarter right looking slightly up with quiet wonder and a relaxed small O mouth. Toys by their feet: medical kit, fire truck, police car and rocket. Exact upper text: My First Jobs; 我的第一本职业认知书; A Bilingual Book of Jobs for Babies; 中英双语•0-3岁宝宝职业启蒙. Use rounded rainbow lettering for My First Jobs. Pink upper-right circular sticker: 0-3岁适用. Crisp Chinese and English typography; no other text.`;
  const spec = page.generationSpec || {};
  return `Create one finished 1:1 square bilingual toddler career picture-book page. ${identityRules()} Pure white background, ample negative space, soft studio lighting, realistic dress-up costume fabric, delicate contact shadows and sparse faint pastel career-themed line art. Required head angle: ${spec.angle}. Required expression and gaze: ${spec.expression}. Scene: ${spec.scene}. Keep head, neck, gaze and body pose anatomically consistent. Place child and props in the upper 68% of the page. In the lower third, place four centered, clean black rounded-sans-serif lines with no overlaps. Render exactly:\n${page.titleZh}\n${page.titleEn}\n${page.bodyZh}\n${page.bodyEn}\nNo cover title, age sticker, watermark, logo or extra writing.`;
}

async function getSupabaseTemplate(supabase, { slug = DEFAULT_TEMPLATE_SLUG, id } = {}) {
  let query = supabase.from('picture_book_templates').select('id, slug, name, version, description').eq('is_active', true);
  query = id ? query.eq('id', id) : query.eq('slug', slug);
  const { data: template, error: templateError } = await query.single();
  if (templateError || !template) throw new Error('The requested picture-book template is unavailable. Apply the picture-book database migration.');
  const { data: pages, error: pageError } = await supabase.from('picture_book_template_pages').select('id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec, asset_path').eq('template_id', template.id).order('page_order');
  if (pageError) throw new Error(pageError.message);
  return { id: template.id, slug: template.slug, version: template.version, name: template.name, description: template.description || '', pages: pages.map(normalizeTemplatePage) };
}

function normalizeTemplatePage(page) {
  return { id: page.id, pageKey: page.page_key, pageOrder: page.page_order, pageType: page.page_type, careerKey: page.career_key, titleZh: page.title_zh, titleEn: page.title_en, bodyZh: page.body_zh, bodyEn: page.body_en, generationSpec: page.generation_spec || {}, assetPath: page.asset_path || null };
}

async function createLocalBook(current, formData, photos) {
  const id = randomUUID(); const now = new Date().toISOString(); const directory = localBookDir(id);
  await mkdir(directory, { recursive: true });
  const sourcePhotos = await Promise.all(photos.map(async (photo, index) => {
    const fileName = `reference-${index + 1}.${extensionFor(photo.mimeType)}`;
    await writeFile(join(directory, fileName), photo.buffer);
    return { storagePath: fileName, mimeType: photo.mimeType, byteSize: photo.byteSize };
  }));
  const templateSlug = String(formData.get('templateSlug') || DEFAULT_TEMPLATE_SLUG);
  const template = FALLBACK_TEMPLATES[templateSlug];
  if (!template) throw new Error('The requested picture-book template is unavailable.');
  const book = { id, ownerId: ownerId(current), title: template.name, childId: String(formData.get('childId') || '').trim() || null, childName: String(formData.get('childName') || '').trim().slice(0, 80), model: process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst', quality: process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high', templateSlug: template.slug, templateVersion: template.version, templateName: template.name, status: 'draft', sourcePhotos, pages: template.pages.map((page) => ({ ...page, generationSpec: { ...page.generationSpec }, status: 'pending', storagePath: null })), createdAt: now, updatedAt: now };
  const state = await readLocalState(); state.books.unshift(book); await saveLocalState(state); return book;
}

async function createSupabaseBook(current, formData, photos) {
  const template = await getSupabaseTemplate(current.supabase, { slug: String(formData.get('templateSlug') || DEFAULT_TEMPLATE_SLUG) });
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').insert({ profile_id: current.authUser.id, child_id: String(formData.get('childId') || '').trim() || null, asset_type: 'picture_book', title: template.name, metadata: { templateSlug: template.slug } }).select('id, title, status, child_id, created_at, updated_at').single();
  if (assetError) throw new Error(assetError.message);
  const { error: bookError } = await current.supabase.from('family_picture_books').insert({ asset_id: asset.id, template_id: template.id, child_name: String(formData.get('childName') || '').trim().slice(0, 80), model: process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst', quality: process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high' });
  if (bookError) throw new Error(bookError.message);
  const pageRows = template.pages.map((page) => ({ book_asset_id: asset.id, template_page_id: page.id, page_key: page.pageKey, page_order: page.pageOrder }));
  const { error: pagesError } = await current.supabase.from('family_picture_book_pages').insert(pageRows);
  if (pagesError) throw new Error(pagesError.message);
  const sourcePhotos = [];
  for (const [index, photo] of photos.entries()) {
    const path = `${current.authUser.id}/picture-books/${asset.id}/references/${index + 1}.${extensionFor(photo.mimeType)}`;
    const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(path, photo.buffer, { contentType: photo.mimeType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    sourcePhotos.push({ book_asset_id: asset.id, storage_path: path, mime_type: photo.mimeType, byte_size: photo.byteSize, sort_order: index });
  }
  const { error: refsError } = await current.supabase.from('family_picture_book_source_photos').insert(sourcePhotos);
  if (refsError) throw new Error(refsError.message);
  return getSupabaseBook(current, asset.id);
}

function normalizeLocalBook(book) { return book; }

async function getSupabaseBook(current, id) {
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').select('id, title, child_id, status, created_at, updated_at, family_picture_books(template_id, child_name, model, quality)').eq('id', id).eq('asset_type', 'picture_book').single();
  if (assetError || !asset) throw missing('Picture book not found.');
  const bookRecord = Array.isArray(asset.family_picture_books) ? asset.family_picture_books[0] : asset.family_picture_books;
  if (!bookRecord?.template_id) throw new Error('Picture book is missing its template.');
  const template = await getSupabaseTemplate(current.supabase, { id: bookRecord.template_id });
  const { data: sourcePhotos, error: refsError } = await current.supabase.from('family_picture_book_source_photos').select('storage_path, mime_type, byte_size').eq('book_asset_id', id).order('sort_order');
  if (refsError) throw new Error(refsError.message);
  const { data: pageRows, error: pagesError } = await current.supabase.from('family_picture_book_pages').select('page_key, page_order, status, storage_path, generation_error, picture_book_template_pages(page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec, asset_path)').eq('book_asset_id', id).order('page_order');
  if (pagesError) throw new Error(pagesError.message);
  return { id: asset.id, title: asset.title, childId: asset.child_id, childName: bookRecord.child_name || '', model: bookRecord.model, quality: bookRecord.quality, templateSlug: template.slug, templateVersion: template.version, templateName: template.name, status: asset.status, createdAt: asset.created_at, updatedAt: asset.updated_at, sourcePhotos: sourcePhotos.map((photo) => ({ storagePath: photo.storage_path, mimeType: photo.mime_type, byteSize: photo.byte_size })), pages: pageRows.map((row) => ({ ...normalizeTemplatePage(Array.isArray(row.picture_book_template_pages) ? row.picture_book_template_pages[0] : row.picture_book_template_pages), pageKey: row.page_key, pageOrder: row.page_order, status: row.status, storagePath: row.storage_path, error: row.generation_error })) };
}

async function getLocalBook(current, id) { const state = await readLocalState(); const book = state.books.find((item) => item.id === id && item.ownerId === ownerId(current)); if (!book) throw missing('Picture book not found.'); return normalizeLocalBook(book); }

export async function createFamilyPictureBook(current, formData) {
  const childName = String(formData.get('childName') || '').trim();
  const uploads = validatePhotos(formData);
  const reusablePhotoIds = savedPhotoIds(formData);
  if (uploads.length + reusablePhotoIds.length < 2 || uploads.length + reusablePhotoIds.length > MAX_PHOTOS) throw new Error('Choose 2 to 5 uploaded or saved child reference photos.');
  const photos = [];
  for (const upload of uploads) {
    const photo = await normalizeReferencePhoto(upload);
    await createFamilyPhoto(current, { ...photo, originalName: upload.name }, { label: childName ? `${childName} picture-book photo` : upload.name, sourceKind: 'picture_book' });
    photos.push(photo);
  }
  for (const photoId of reusablePhotoIds) {
    const { photo, buffer } = await readFamilyPhoto(current, photoId);
    photos.push({ buffer, mimeType: photo.mimeType, byteSize: buffer.length });
  }
  if (photos.reduce((total, photo) => total + photo.byteSize, 0) > MAX_TOTAL_PHOTO_BYTES) throw new Error('The combined reference photos must be 90 MB or smaller.');
  return current.mode === 'supabase' ? createSupabaseBook(current, formData, photos) : createLocalBook(current, formData, photos);
}
export async function getFamilyPictureBook(current, id) { return current.mode === 'supabase' ? getSupabaseBook(current, id) : getLocalBook(current, id); }
export async function listFamilyPictureBooks(current) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.from('family_assets').select('id').eq('asset_type', 'picture_book').order('created_at', { ascending: false }); if (error) throw new Error(error.message); return Promise.all(data.map(({ id }) => getSupabaseBook(current, id))); } const state = await readLocalState(); return state.books.filter((book) => book.ownerId === ownerId(current)); }
export async function deleteFamilyPictureBook(current, id) {
  const book = await getFamilyPictureBook(current, id);
  if (current.mode === 'supabase') {
    const storagePaths = [
      ...book.sourcePhotos.map((photo) => photo.storagePath),
      ...book.pages.map((page) => page.storagePath).filter(Boolean),
    ];
    if (storagePaths.length) {
      const { error: storageError } = await current.supabase.storage.from(BUCKET).remove(storagePaths);
      if (storageError) throw new Error(storageError.message);
    }
    const { error } = await current.supabase.from('family_assets').delete().eq('id', book.id).eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return;
  }
  await rm(localBookDir(book.id), { recursive: true, force: true });
  const state = await readLocalState();
  state.books = state.books.filter((item) => item.id !== book.id || item.ownerId !== ownerId(current));
  await saveLocalState(state);
}
export async function getPictureBookTemplate(current, slug = DEFAULT_TEMPLATE_SLUG) {
  if (current.mode === 'supabase') return getSupabaseTemplate(current.supabase, { slug });
  const template = FALLBACK_TEMPLATES[slug];
  if (!template) throw missing('Picture-book template not found.');
  return template;
}

export async function listPictureBookTemplates(current) {
  if (current.mode === 'supabase') {
    const { data, error } = await current.supabase.from('picture_book_templates').select('id, slug, name, version, description').eq('is_active', true).order('created_at');
    if (error) throw new Error(error.message);
    return data.map((template) => ({ ...template, pageCount: null }));
  }
  return Object.values(FALLBACK_TEMPLATES).map(({ id, slug, name, version, description, pages }) => ({ id, slug, name, version, description, pageCount: pages.length }));
}

async function referenceBuffer(current, book, reference) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.storage.from(BUCKET).download(reference.storagePath); if (error) throw new Error(error.message); return Buffer.from(await data.arrayBuffer()); } return readFile(join(localBookDir(book.id), reference.storagePath)); }
async function generateImage(current, book, page) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const form = new FormData(); form.set('model', book.model || process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst'); form.set('prompt', pagePrompt(page)); form.set('size', page.generationSpec?.imageSize || '1024x1024'); form.set('quality', book.quality || process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high'); form.set('output_format', 'png');
  for (const reference of book.sourcePhotos) form.append('image[]', new Blob([await referenceBuffer(current, book, reference)], { type: reference.mimeType }), `reference.${extensionFor(reference.mimeType)}`);
  const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }); const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.[0]?.b64_json) throw new Error(payload?.error?.message || `Image generation failed (${response.status}).`);
  return Buffer.from(payload.data[0].b64_json, 'base64');
}

async function saveSupabaseGeneratedPage(current, book, page, png) { const path = `${current.authUser.id}/picture-books/${book.id}/pages/${page.pageKey}.png`; const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true }); if (uploadError) throw new Error(uploadError.message); const now = new Date().toISOString(); const { error: pageError } = await current.supabase.from('family_picture_book_pages').update({ status: 'ready', storage_path: path, generation_error: null, generated_at: now }).eq('book_asset_id', book.id).eq('page_key', page.pageKey); if (pageError) throw new Error(pageError.message); const ready = book.pages.every((item) => item.pageKey === page.pageKey || item.status === 'ready'); const { error: assetError } = await current.supabase.from('family_assets').update({ status: ready ? 'ready' : 'draft' }).eq('id', book.id); if (assetError) throw new Error(assetError.message); }

export async function generateFamilyPictureBookPage(current, bookId, pageKey) {
  const book = await getFamilyPictureBook(current, bookId); const page = book.pages.find((item) => item.pageKey === pageKey); if (!page) throw new Error('Unknown picture-book page.');
  if (current.mode === 'supabase') { await current.supabase.from('family_picture_book_pages').update({ status: 'generating', generation_error: null }).eq('book_asset_id', book.id).eq('page_key', pageKey); await current.supabase.from('family_assets').update({ status: 'generating' }).eq('id', book.id); }
  else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); local.status = 'generating'; local.pages.find((item) => item.pageKey === pageKey).status = 'generating'; await saveLocalState(state); }
  try { const png = await generateImage(current, book, page); if (current.mode === 'supabase') await saveSupabaseGeneratedPage(current, book, page, png); else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); const localPage = local.pages.find((item) => item.pageKey === pageKey); localPage.status = 'ready'; localPage.storagePath = `${pageKey}.png`; local.status = local.pages.every((item) => item.status === 'ready') ? 'ready' : 'draft'; local.updatedAt = new Date().toISOString(); await writeFile(join(localBookDir(book.id), localPage.storagePath), png); await saveLocalState(state); } return getFamilyPictureBook(current, bookId); }
  catch (error) { if (current.mode === 'supabase') { await current.supabase.from('family_picture_book_pages').update({ status: 'failed', generation_error: error.message }).eq('book_asset_id', book.id).eq('page_key', pageKey); await current.supabase.from('family_assets').update({ status: 'failed' }).eq('id', book.id); } else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); const localPage = local.pages.find((item) => item.pageKey === pageKey); localPage.status = 'failed'; localPage.error = error.message; local.status = 'failed'; await saveLocalState(state); } throw error; }
}

export async function readFamilyPictureBookPage(current, bookId, pageKey) { const book = await getFamilyPictureBook(current, bookId); const page = book.pages.find((item) => item.pageKey === pageKey); if (!page?.storagePath) throw missing('Picture-book page not found.'); if (current.mode === 'supabase') { const { data, error } = await current.supabase.storage.from(BUCKET).download(page.storagePath); if (error) throw new Error(error.message); return Buffer.from(await data.arrayBuffer()); } return readFile(join(localBookDir(book.id), page.storagePath)); }
export function serializeFamilyPictureBook(book) { return serialize(book); }
