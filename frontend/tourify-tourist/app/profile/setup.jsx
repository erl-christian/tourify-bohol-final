import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii, spacing } from '../../constants/theme';
import TextField from '../../components/TextField';
import {
  createTouristProfile,
  updateTouristProfile,
  uploadTouristMedia,
} from '../../lib/tourist';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
  full_name: z.string().min(3, 'Full name is required'),
  contact_no: z.string().min(7, 'Contact number is required'),
  nationality: z.string().min(2, 'Nationality is required'),
});

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'TB';

export default function ProfileSetup() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedImage, setPickedImage] = useState(null);

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      contact_no: profile?.contact_no ?? '',
      nationality: profile?.nationality ?? '',
    },
  });

  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      contact_no: profile?.contact_no ?? '',
      nationality: profile?.nationality ?? '',
    });
  }, [profile, reset]);

  useEffect(() => {
    if (profile?.avatar_url) {
      setPickedImage({ uri: profile.avatar_url });
    }
  }, [profile]);

  const headerCopy = useMemo(() => {
    if (step === 1) {
      return {
        title: 'Tell us about you',
        subtitle: 'Personalised recommendations start with accurate travel details.',
      };
    }
    return {
      title: 'Add a profile photo',
      subtitle: 'Optional but helpful—establishments recognise your bookings. You can skip this.',
    };
  }, [step]);

  const onSubmitDetails = async values => {
    try {
      setSubmitting(true);
      try {
        await createTouristProfile(values);
      } catch (err) {
        if (err?.status === 409 || /already registered/i.test(err?.message ?? '')) {
          await updateTouristProfile(values);
        } else {
          throw err;
        }
      }
      await refreshProfile();
      setStep(2);
    } catch (error) {
      Alert.alert('Unable to save profile', error.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], // <-- fix
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.length) {
      setPickedImage(result.assets[0]);
    }
  };

  const uploadImageAndFinish = async () => {
    try {
      setUploading(true);

      if (pickedImage?.uri && !pickedImage.uri.startsWith('http')) {
        await uploadTouristMedia({
          uri: pickedImage.uri,
          mimeType: pickedImage.mimeType,
          name: pickedImage.fileName,
        });
        await refreshProfile();
      }

      router.replace('/home');
    } catch (error) {
      Alert.alert('Upload failed', error.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const skipPhoto = () => router.replace('/home');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>Tourify Bohol</Text>
          <Text style={styles.subtitle}>{headerCopy.subtitle}</Text>
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
              <View>
                <Text style={styles.cardTitle}>{headerCopy.title}</Text>
                <Text style={styles.cardHint}>
                  Required for itineraries, feedback, and QR-based services.
                </Text>
              </View>
            </View>

            <TextField label="Full Name" name="full_name" control={control} autoCapitalize="words" />
            <TextField
              label="Contact Number"
              name="contact_no"
              control={control}
              keyboardType="phone-pad"
            />
            <TextField label="Nationality" name="nationality" control={control} autoCapitalize="words" />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubmit(onSubmitDetails)}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>Save & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={skipPhoto} disabled={submitting}>
              <Text style={styles.skipText}>Skip and finish setup</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="image-outline" size={28} color={colors.primary} />
              <View>
                <Text style={styles.cardTitle}>{headerCopy.title}</Text>
                <Text style={styles.cardHint}>
                  We’ll use this when you share itineraries or leave feedback. Change it anytime.
                </Text>
              </View>
            </View>

            <View style={styles.avatarStage}>
              {pickedImage?.uri ? (
                <Image source={{ uri: pickedImage.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewFallback}>
                  <Text style={styles.previewInitials}>{getInitials(profile?.full_name ?? '')}</Text>
                  <Text style={styles.previewLabel}>No photo selected</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={pickImage} disabled={uploading}>
              <Text style={styles.primaryText}>
                {pickedImage ? 'Choose a different photo' : 'Choose a profile photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, styles.finishButton]}
              onPress={uploadImageAndFinish}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>
                  {pickedImage ? 'Save photo & finish' : 'Finish without photo'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={skipPhoto} disabled={uploading}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background,paddingTop: spacing(2)},
  content: { padding: spacing(2), gap: spacing(2.5) },
  header: { gap: spacing(0.75), alignItems: 'center', marginTop: spacing(1) },
  brand: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.primary },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing(2),
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1.5),
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text },
  cardHint: { fontFamily: 'Inter_400Regular', color: colors.muted },
  primaryButton: {
    marginTop: spacing(1),
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },
  skipButton: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  avatarStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(1.5),
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  previewFallback: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(108,92,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.75),
  },
  previewInitials: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: colors.primary,
  },
  previewLabel: {
    fontFamily: 'Inter_400Regular',
    color: colors.primary,
  },
  finishButton: {
    backgroundColor: colors.primaryDark,
  },
});
