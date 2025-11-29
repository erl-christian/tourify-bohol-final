import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../constants/theme';

const starIcons = rating =>
  Array.from({ length: 5 }).map((_, idx) => (
    <Ionicons
      key={idx}
      name={idx < rating ? 'star' : 'star-outline'}
      size={16}
      color={idx < rating ? '#FACC15' : colors.muted}
    />
  ));

export default function FeedbackCard({ feedback }) {
  const replies = Array.isArray(feedback.replies) ? feedback.replies : [];
  const media = Array.isArray(feedback.media) ? feedback.media : [];

  const { width: screenWidth } = useWindowDimensions();
  const slideWidth = Math.min(screenWidth - spacing(2), 420);

  const [viewerIndex, setViewerIndex] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef(null);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]?.index != null) {
      setCurrentSlide(viewableItems[0].index);
    }
  }).current;

  useEffect(() => {
    if (viewerIndex !== null && flatListRef.current) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
      });
    }
  }, [viewerIndex]);

  const handleOpenMedia = index => {
    setCurrentSlide(index);
    setViewerIndex(index);
  };

  const handleCloseViewer = () => {
    setViewerIndex(null);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.rating}>{feedback.rating.toFixed(1)}</Text>
        <View style={styles.stars}>{starIcons(Math.round(feedback.rating))}</View>
        <Text style={styles.date}>
          {new Date(feedback.createdAt ?? feedback.created_at).toLocaleDateString()}
        </Text>
      </View>
      {feedback.review_text ? <Text style={styles.body}>{feedback.review_text}</Text> : null}

      {media.length ? (
        <View style={styles.mediaGrid}>
          {media.map((item, index) => {
            const key = item.media_id ?? item.file_url ?? index;
            const isVideo = item.file_type === 'video';

            return (
              <TouchableOpacity
                key={key}
                style={isVideo ? styles.mediaVideo : styles.mediaImageWrapper}
                activeOpacity={0.9}
                onPress={() => handleOpenMedia(index)}
              >
                {isVideo ? (
                  <>
                    <Ionicons name="play" size={18} color={colors.primary} />
                    <Text style={styles.mediaVideoText}>Watch video</Text>
                  </>
                ) : (
                  <Image source={{ uri: item.file_url }} style={styles.mediaImage} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {replies.length ? (
        <View style={styles.replyStack}>
          {replies.map(reply => (
            <View key={reply._id ?? reply.response_id} style={styles.reply}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.replyMeta}>
                  {reply.admin_staff_profile_id ? 'LGU Response' : 'Owner Response'} -{' '}
                  {new Date(reply.createdAt).toLocaleDateString()}
                </Text>
                <Text style={styles.replyText}>{reply.response_text}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseViewer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {viewerIndex !== null ? (
              <FlatList
                ref={flatListRef}
                style={{ width: slideWidth, alignSelf: 'center' }}
                contentContainerStyle={{ alignItems: 'center' }}
                data={media}
                horizontal
                pagingEnabled
                keyExtractor={(item, idx) => `${item.media_id ?? item.file_url ?? idx}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <MediaSlide
                    item={item}
                    width={slideWidth}
                    isActive={index === currentSlide}
                  />
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({
                  length: slideWidth,
                  offset: slideWidth * index,
                  index,
                })}
                initialScrollIndex={viewerIndex ?? 0}
              />
            ) : null}

            <View style={styles.viewerMetaRow}>
              <Text style={styles.viewerCounter}>
                {currentSlide + 1} / {media.length}
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseViewer}>
                <Ionicons name="close-circle" size={18} color={colors.primary} />
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    backgroundColor: 'rgba(108,92,231,0.04)',
    padding: spacing(1.2),
    gap: spacing(0.75),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  rating: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16 },
  stars: { flexDirection: 'row', gap: 2 },
  date: { marginLeft: 'auto', fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  body: { fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 18 },
  replyStack: { gap: spacing(0.75), marginTop: spacing(0.5) },
  reply: {
    flexDirection: 'row',
    gap: spacing(0.5),
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    backgroundColor: colors.white,
    padding: spacing(0.75),
  },
  replyMeta: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
  replyText: { fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 16 },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(0.75),
  },
  mediaImageWrapper: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideo: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108,92,231,0.06)',
    gap: spacing(0.25),
  },
  mediaVideoText: {
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing(1.5),
  },
  modalContent: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: colors.white,
    padding: spacing(1),
    gap: spacing(0.75),
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideMedia: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.sm,
    backgroundColor: '#000',
  },
  viewerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerCounter: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.25),
  },
  closeButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
});

function MediaSlide({ item, width, isActive }) {
  if (item.file_type === 'video') {
    return <VideoSlide uri={item.file_url} width={width} isActive={isActive} />;
  }
  return <ImageSlide uri={item.file_url} width={width} />;
}

function ImageSlide({ uri, width }) {
  return (
    <View style={[styles.slide, { width }]}>
      <Image source={{ uri }} style={styles.slideMedia} resizeMode="contain" />
    </View>
  );
}

function VideoSlide({ uri, width, isActive }) {
  const player = useVideoPlayer({ uri });

  useEffect(() => {
    if (isActive) {
      player.play?.();
    } else {
      player.pause?.();
      try {
        player.currentTime = 0;
      } catch {
        // ignore seek issues on unsupported sources
      }
    }
  }, [isActive, player]);

  return (
    <View style={[styles.slide, { width }]}>
      <VideoView player={player} style={styles.slideMedia} nativeControls contentFit="contain" />
    </View>
  );
}
