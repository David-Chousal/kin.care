import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type IconName =
  // Feature icons
  | 'tasks' | 'calendar' | 'medications' | 'health' | 'checkin'
  | 'documents' | 'visitprep' | 'members' | 'settings' | 'doctor'
  // UI icons
  | 'alert' | 'warning' | 'trash' | 'clock' | 'chevron'
  | 'check' | 'checkCircle' | 'add' | 'close' | 'info'
  | 'mail' | 'phone' | 'location' | 'edit' | 'back' | 'notes';

const IONICONS: Partial<Record<IconName, string>> = {
  tasks:       'checkmark-done-outline',
  calendar:    'calendar-outline',
  health:      'heart-outline',
  checkin:     'clipboard-outline',
  documents:   'folder-open-outline',
  visitprep:   'medkit-outline',
  doctor:      'medical-outline',
  members:     'people-outline',
  settings:    'settings-outline',
  alert:       'alert-circle',
  warning:     'warning',
  trash:       'trash-outline',
  clock:       'time-outline',
  chevron:     'chevron-forward',
  check:       'checkmark',
  checkCircle: 'checkmark-circle',
  add:         'add',
  close:       'close',
  info:        'information-circle-outline',
  mail:        'mail-outline',
  phone:       'call-outline',
  location:    'location-outline',
  edit:        'create-outline',
  back:        'chevron-back',
  notes:       'newspaper-outline',
};

const MCI: Partial<Record<IconName, string>> = {
  medications: 'pill',
};

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}

export function Icon({ name, size = 20, color, style }: Props) {
  const mci = MCI[name];
  if (mci) {
    return <MaterialCommunityIcons name={mci as never} size={size} color={color} style={style} />;
  }
  const ion = IONICONS[name];
  if (!ion) return null;
  return <Ionicons name={ion as never} size={size} color={color} style={style} />;
}
