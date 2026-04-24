import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, space } from '../theme';
import { useConnectivityBanner, type ConnectivityBannerKind } from '../hooks/useConnectivityBanner';

const OFFLINE_BANNER_AUTO_DISMISS_MS = 15_000;

function labels(kind: ConnectivityBannerKind, t: (k: string) => string) {
  if (kind === 'offline') {
    return { title: t('connectivity.offlineTitle'), body: t('connectivity.offlineBody') };
  }
  if (kind === 'unstable') {
    return { title: t('connectivity.unstableTitle'), body: t('connectivity.unstableBody') };
  }
  if (kind === 'syncPaused') {
    return { title: t('connectivity.syncPausedTitle'), body: t('connectivity.syncPausedBody') };
  }
  return null;
}

export function ConnectivityBanner() {
  const kind = useConnectivityBanner();
  const theme = useTheme();
  const { t: tx } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offlineSuppressed, setOfflineSuppressed] = useState(false);

  useEffect(() => {
    if (kind !== 'offline') {
      setOfflineSuppressed(false);
    }
  }, [kind]);

  useEffect(() => {
    if (kind !== 'offline' || offlineSuppressed) return undefined;
    const id = setTimeout(() => setOfflineSuppressed(true), OFFLINE_BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [kind, offlineSuppressed]);

  const displayKind: ConnectivityBannerKind =
    kind === 'offline' && offlineSuppressed ? 'none' : kind;

  if (displayKind === 'none') return null;

  const copy = labels(displayKind, tx);
  if (!copy) return null;

  const bg = displayKind === 'offline' ? theme.surfaceAlt : theme.accentLight;
  const border = displayKind === 'offline' ? theme.border : theme.accentBorder;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + space[1],
          backgroundColor: bg,
          borderBottomColor: border,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {displayKind === 'syncPaused' ? (
        <View style={styles.syncRow}>
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={22}
            color={theme.text}
            style={styles.syncIcon}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
          <View style={styles.syncCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{copy.body}</Text>
          </View>
        </View>
      ) : displayKind === 'offline' ? (
        <View style={styles.offlineRow}>
          <View style={styles.offlineCopy}>
            <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{copy.body}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('connectivity.dismissOfflineBannerA11y')}
            hitSlop={12}
            onPress={() => setOfflineSuppressed(true)}
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.dismissBtnPressed]}
          >
            <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{copy.body}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  offlineCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: space[2],
  },
  dismissBtn: {
    marginTop: -2,
    padding: space[1],
    marginRight: -space[1],
  },
  dismissBtnPressed: {
    opacity: 0.55,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  syncIcon: {
    marginRight: space[3],
    marginTop: 1,
  },
  syncCopy: {
    flex: 1,
    minWidth: 0,
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    zIndex: 100,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2 },
      android: { elevation: 3 },
    }),
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: space[1],
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
