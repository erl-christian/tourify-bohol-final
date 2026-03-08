import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useState } from 'react';
import AuthBackground from '../../components/AuthBackground';
import AuthCard from '../../components/AuthCard';
import TextField from '../../components/TextField';
import { colors, spacing } from '../../constants/theme';
import { register as registerAccount } from '../../lib/auth';
import { linkTouristArrivalSession } from '../../lib/tourist';
import { useAuth } from '../../hooks/useAuth';

const schema = z
  .object({
    username: z
      .string()
      .min(4, 'Username is required')
      .regex(/^[a-z0-9._-]{4,64}$/i, 'Use letters, numbers, ., _, -'),
    email: z.string().email('Enter a valid recovery email'),
    password: z.string().min(8, 'Minimum 8 characters'),
    confirm: z.string().min(8, 'Confirm your password'),
  })
  .refine(data => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const arrivalSessionId =
    typeof params.arrivalSessionId === 'string' && params.arrivalSessionId.length > 0
      ? params.arrivalSessionId
      : null;
  const entryPointType =
    typeof params.entryPointType === 'string' && params.entryPointType.length > 0
      ? params.entryPointType
      : null;
  const entryPointName =
    typeof params.entryPointName === 'string' && params.entryPointName.length > 0
      ? params.entryPointName
      : null;
  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = async ({ username, email, password }) => {
    try {
      setLoading(true);
      const payload = await registerAccount({
        username,
        email,
        password,
        role: 'tourist',
      });
      await signIn(payload);
      if (arrivalSessionId) {
        await linkTouristArrivalSession(arrivalSessionId).catch(err =>
          console.warn('[ARRIVAL LINK] failed', err?.message || err)
        );
      }
      reset();
      const nextParams = {};
      if (arrivalSessionId) nextParams.arrivalSessionId = arrivalSessionId;
      if (entryPointType) nextParams.entryPointType = entryPointType;
      if (entryPointName) nextParams.entryPointName = entryPointName;
      router.replace(
        Object.keys(nextParams).length
          ? { pathname: '/profile/setup', params: nextParams }
          : '/profile/setup'
      );
    } catch (error) {
      alert(error.message ?? 'Unable to create account. Username may already be registered.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <AuthBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>Tourify Bohol</Text>
          <Text style={styles.tagline}>
            Create your account and unlock curated Bohol adventures.
          </Text>
        </View>

        <AuthCard>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Tell us who you are to personalise recommendations.
          </Text>

          {arrivalSessionId ? (
            <View style={styles.arrivalHint}>
              <Ionicons name="airplane-outline" size={16} color={colors.primary} />
              <Text style={styles.arrivalHintText}>
                Arrival recorded at {entryPointName || entryPointType || 'Bohol entry point'}.
              </Text>
            </View>
          ) : null}
          <TextField label="Username" name="username" control={control} autoCapitalize="none" />
          <TextField label="Recovery Email" name="email" control={control} keyboardType="email-address" />
          <TextField label="Password" name="password" control={control} secureTextEntry />
          <TextField label="Confirm Password" name="confirm" control={control} secureTextEntry />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.qrHint} onPress={() => console.log('QR onboarding')}>
            <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            <Text style={styles.qrHintText}>Prefer instant access? Scan a QR code at partner ports.</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Already have an account? <Link href="/(auth)/login" style={styles.link}>Log in</Link>
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
  tagline: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing(2),
  },

  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
  subtitle: { fontFamily: 'Inter_400Regular', color: colors.muted },

  primaryButton: {
    marginTop: spacing(1),
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },

  arrivalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: 'rgba(108,92,231,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    borderRadius: 12,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.75),
  },
  arrivalHintText: { fontFamily: 'Inter_500Medium', color: colors.primary, flex: 1 },

  qrHint: {
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
  qrHintText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },

  footerText: { textAlign: 'center', fontFamily: 'Inter_400Regular', color: colors.muted },
  link: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
