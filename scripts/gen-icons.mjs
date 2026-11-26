// Generates apps/web/src/components/icon-paths.ts: the SVG paths of the
// Phosphor icons the website uses, in the duotone weight (plus `fill` for the
// few toggles that switch to it).
//
// Why: every @phosphor-icons/react component ships all six weights, so the
// website's ~100 icons cost about 70 KB gzipped of client JS, five sixths of
// it never drawn (#20). This keeps only the weights we render.
//
//   npm run icons             rewrite the file
//   npm run icons -- --check  exit 1 if the file is out of date (unit test does this too)
//
// To add an icon: add it to ICONS below (and to FILL if it toggles to fill),
// run `npm run icons`, and add it to the mobile map as AGENTS.md says.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(root, 'apps/web/src/components/icon-paths.ts');

/** Kebab-case name (as stored in the database) → Phosphor icon name. */
export const ICONS = {
  'arrow-bend-down-right': 'ArrowBendDownRight',
  'arrow-fat-down': 'ArrowFatDown',
  'arrow-fat-up': 'ArrowFatUp',
  article: 'Article',
  at: 'At',
  bank: 'Bank',
  bell: 'Bell',
  'book-open-text': 'BookOpenText',
  'bookmark-simple': 'BookmarkSimple',
  books: 'Books',
  'bowl-food': 'BowlFood',
  briefcase: 'Briefcase',
  buildings: 'Buildings',
  'calendar-blank': 'CalendarBlank',
  'car-profile': 'CarProfile',
  'caret-down': 'CaretDown',
  'caret-left': 'CaretLeft',
  'caret-right': 'CaretRight',
  'chart-bar-horizontal': 'ChartBarHorizontal',
  'chat-circle': 'ChatCircle',
  'chat-teardrop-dots': 'ChatTeardropDots',
  'chats-circle': 'ChatsCircle',
  chats: 'Chats',
  'check-circle': 'CheckCircle',
  check: 'Check',
  'circle-dashed': 'CircleDashed',
  'clock-counter-clockwise': 'ClockCounterClockwise',
  code: 'Code',
  confetti: 'Confetti',
  cpu: 'Cpu',
  'dots-three': 'DotsThree',
  'download-simple': 'DownloadSimple',
  envelope: 'EnvelopeSimple',
  exam: 'Exam',
  eye: 'Eye',
  'file-code': 'FileCode',
  'file-pdf': 'FilePdf',
  'file-text': 'FileText',
  fire: 'Fire',
  'flag-banner': 'FlagBanner',
  flag: 'Flag',
  trash: 'Trash',
  function: 'Function',
  funnel: 'Funnel',
  'gear-six': 'GearSix',
  'github-logo': 'GithubLogo',
  'google-logo': 'GoogleLogo',
  'hand-waving': 'HandWaving',
  hash: 'Hash',
  heart: 'Heart',
  'hourglass-medium': 'HourglassMedium',
  image: 'Image',
  link: 'Link',
  'linkedin-logo': 'LinkedinLogo',
  'list-bullets': 'ListBullets',
  'magnifying-glass': 'MagnifyingGlass',
  'magnifying-glass-minus': 'MagnifyingGlassMinus',
  'map-pin': 'MapPin',
  'map-trifold': 'MapTrifold',
  'mask-happy': 'MaskHappy',
  medal: 'Medal',
  megaphone: 'Megaphone',
  'moon-stars': 'MoonStars',
  'music-notes': 'MusicNotes',
  newspaper: 'Newspaper',
  'paint-brush': 'PaintBrush',
  'paper-plane-tilt': 'PaperPlaneTilt',
  paperclip: 'Paperclip',
  path: 'Path',
  'pencil-simple-line': 'PencilSimpleLine',
  'person-simple-walk': 'PersonSimpleWalk',
  plus: 'Plus',
  presentation: 'Presentation',
  'push-pin': 'PushPin',
  question: 'Question',
  quotes: 'Quotes',
  'seal-check': 'SealCheck',
  'share-network': 'ShareNetwork',
  'shield-check': 'ShieldCheck',
  'sign-out': 'SignOut',
  'squares-four': 'SquaresFour',
  'sun-horizon': 'SunHorizon',
  'text-b': 'TextB',
  'text-italic': 'TextItalic',
  'thumbs-down': 'ThumbsDown',
  'thumbs-up': 'ThumbsUp',
  ticket: 'Ticket',
  'train-simple': 'TrainSimple',
  tree: 'Tree',
  'upload-simple': 'UploadSimple',
  'user-circle': 'UserCircle',
  user: 'User',
  'users-four': 'UsersFour',
  'users-three': 'UsersThree',
  video: 'Video',
  warning: 'Warning',
  x: 'X',
};

/** Icons that also need the `fill` weight (votes, saves, likes, filters that switch on). */
export const FILL = ['arrow-fat-down', 'arrow-fat-up', 'bookmark-simple', 'funnel', 'heart', 'thumbs-down', 'thumbs-up'];

const require = createRequire(join(root, 'apps/web/package.json'));
const defsDir = join(dirname(require.resolve('@phosphor-icons/react/package.json')), 'dist/defs');

/** The <path> elements of one weight, as `d` or `[d, opacity]`. */
function paths(fragment, label) {
  const kids = [fragment.props.children].flat(Infinity).filter(Boolean);
  return kids.map((el) => {
    const { d, opacity, ...rest } = el.props;
    if (el.type !== 'path' || typeof d !== 'string' || Object.keys(rest).length) {
      throw new Error(`${label}: only <path d opacity> is supported, got <${String(el.type)}> ${JSON.stringify(el.props)}`);
    }
    return opacity === undefined ? d : [d, Number(opacity)];
  });
}

export async function render() {
  const fill = new Set(FILL);
  for (const name of fill) if (!(name in ICONS)) throw new Error(`FILL has ${name}, which is not in ICONS`);
  const lines = [];
  for (const [name, ph] of Object.entries(ICONS).sort(([a], [b]) => a.localeCompare(b))) {
    const weights = (await import(pathToFileURL(join(defsDir, `${ph}.es.js`)).href)).default;
    const entry = { duotone: paths(weights.get('duotone'), `${ph} duotone`) };
    if (fill.has(name)) entry.fill = paths(weights.get('fill'), `${ph} fill`);
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(entry)},`);
  }
  return [
    '// Generated by `npm run icons` (scripts/gen-icons.mjs) from @phosphor-icons/react. Do not edit.',
    '',
    '/** One <path>: its `d`, or `[d, opacity]`. Drawn on a 256 × 256 grid. */',
    'export type IconPath = string | [string, number];',
    'export type IconPaths = { duotone: IconPath[]; fill?: IconPath[] };',
    '',
    'export const ICON_PATHS: Record<string, IconPaths> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = await render();
  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf8');
    if (current !== next) {
      console.error('apps/web/src/components/icon-paths.ts is out of date. Run `npm run icons`.');
      process.exit(1);
    }
    console.log('icon-paths.ts is up to date.');
  } else {
    writeFileSync(OUT, next);
    console.log(`Wrote ${OUT} (${Object.keys(ICONS).length} icons).`);
  }
}
