import { useEffect, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../constants/theme';

const fallbackImage = require('../assets/auth-tiles.jpg');

const resolveImageSource = value => {
  if (!value) return fallbackImage;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return { uri: value };
  if (Array.isArray(value) && value.length) return resolveImageSource(value[0]);
  if (typeof value === 'object') {
    if (value.uri) return value;
    if (value.url) return { uri: value.url };
  }
  return fallbackImage;
};

const firstMediaImage = est => {
  const mediaList = Array.isArray(est?.media) ? est.media : [];
  const entry = mediaList.find(item => (item.file_type ?? item.type ?? 'image').startsWith('image'));
  return entry?.file_url ?? entry?.url ?? null;
};

const pullEstablishmentImage = est =>
  est?.coverImage ??
  est?.heroImage ??
  est?.primaryImage ??
  est?.image ??
  est?.thumbnail ??
  est?.photo ??
  firstMediaImage(est) ??
  est?.gallery?.[0]?.url ??
  est?.photos?.[0]?.url ??
  est?.photos?.[0] ??
  null;

const buildMediaGallery = est => {
  const mediaList = Array.isArray(est?.media) ? est.media : [];
  return mediaList
    .filter(item => (item.file_type ?? item.type ?? 'image').startsWith('image'))
    .map((item, index) => {
      const src = item.file_url ?? item.url ?? item.uri ?? null;
      if (!src) return null;
      const id =
        item.media_id ??
        item.id ??
        `${est.businessEstablishment_id ?? est.business_establishment_id ?? 'media'}-${index}`;
      return { id, source: resolveImageSource(src) };
    })
    .filter(Boolean);
};

const normaliseTags = tags => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean).map(String);
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
};

const resolveTags = ({ item, est }) => {
  const candidates = [item?.tags, est?.tag_names, est?.tags, est?.type ? [est.type] : []];
  for (const source of candidates) {
    const parsed = normaliseTags(source);
    if (parsed.length) return parsed;
  }
  return [];
};

const buildCardModel = ({ item, establishment }) => {
  const est = establishment ?? item?.establishment ?? {};
  const fallbackSource = resolveImageSource(item?.image ?? pullEstablishmentImage(est));
  const gallery = buildMediaGallery(est);
  const slides = gallery.length ? gallery : [{ id: 'fallback', source: fallbackSource }];

  const rating =
    typeof item?.rating === 'number'
      ? item.rating
      : typeof est.rating_avg === 'number'
      ? est.rating_avg
      : 0;

  const metricType = item?.metricType === 'spm' ? 'spm' : 'rating';
  const metricValue = typeof item?.metricValue === 'number' ? item.metricValue : rating;

  return {
    image: slides[0].source,
    gallery: slides,
    title: item?.title ?? est.name ?? 'Discover Bohol',
    municipality: item?.municipality ?? est.municipality_id ?? est.address ?? 'Bohol',
    tags: resolveTags({ item, est }),
    rating: Number.isFinite(rating) ? rating : 0,
    metricType,
    metricValue: Number.isFinite(metricValue) ? metricValue : 0,
    reason: item?.reason ?? est.reason ?? '',
  };
};

export default function DestinationCard({ item, establishment, actionSlot }) {
  const data = buildCardModel({ item, establishment });
  const slides = data.gallery?.length ? data.gallery : [{ id: 'fallback', source: data.image }];
  const [currentSlide, setCurrentSlide] = useState(0);

  const metricIsSpm = data.metricType === 'spm';
  const metricIcon = metricIsSpm ? 'analytics-outline' : 'star';
  const metricColor = metricIsSpm ? '#38bdf8' : '#facc15';
  const metricText = metricIsSpm ? `SPM ${Math.round(data.metricValue)}` : data.rating.toFixed(1);

  useEffect(() => {
    setCurrentSlide(0);
  }, [slides.length]);

  const handleMomentumScrollEnd = event => {
    const width = event.nativeEvent.layoutMeasurement?.width || 1;
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    setCurrentSlide(Math.min(Math.max(index, 0), slides.length - 1));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.mediaContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {slides.map(entry => (
            <ImageBackground
              key={entry.id}
              source={entry.source}
              style={styles.slide}
              imageStyle={styles.image}
            />
          ))}
        </ScrollView>
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <Text style={styles.tag} numberOfLines={1}>
            {data.tags.length ? data.tags.join(' | ') : 'Verified destination'}
          </Text>

          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            {data.municipality}
          </Text>

          <View style={styles.footer}>
            <View style={styles.rating}>
              <Ionicons name={metricIcon} size={16} color={metricColor} />
              <Text style={styles.ratingText}>{metricText}</Text>
            </View>
            {actionSlot ? <View style={styles.actionSlot}>{actionSlot}</View> : null}
          </View>

          {data.reason ? (
            <Text style={styles.reason} numberOfLines={2}>
              {data.reason}
            </Text>
          ) : null}
        </View>
      </View>

      {slides.length > 1 ? (
        <View style={styles.dotRow}>
          {slides.map((_, index) => (
            <View key={`dot-${index}`} style={[styles.dot, index === currentSlide && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 260,
    marginRight: spacing(1.5),
  },
  mediaContainer: {
    height: 180,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  carousel: {
    width: '100%',
    height: '100%',
  },
  slide: {
    width: '100%',
    height: '100%',
  },
  image: { borderRadius: radii.lg },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing(1.5),
    gap: spacing(0.5),
  },
  tag: { fontFamily: 'Inter_400Regular', color: colors.white, fontSize: 12, opacity: 0.85 },
  title: { fontFamily: 'Inter_700Bold', color: colors.white, fontSize: 20 },
  meta: { fontFamily: 'Inter_400Regular', color: colors.white, opacity: 0.9 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(0.5),
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  ratingText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
  actionSlot: { marginLeft: spacing(1) },
  reason: {
    fontFamily: 'Inter_400Regular',
    color: colors.white,
    opacity: 0.9,
    marginTop: spacing(0.75),
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing(0.4),
    marginTop: spacing(0.6),
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148,163,184,0.4)',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
});
