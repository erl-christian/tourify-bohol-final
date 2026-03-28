import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Pressable, TextInput, View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

export default function TextField({ control, name, label, secureTextEntry, keyboardType, autoCapitalize }) {
  const isPasswordField = Boolean(secureTextEntry);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          <Text style={styles.label}>{label}</Text>
          <View style={[styles.inputShell, error && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry={isPasswordField && !showPassword}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize ?? 'none'}
              placeholderTextColor={colors.muted}
            />
            {isPasswordField ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            ) : null}
          </View>
          {error && <Text style={styles.error}>{error.message}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing(0.5) },
  label: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  inputShell: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    paddingLeft: spacing(1.5),
    paddingRight: spacing(0.75),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefefe',
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
  },
  toggleButton: {
    minWidth: 54,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  inputError: { borderColor: '#ef4444' },
  error: { color: '#ef4444', fontSize: 12 },
});
