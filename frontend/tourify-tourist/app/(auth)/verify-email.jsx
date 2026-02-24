import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import AuthBackground from '../../components/AuthBackground';
import AuthCard from '../../components/AuthCard';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import { verifyEmail } from '../../lib/auth';

const schema = z.object({
  otp: z.string().min(6, 'Enter the 6-digit code').max(6, 'Enter the 6-digit code'),
  token: z.string().min(1, 'Verification token is required'),
});

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const presetToken = typeof params.token === 'string' ? params.token : '';

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { control, handleSubmit, setValue, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otp: '', token: presetToken },
  });

  useEffect(() => {
    if (presetToken) {
      setValue('token', presetToken, { shouldValidate: false });
    } else {
      setMessage('Missing verification session. Request a new code.');
    }
  }, [presetToken, setValue]);

  const onSubmit = async values => {
    try {
      const token = values.token || getValues('token');
      if (!token) {
        setMessage('Missing verification session. Please request a new code.');
        return;
      }

      setSubmitting(true);
      await verifyEmail({ otp: values.otp, token });
      setMessage('Email verified. You can log in now.');
      setTimeout(() => router.replace('/(auth)/login'), 800);
    } catch (err) {
      setMessage(err?.message || 'Could not verify email. Check your code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to your email.
          </Text>
        </View>

        <AuthCard>
          <TextField label="Verification code (OTP)" name="otp" control={control} keyboardType="number-pad" />
          {/* token is kept in form state, hidden from user */}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.primaryText}>Verify email</Text>
            )}
          </TouchableOpacity>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.footerText}>
            Need a new code?{' '}
            <Link href="/(auth)/verify-email-request" style={styles.link}>Resend</Link>
          </Text>
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
