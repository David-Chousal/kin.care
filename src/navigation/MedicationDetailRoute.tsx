import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MedicationDetailScreen } from '../features/medications/MedicationDetailScreen';
import { useMedications } from '../features/medications/hooks/useMedications';
import { useTheme } from '../theme';
import type { MainStackParamList } from './types';

export function MedicationDetailRoute() {
  const route = useRoute<RouteProp<MainStackParamList, 'MedicationDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: medications, isLoading } = useMedications();
  const t = useTheme();
  const ready = !isLoading && medications !== undefined;
  const med = medications?.find((m) => m.id === route.params.medicationId);
  const missing = ready && !med;

  useEffect(() => {
    if (missing) navigation.goBack();
  }, [missing, navigation]);

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  if (missing || !med) {
    return null;
  }

  return <MedicationDetailScreen medication={med} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
