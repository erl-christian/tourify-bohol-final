import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../constants/theme';

export default function QuickAction({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: { width: 84, gap: spacing(0.5), alignItems: 'center' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(108,92,231,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    fontSize: 12,
  },
});
