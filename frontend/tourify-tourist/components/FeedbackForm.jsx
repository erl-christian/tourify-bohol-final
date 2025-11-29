// frontend/tourify-tourist/components/FeedbackForm.jsx
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radii, spacing } from '../constants/theme';

const StarPicker = ({ value, onChange }) => (
  <View style={styles.starRow}>
    {[1, 2, 3, 4, 5].map(star => (
      <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.8}>
        <Ionicons
          name={star <= value ? 'star' : 'star-outline'}
          size={32}
          color={star <= value ? '#FACC15' : colors.muted}
        />
      </TouchableOpacity>
    ))}
  </View>
);

export default function FeedbackForm({ initial = {}, onSubmit, submitting }) {
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [review, setReview] = useState(initial.review_text ?? '');
  const [assets, setAssets] = useState(initial.assets ?? []);

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'], // ✅ or just ['images'] if you only want photos
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled) {
      setAssets(prev => [...prev, ...result.assets]);
    }
  };

  const removeAsset = idx => setAssets(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!rating) return;
    onSubmit({ rating, review_text: review, assets });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Overall rating</Text>
      <StarPicker value={rating} onChange={setRating} />

      <Text style={styles.label}>Share your experience (optional)</Text>
      <TextInput
        value={review}
        onChangeText={setReview}
        placeholder="What stood out? Any tips for future visitors?"
        style={styles.textArea}
        multiline
        numberOfLines={5}
      />

      <Text style={styles.label}>Add media (optional)</Text>
      <View style={styles.mediaBar}>
        {assets.map((asset, idx) => (
          <View key={asset.assetId ?? asset.uri} style={styles.mediaThumb}>
            <Image source={{ uri: asset.uri }} style={styles.mediaImage} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeAsset(idx)}>
              <Ionicons name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addMedia} onPress={pickMedia} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addMediaText}>Add photo/video</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, (!rating || submitting) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!rating || submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <Ionicons name="refresh" color={colors.white} size={18} />
        ) : (
          <>
            <Ionicons name="paper-plane" size={18} color={colors.white} />
            <Text style={styles.submitText}>Submit feedback</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing(1.5), paddingBottom: spacing(2) },
  label: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  starRow: { flexDirection: 'row', gap: spacing(0.5) },
  textArea: {
    minHeight: 160,
    borderRadius: radii.md,
    backgroundColor: 'rgba(108,92,231,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    padding: spacing(1),
    textAlignVertical: 'top',
    fontFamily: 'Inter_400Regular',
    color: colors.text,
  },
  mediaBar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  mediaThumb: {
    position: 'relative',
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMedia: {
    width: 92,
    height: 92,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.35)',
    backgroundColor: 'rgba(108,92,231,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.25),
  },
  addMediaText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 12, textAlign: 'center' },
  submitBtn: {
    marginTop: spacing(1.5),
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },
});
