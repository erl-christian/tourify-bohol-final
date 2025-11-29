import { Controller } from 'react-hook-form';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

export default function TextField({ control, name, label, secureTextEntry, keyboardType, autoCapitalize }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize ?? 'none'}
            placeholderTextColor={colors.muted}
          />
          {error && <Text style={styles.error}>{error.message}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing(0.5) },
  label: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  input: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    paddingHorizontal: spacing(1.5),
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    backgroundColor: '#fefefe',
  },
  inputError: { borderColor: '#ef4444' },
  error: { color: '#ef4444', fontSize: 12 },
});
