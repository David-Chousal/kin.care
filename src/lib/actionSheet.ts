import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface ActionSheetOptions {
  title?: string;
  message?: string;
  options: string[];
  destructiveButtonIndex?: number;
  cancelButtonIndex?: number;
}

export function showActionSheet(
  opts: ActionSheetOptions,
  onSelect: (index: number) => void,
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(opts, (i) => {
      if (typeof i === 'number') onSelect(i);
    });
    return;
  }

  const buttons = opts.options.map((label, i) => ({
    text: label,
    style:
      i === opts.cancelButtonIndex
        ? ('cancel' as const)
        : i === opts.destructiveButtonIndex
        ? ('destructive' as const)
        : ('default' as const),
    onPress: () => {
      if (i !== opts.cancelButtonIndex) onSelect(i);
    },
  }));

  Alert.alert(opts.title ?? '', opts.message, buttons, { cancelable: true });
}
