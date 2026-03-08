import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii, spacing } from '../../constants/theme';
import { isKnownNationality, NATIONALITIES } from '../../constants/nationalities';
import TextField from '../../components/TextField';
import {
  createTouristProfile,
  linkTouristArrivalSession,
  updateTouristProfile,
  uploadTouristMedia,
} from '../../lib/tourist';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
  full_name: z
    .string()
    .min(3, 'Full name is required')
    .regex(/^[A-Za-z.\-\s]+$/, 'Use letters, spaces, period, and hyphen only'),
  nickname: z.string().max(40, 'Nickname is too long').optional(),
  contact_no: z.string().min(7, 'Contact number is required'),
  nationality: z
    .string()
    .min(1, 'Nationality is required')
    .refine(value => isKnownNationality(value), 'Please choose from the nationality list'),
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
  const params = useLocalSearchParams();
  const { profile, refreshProfile } = useAuth();
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

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedImage, setPickedImage] = useState(null);
  const [nationalityPickerVisible, setNationalityPickerVisible] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      nickname: profile?.nickname ?? '',
      contact_no: profile?.contact_no ?? '',
      nationality: isKnownNationality(profile?.nationality) ? profile?.nationality : '',
    },
  });

  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      nickname: profile?.nickname ?? '',
      contact_no: profile?.contact_no ?? '',
      nationality: isKnownNationality(profile?.nationality) ? profile?.nationality : '',
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

  const selectedNationality = watch('nationality');

  const filteredNationalities = useMemo(() => {
    const keyword = nationalitySearch.trim().toLowerCase();
    if (!keyword) return NATIONALITIES;
    return NATIONALITIES.filter(item => item.toLowerCase().includes(keyword));
  }, [nationalitySearch]);

  const openNationalityPicker = () => {
    setNationalitySearch('');
    setNationalityPickerVisible(true);
  };

  const closeNationalityPicker = () => {
    setNationalityPickerVisible(false);
  };

  const onSubmitDetails = async values => {
    try {
      setSubmitting(true);
      const payload = {
        ...values,
        full_name: String(values.full_name ?? '').trim().replace(/\s+/g, ' '),
        nickname: String(values.nickname ?? '').trim(),
        nationality: String(values.nationality ?? '').trim().replace(/\s+/g, ' '),
      };
      try {
        await createTouristProfile(payload);
      } catch (err) {
        if (err?.status === 409 || /already registered/i.test(err?.message ?? '')) {
          await updateTouristProfile(payload);
        } else {
          throw err;
        }
      }
      await refreshProfile();
      if (arrivalSessionId) {
        await linkTouristArrivalSession(arrivalSessionId).catch(error => {
          console.warn('[ARRIVAL LINK] failed', error?.message || error);
        });
      }
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

            {arrivalSessionId ? (
              <View style={styles.arrivalHint}>
                <Ionicons name="airplane-outline" size={16} color={colors.primary} />
                <Text style={styles.arrivalHintText}>
                  Arrival already recorded at {entryPointName || entryPointType || 'Bohol entry point'}.
                </Text>
              </View>
            ) : null}

            <TextField label="Full Name" name="full_name" control={control} autoCapitalize="words" />
            <TextField label="Nickname (Optional)" name="nickname" control={control} autoCapitalize="words" />
            <TextField
              label="Contact Number"
              name="contact_no"
              control={control}
              keyboardType="phone-pad"
            />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Nationality</Text>
              <TouchableOpacity
                style={[
                  styles.nationalityPicker,
                  errors.nationality ? styles.nationalityPickerError : null,
                ]}
                onPress={openNationalityPicker}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.nationalityPickerText,
                    !selectedNationality ? styles.nationalityPickerPlaceholder : null,
                  ]}
                >
                  {selectedNationality || 'Select nationality'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.primary} />
              </TouchableOpacity>
              {errors.nationality ? (
                <Text style={styles.fieldError}>{errors.nationality.message}</Text>
              ) : null}
            </View>

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

      <Modal
        transparent
        animationType="slide"
        visible={nationalityPickerVisible}
        onRequestClose={closeNationalityPicker}
      >
        <Pressable style={styles.nationalityModalBackdrop} onPress={closeNationalityPicker}>
          <Pressable style={styles.nationalityModalCard} onPress={() => {}}>
            <View style={styles.nationalityModalHeader}>
              <Text style={styles.nationalityModalTitle}>Select Nationality</Text>
              <TouchableOpacity onPress={closeNationalityPicker} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.nationalitySearchBox}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                value={nationalitySearch}
                onChangeText={setNationalitySearch}
                placeholder="Search nationality..."
                style={styles.nationalitySearchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filteredNationalities}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              style={styles.nationalityList}
              ListEmptyComponent={
                <Text style={styles.nationalityEmpty}>No nationality found.</Text>
              }
              renderItem={({ item }) => {
                const selected = selectedNationality === item;
                return (
                  <TouchableOpacity
                    style={styles.nationalityItem}
                    onPress={() => {
                      setValue('nationality', item, { shouldValidate: true, shouldDirty: true });
                      closeNationalityPicker();
                    }}
                  >
                    <Text style={styles.nationalityItemText}>{item}</Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  arrivalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    backgroundColor: 'rgba(108,92,231,0.08)',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.75),
  },
  arrivalHintText: { flex: 1, fontFamily: 'Inter_500Medium', color: colors.primary },
  fieldBlock: {
    gap: spacing(0.55),
  },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
    fontSize: 13,
  },
  fieldError: {
    fontFamily: 'Inter_500Medium',
    color: '#dc2626',
    fontSize: 12,
  },
  nationalityPicker: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.3)',
    borderRadius: radii.md,
    paddingHorizontal: spacing(1),
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nationalityPickerError: {
    borderColor: '#ef4444',
  },
  nationalityPickerText: {
    fontFamily: 'Inter_500Medium',
    color: colors.text,
    flex: 1,
  },
  nationalityPickerPlaceholder: {
    color: colors.muted,
  },
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
  nationalityModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  nationalityModalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing(1.5),
    paddingTop: spacing(1.2),
    paddingBottom: spacing(1.5),
    maxHeight: '72%',
  },
  nationalityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  nationalityModalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  nationalitySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.6),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.3)',
    borderRadius: radii.md,
    paddingHorizontal: spacing(0.9),
    minHeight: 46,
    marginBottom: spacing(0.8),
  },
  nationalitySearchInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
    paddingVertical: spacing(0.65),
  },
  nationalityList: {
    flexGrow: 0,
  },
  nationalityItem: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nationalityItemText: {
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  nationalityEmpty: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing(1.2),
  },
});
