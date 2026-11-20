// The one place that knows about the icon library (docs/DESIGN.md sections 2 and 7).
// Screens use our own names, <Icon name="teams" />, and never import Lucide. Changing
// icon sets later means editing only this file.
//
// Each Lucide icon is imported from its own file, so only the icons listed here end up
// in the app (importing from 'lucide-react-native' itself would bundle all of them).
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

import ArrowRightLeft from 'lucide-react-native/icons/arrow-right-left';
import Ban from 'lucide-react-native/icons/ban';
import Bell from 'lucide-react-native/icons/bell';
import Building2 from 'lucide-react-native/icons/building-2';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import Compass from 'lucide-react-native/icons/compass';
import Crown from 'lucide-react-native/icons/crown';
import DoorOpen from 'lucide-react-native/icons/door-open';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Flag from 'lucide-react-native/icons/flag';
import Funnel from 'lucide-react-native/icons/funnel';
import Globe from 'lucide-react-native/icons/globe';
import IdCard from 'lucide-react-native/icons/id-card';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import ShieldAlert from 'lucide-react-native/icons/shield-alert';
import Trash2 from 'lucide-react-native/icons/trash-2';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import UserMinus from 'lucide-react-native/icons/user-minus';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';

// Our icon names → Lucide icons. To add one: import it above, then add one line here.
const ICONS = {
  // navigation
  teams: Users,
  explore: Compass,
  notifications: Bell,
  profile: User,
  settings: Settings,
  dashboard: LayoutDashboard,
  reports: ShieldAlert,
  venues: Building2,
  users: IdCard,
  // movement
  back: ChevronLeft,
  forward: ChevronRight,
  // actions
  add: Plus,
  approve: Check,
  reject: X,
  search: Search,
  filter: Funnel,
  edit: Pencil,
  delete: Trash2,
  invite: UserPlus,
  remove: UserMinus,
  leave: DoorOpen,
  logout: LogOut,
  transfer: ArrowRightLeft,
  show: Eye, // show a password
  hide: EyeOff, // hide a password
  // things
  captain: Crown,
  area: MapPin,
  venue: Building2,
  phone: Phone,
  email: Mail,
  website: Globe,
  password: Lock,
  report: Flag,
  block: Ban,
  time: Clock,
  // states
  success: CircleCheck,
  warning: TriangleAlert,
};

export const ICON_NAMES = Object.keys(ICONS);

const warnedNames = new Set();

// name: one of ICON_NAMES. size: defaults to the theme's icon size (24).
// color: defaults to the theme's text colour; pass the colour of the text next to it.
// accessibilityLabel: give one when the icon means something on its own (an icon-only
// button, for example). Without it the icon is decorative and screen readers skip it.
export default function Icon({ name, size, color, accessibilityLabel }) {
  const theme = useTheme();
  const Glyph = ICONS[name];

  if (!Glyph) {
    if (__DEV__ && !warnedNames.has(name)) {
      warnedNames.add(name);
      console.warn(`Icon: unknown name "${name}"`);
    }
    return null;
  }

  const labelled = Boolean(accessibilityLabel);
  return (
    <View
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={labelled ? accessibilityLabel : undefined}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!labelled}
    >
      <Glyph
        size={size ?? theme.icon.size}
        color={color ?? theme.colors.text}
        strokeWidth={theme.icon.strokeWidth}
      />
    </View>
  );
}
