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
import { requestEmailVerification } from '../../lib/auth';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function VerifyEmailRequest() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async values => {
    try {
      setSubmitting(true);
      const data = await requestEmailVerification(values.email);
      setMessage(data?.message || 'If that email exists, a verification code was sent.');
      if (data?.verifyToken) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { token: data.verifyToken },
        });
      }
    } catch (err) {
      setMessage(err?.message || 'Unable to send verification. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Enter your email and we’ll send a verification code.
          </Text>
        </View>

        <AuthCard>
          <TextField label="Email" name="email" control={control} keyboardType="email-address" />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color={colors.white} /> : (
              <Text style={styles.primaryText}>Send verification</Text>
            )}
          </TouchableOpacity>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.footerText}>
            Already have a token?{' '}
            <Link href="/(auth)/verify-email" style={styles.link}>Enter token</Link>
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
