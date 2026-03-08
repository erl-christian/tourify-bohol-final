import { Link, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import AuthBackground from '../../components/AuthBackground';
import AuthCard from '../../components/AuthCard';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import { requestPasswordReset } from '../../lib/auth';

const schema = z.object({
  username: z
    .string()
    .min(4, 'Username is required')
    .regex(/^[a-z0-9._-]{4,64}$/i, 'Use letters, numbers, ., _, -'),
  email: z.string().email('Enter a valid recovery email'),
});

export default function ForgotPassword() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = async values => {
    try {
      setSubmitting(true);
      const data = await requestPasswordReset(values);
      setMessage(data?.message || 'If that account exists, a reset code was sent.');
      if (data?.resetToken) {
        router.push({
          pathname: '/(auth)/reset-password',
          params: { token: data.resetToken },
        });
      }
    } catch (err) {
      setMessage(err?.message || 'Unable to request reset. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter your username and recovery email and we'll send a reset code.
          </Text>
        </View>

        <AuthCard>
          <TextField label="Username" name="username" control={control} autoCapitalize="none" />
          <TextField label="Recovery Email" name="email" control={control} keyboardType="email-address" />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.primaryText}>Send reset code</Text>
            )}
          </TouchableOpacity>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.footerText}>
            Already have a code?{' '}
            <Link href="/(auth)/reset-password" style={styles.link}>Enter code</Link>
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
