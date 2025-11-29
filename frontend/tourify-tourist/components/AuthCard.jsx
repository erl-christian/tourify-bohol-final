import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../constants/theme';

export default function AuthCard({ children }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 24,
    gap: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
});
