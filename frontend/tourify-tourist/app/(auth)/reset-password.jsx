import { useLocalSearchParams, Link, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import AuthBackground from '../../components/AuthBackground';
import AuthCard from '../../components/AuthCard';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import { resetPassword } from '../../lib/auth';

const schema = z.object({
  otp: z.string().min(6, 'Enter the 6-digit code').max(6, 'Enter the 6-digit code'),
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirm: z.string().min(8, 'Minimum 8 characters'),
}).refine(values => values.newPassword === values.confirm, {
  path: ['confirm'],
  message: 'Passwords must match',
});

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const presetToken = typeof params.token === 'string' ? params.token : '';

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { control, handleSubmit, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otp: '', token: presetToken, newPassword: '', confirm: '' },
  });

  // preload token once, safely
  useEffect(() => {
    if (presetToken) {
      setValue('token', presetToken, { shouldValidate: false });
    }
  }, [presetToken, setValue]);

  const onSubmit = async values => {
    try {
      setSubmitting(true);
      await resetPassword({ otp: values.otp, token: values.token, newPassword: values.newPassword });
      setMessage('Password updated. You can log in now.');
      setTimeout(() => router.replace('/(auth)/login'), 800);
    } catch (err) {
      setMessage(err?.message || 'Could not reset password. Check your code/token and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>
            Enter the reset code from your email, the token (prefilled if you came from the previous step), and your new password.
          </Text>
        </View>

        <AuthCard>
          <TextField label="Reset code (OTP)" name="otp" control={control} keyboardType="number-pad" />
          <TextField label="Reset token" name="token" control={control} />
          <TextField label="New password" name="newPassword" control={control} secureTextEntry />
          <TextField label="Confirm password" name="confirm" control={control} secureTextEntry />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.primaryText}>Update password</Text>
            )}
          </TouchableOpacity>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.footerText}>
            Back to <Link href="/(auth)/login" style={styles.link}>login</Link>
          </Text>
        </AuthCard>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  header: { gap: spacing(0.5), paddingTop: spacing(1), paddingHorizontal: spacing(1) },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.white, textAlign: 'center' },
  subtitle: { fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  primaryButton: {
    marginTop: spacing(1),
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },
  message: { marginTop: spacing(1), color: colors.text, fontFamily: 'Inter_400Regular' },
  footerText: { textAlign: 'center', fontFamily: 'Inter_400Regular', color: colors.muted, marginTop: spacing(1) },
  link: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
