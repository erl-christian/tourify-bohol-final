import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export default function SectionHeader({ title, subtitle, actionSlot }) {
  return (
    <View style={styles.wrap}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {actionSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing(1) },
  title: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 20 },
  subtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 13 },
});
