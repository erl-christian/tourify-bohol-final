import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../../constants/theme';
import client from '../../lib/http';

export default function Welcome() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [scannedLabel, setScannedLabel] = useState('');
  const establishmentId =
    typeof params.establishmentId === 'string' && params.establishmentId.length > 0
      ? params.establishmentId
      : null;

  useEffect(() => {
    if (!establishmentId) {
      setScannedLabel('');
      return;
    }

    let active = true;
    setScannedLabel('Loading venue…');

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

  const goToLogin = () => {
    router.push(
      establishmentId
        ? { pathname: '/(auth)/login', params: { establishmentId } }
        : '/(auth)/login',
    );
  };

  const goToRegister = () => {
    router.push('/(auth)/register');
  };

  const goToScanner = () => {
    router.push('/(auth)/login-qr');
  };

  return (
    <LinearGradient colors={[colors.primary, '#8b5cf6']} style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../../assets/auth-hero.jpg')}
        style={styles.image}
        imageStyle={styles.imageStyle}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <Text style={styles.brand}>Tourify Bohol</Text>
          <Text style={styles.tagline}>Your Smart Travel Companion</Text>
          <Text style={styles.subcopy}>
            Plan itineraries, discover accredited destinations, and collect travel memories—all in one place.
          </Text>
          <View style={styles.actions}>
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
            <TouchableOpacity style={styles.primaryBtn} onPress={goToLogin}>
              <Text style={styles.primaryText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={goToRegister}>
              <Text style={styles.secondaryText}>Sign Up</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.qrButton} onPress={goToScanner}>
              <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
              <Text style={styles.qrText}>Scan QR to enter</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
              QR codes are available at partner ports and accredited establishments.
            </Text>
          </View>
        </View>
      </ImageBackground>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  image: { flex: 1 },
  imageStyle: { opacity: 0.55 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing(2),
    gap: spacing(2),
  },
  brand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: colors.white,
  },
  tagline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: 'rgba(255,255,255,0.95)',
  },
  subcopy: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  actions: {
    gap: spacing(1.25),
    backgroundColor: 'rgba(15,23,42,0.35)',
    borderRadius: radii.lg,
    padding: spacing(1.75),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
    padding: spacing(0.75),
    borderRadius: spacing(0.75),
    backgroundColor: 'rgba(108,92,231,0.12)',
  },
  scanBannerLabel: {
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  scanBannerValue: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    fontSize: 16,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
    fontSize: 16,
  },
  qrButton: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(15,23,42,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.75),
  },
  qrText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  footnote: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
});
