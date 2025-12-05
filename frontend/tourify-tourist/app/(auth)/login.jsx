import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import AuthBackground from '../../components/AuthBackground';
import AuthCard from '../../components/AuthCard';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import { login } from '../../lib/auth';
import { recordQrArrival } from '../../lib/tourist';
import { useAuth } from '../../hooks/useAuth';
import client from '../../lib/http';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
});

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [scannedLabel, setScannedLabel] = useState('');
  const establishmentId =
    typeof params.establishmentId === 'string' && params.establishmentId.length > 0
      ? params.establishmentId
      : null;

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!establishmentId) {
      setScannedLabel('');
      return;
    }

    let active = true;
    setScannedLabel('Loading establishment…');

    client
      .get(`/public/establishments/${establishmentId}`)
      .then(res => {
        if (!active) return;
        const name = res.data?.establishment?.name ?? res.data?.name ?? establishmentId;
        setScannedLabel(name);
      })
      .catch(() => {
        if (!active) return;
        setScannedLabel(`Establishment ID ${establishmentId}`);
      });

    return () => {
      active = false;
    };
  }, [establishmentId]);

// inside onSubmit
  const onSubmit = async values => {
    try {
      setSubmitting(true);
      const data = await login(values);
      await signIn(data);

      if (establishmentId) {
        await recordQrArrival(establishmentId)
          .then(res => {
            console.log('[QR ARRIVAL] recorded', {
              estId: establishmentId,
              itinerary: res?.itinerary_id,
              visitId: res?.visit?.travel_history_id,
            });
          })
          .catch(err => console.warn('[QR ARRIVAL] failed', err?.message || err));
      }

      router.replace('/home');
    } catch (error) {
      alert(error.message ?? 'Failed to log in. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Tourify Bohol</Text>
          <Text style={styles.subtitle}>
            Sign in to pick up your curated Bohol journeys.
          </Text>
        </View>

        <AuthCard>
          <Text style={styles.title}>Welcome Back</Text>

          {establishmentId ? (
            <View style={styles.scanBanner}>
              <Ionicons name="qr-code" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scanBannerLabel}>Scanned on site</Text>
                <Text style={styles.scanBannerValue} numberOfLines={1}>
                  {scannedLabel || establishmentId}
                </Text>
              </View>
            </View>
          ) : null}

          <TextField label="Email" name="email" control={control} keyboardType="email-address" />
          <TextField label="Password" name="password" control={control} secureTextEntry />
          <Text style={styles.helperRow}>
            <Link href="/(auth)/forgot-password" style={styles.link}>Forgot password?</Link>
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => router.push('/(auth)/login-qr')}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            <Text style={styles.qrText}>Scan QR to enter</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            New here? <Link href="/(auth)/register" style={styles.link}>Create an account</Link>
          </Text>
        </AuthCard>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  header: { gap: spacing(0.75), alignItems: 'center', paddingTop: spacing(1) },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.white },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing(2),
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
  helperRow: {
    marginTop: spacing(0.25),
    alignSelf: 'flex-end',
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
  },

  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
    padding: spacing(0.75),
    borderRadius: spacing(0.75),
    backgroundColor: 'rgba(108,92,231,0.08)',
    marginBottom: spacing(1),
  },
  scanBannerLabel: {
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  scanBannerValue: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },

  primaryButton: {
    marginTop: spacing(1),
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },

  qrButton: {
    marginTop: spacing(1),
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    backgroundColor: 'rgba(108,92,231,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.75),
  },
  qrText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },

  footerText: { textAlign: 'center', fontFamily: 'Inter_400Regular', color: colors.muted },
  link: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
