// One icon set for the whole app (Lucide line icons), looked up by meaning so every screen uses
// the same picture for the same idea. Icons take their color from the surrounding text.
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Check,
  CloudRain,
  CloudSun,
  Droplet,
  Flame,
  Gift,
  LocateFixed,
  Medal,
  Minus,
  Pencil,
  Pill,
  Plus,
  Search,
  Settings,
  Siren,
  Sprout,
  Star,
  Sun,
  Target,
  Thermometer,
  TreeDeciduous,
  TrendingUp,
  User,
  Wind,
  X,
} from 'lucide-react';

const ICONS = {
  // Navigation and map controls
  score: CloudSun,
  checkIn: Star,
  patterns: Search,
  profile: User,
  locate: LocateFixed,
  emergency: Siren,
  zoomIn: Plus,
  zoomOut: Minus,
  back: ArrowLeft,
  close: X,
  // Conditions and factors
  pollen: TreeDeciduous,
  air: Wind,
  pressure: CloudRain,
  clear: Sun,
  temperature: Thermometer,
  humidity: Droplet,
  puffs: Pill,
  // Progress and rewards
  streak: Flame,
  calendar: CalendarCheck,
  medal: Medal,
  target: Target,
  star: Star,
  gift: Gift,
  levelUp: TrendingUp,
  learning: Sprout,
  check: Check,
  // Profile actions
  edit: Pencil,
  history: BookOpen,
  settings: Settings,
};

export default function Icon({ name, size = 20, strokeWidth = 2, className = '', label }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={`icon icon-${name} ${className}`.trim()}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
