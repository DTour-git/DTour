import type { CSSProperties } from 'react';
import type { Icon as PhIcon } from '@phosphor-icons/react';
import {
  ArrowBendDownRightIcon, AtIcon, ArrowFatDownIcon, ArrowFatUpIcon, ArticleIcon, BankIcon, BellIcon, BookOpenTextIcon,
  BookmarkSimpleIcon, BooksIcon, BowlFoodIcon, BriefcaseIcon, BuildingsIcon, CalendarBlankIcon, CarProfileIcon,
  CaretDownIcon, CaretLeftIcon, CaretRightIcon, ChartBarHorizontalIcon, ChatCircleIcon, ChatTeardropDotsIcon,
  ChatsCircleIcon, ChatsIcon, CheckCircleIcon, CheckIcon, CircleDashedIcon, ClockCounterClockwiseIcon, CodeIcon,
  ConfettiIcon, CpuIcon, DotsThreeIcon, DownloadSimpleIcon, EnvelopeSimpleIcon, ExamIcon, EyeIcon, FileCodeIcon,
  FilePdfIcon, FileTextIcon, FireIcon, FlagBannerIcon, FunctionIcon, FunnelIcon, GearSixIcon, GithubLogoIcon,
  GoogleLogoIcon, HandWavingIcon, HashIcon, HeartIcon, HourglassMediumIcon, ImageIcon, LinkIcon, LinkedinLogoIcon,
  ListBulletsIcon, MagnifyingGlassIcon, MapPinIcon, MapTrifoldIcon, MaskHappyIcon, MedalIcon, MegaphoneIcon,
  MoonStarsIcon, MusicNotesIcon, NewspaperIcon, PaintBrushIcon, PaperPlaneTiltIcon, PaperclipIcon, PathIcon,
  PencilSimpleLineIcon, PersonSimpleWalkIcon, PlusIcon, PresentationIcon, PushPinIcon, QuestionIcon, QuotesIcon,
  SealCheckIcon, ShareNetworkIcon, ShieldCheckIcon, SignOutIcon, SquaresFourIcon, SunHorizonIcon, TextBIcon,
  TextItalicIcon, ThumbsDownIcon, ThumbsUpIcon, TicketIcon, TrainSimpleIcon, TreeIcon, UploadSimpleIcon,
  UserCircleIcon, UserIcon, UsersFourIcon, UsersThreeIcon, VideoIcon, WarningIcon, XIcon, MagnifyingGlassMinusIcon,
} from '@phosphor-icons/react/dist/ssr';

const MAP: Record<string, PhIcon> = {
  'arrow-bend-down-right': ArrowBendDownRightIcon, 'arrow-fat-down': ArrowFatDownIcon, 'arrow-fat-up': ArrowFatUpIcon,
  article: ArticleIcon, at: AtIcon, bank: BankIcon, bell: BellIcon, 'book-open-text': BookOpenTextIcon, 'bookmark-simple': BookmarkSimpleIcon,
  books: BooksIcon, 'bowl-food': BowlFoodIcon, briefcase: BriefcaseIcon, buildings: BuildingsIcon, 'calendar-blank': CalendarBlankIcon,
  'car-profile': CarProfileIcon, 'caret-down': CaretDownIcon, 'caret-left': CaretLeftIcon, 'caret-right': CaretRightIcon,
  'chart-bar-horizontal': ChartBarHorizontalIcon, 'chat-circle': ChatCircleIcon, 'chat-teardrop-dots': ChatTeardropDotsIcon,
  'chats-circle': ChatsCircleIcon, chats: ChatsIcon, 'check-circle': CheckCircleIcon, check: CheckIcon, 'circle-dashed': CircleDashedIcon,
  'clock-counter-clockwise': ClockCounterClockwiseIcon, code: CodeIcon, confetti: ConfettiIcon, cpu: CpuIcon, 'dots-three': DotsThreeIcon,
  'download-simple': DownloadSimpleIcon, envelope: EnvelopeSimpleIcon, exam: ExamIcon, eye: EyeIcon, 'file-code': FileCodeIcon,
  'file-pdf': FilePdfIcon, 'file-text': FileTextIcon, fire: FireIcon, 'flag-banner': FlagBannerIcon, function: FunctionIcon,
  funnel: FunnelIcon, 'gear-six': GearSixIcon, 'github-logo': GithubLogoIcon, 'google-logo': GoogleLogoIcon, 'hand-waving': HandWavingIcon,
  hash: HashIcon, heart: HeartIcon, 'hourglass-medium': HourglassMediumIcon, image: ImageIcon, link: LinkIcon,
  'linkedin-logo': LinkedinLogoIcon, 'list-bullets': ListBulletsIcon, 'magnifying-glass': MagnifyingGlassIcon, 'map-pin': MapPinIcon,
  'map-trifold': MapTrifoldIcon, 'mask-happy': MaskHappyIcon, medal: MedalIcon, megaphone: MegaphoneIcon, 'moon-stars': MoonStarsIcon,
  'music-notes': MusicNotesIcon, newspaper: NewspaperIcon, 'paint-brush': PaintBrushIcon, 'paper-plane-tilt': PaperPlaneTiltIcon,
  paperclip: PaperclipIcon, path: PathIcon, 'pencil-simple-line': PencilSimpleLineIcon, 'person-simple-walk': PersonSimpleWalkIcon,
  plus: PlusIcon, presentation: PresentationIcon, 'push-pin': PushPinIcon, question: QuestionIcon, quotes: QuotesIcon,
  'seal-check': SealCheckIcon, 'share-network': ShareNetworkIcon, 'shield-check': ShieldCheckIcon, 'sign-out': SignOutIcon,
  'squares-four': SquaresFourIcon, 'sun-horizon': SunHorizonIcon, 'text-b': TextBIcon, 'text-italic': TextItalicIcon,
  'thumbs-down': ThumbsDownIcon, 'thumbs-up': ThumbsUpIcon, ticket: TicketIcon, 'train-simple': TrainSimpleIcon, tree: TreeIcon,
  'upload-simple': UploadSimpleIcon, 'user-circle': UserCircleIcon, user: UserIcon, 'users-four': UsersFourIcon,
  'users-three': UsersThreeIcon, video: VideoIcon, warning: WarningIcon, x: XIcon, 'magnifying-glass-minus': MagnifyingGlassMinusIcon,
};

/** Phosphor duotone icon by kebab-case name (the names stored in the database). */
export function Icon({ name, size = 18, color, style, weight = 'duotone', className }: {
  name: string; size?: number; color?: string; style?: CSSProperties; weight?: 'duotone' | 'fill' | 'regular'; className?: string;
}) {
  const C = MAP[name] ?? ChatCircleIcon;
  return <C size={size} weight={weight} color={color} style={{ flex: 'none', ...style }} className={className} aria-hidden />;
}
