import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '../../constants/theme';
import { getMyFeedback } from '../../lib/feedback';

const sorters = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  rating_desc: (a, b) => b.rating - a.rating,
};

const RatingRow = ({ rating }) => (
  <View style={styles.starRow}>
    {Array.from({ length: 5 }).map((_, idx) => (
      <Ionicons
        key={idx}
        name={idx < rating ? 'star' : 'star-outline'}
        size={16}
        color={idx < rating ? '#FACC15' : colors.muted}
      />
    ))}
  </View>
);

export default function TouristFeedback() {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, items: [], sort: 'newest' });

  const fetchFeedback = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setState(prev => ({ ...prev, refreshing: true }));
      }
      const data = await getMyFeedback();
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        items: data ?? [],
      }));
    } catch (err) {
      console.error('Failed to load feedback', err);
      setState(prev => ({ ...prev, loading: false, refreshing: false }));
    }
  };


  useEffect(() => {
    (async () => {
      try {
        const data = await getMyFeedback();
        setState(prev => ({ ...prev, loading: false, items: data ?? [] }));
      } catch (err) {
        console.error('Failed to load feedback', err);
        setState(prev => ({ ...prev, loading: false }));
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const sorted = [...state.items].sort(sorters[state.sort] ?? sorters.newest);
    return sorted.reduce((acc, item) => {
      const key = item.itinerary_id ?? 'unknown';
      const entry = acc.get(key) ?? {
        itinerary_id: item.itinerary_id,
        itinerary: item.itinerary ?? null,
        feedback: [],
      };
      entry.feedback.push(item);
      acc.set(key, entry);
      return acc;
    }, new Map());
  }, [state.items, state.sort]);

  if (state.loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing(4) }} />
      </SafeAreaView>
    );
  }

  const hasFeedback = state.items.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Your feedback</Text>
        <Text style={styles.subtitle}>
          Track the reviews you left on your itineraries and see owner/LGU replies.
        </Text>
        <View style={styles.sortRow}>
          {['newest', 'oldest', 'rating_desc'].map(key => (
            <TouchableOpacity
              key={key}
              style={[styles.sortChip, state.sort === key && styles.sortChipActive]}
              onPress={() => setState(prev => ({ ...prev, sort: key }))}
              activeOpacity={0.9}
            >
              <Text style={[styles.sortText, state.sort === key && styles.sortTextActive]}>
                {key === 'rating_desc' ? 'Highest rated' : key === 'oldest' ? 'Oldest first' : 'Most recent'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {hasFeedback ? (
        <ScrollView
            contentContainerStyle={styles.sectionList}
            refreshControl={
              <RefreshControl
                refreshing={state.refreshing}
                tintColor={colors.primary}
                colors={[colors.primary]}
                onRefresh={() => fetchFeedback(true)}
              />
            }
          >
          
          {[...grouped.values()].map(section => (
            <View key={section.itinerary_id ?? Math.random()} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    {section.itinerary?.title ?? 'Unnamed itinerary'}
                  </Text>
                  <Text style={styles.sectionDates}>
                    {section.itinerary?.start_date
                      ? `${new Date(section.itinerary.start_date).toLocaleDateString()} — ${new Date(
                          section.itinerary.end_date ?? section.itinerary.start_date
                        ).toLocaleDateString()}`
                      : 'Dates not recorded'}
                  </Text>
                </View>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{section.feedback.length}</Text>
                  <Text style={styles.sectionBadgeSub}>reviews</Text>
                </View>
              </View>

              {section.feedback.map(item => (
                <View key={item.feedback_id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.estName}>
                        {item.establishment?.name ?? 'Business establishment'}
                      </Text>
                      <Text style={styles.estMeta}>
                        {item.establishment?.address ?? item.establishment?.municipality_id ?? 'Bohol'}
                      </Text>
                    </View>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingValue}>{Number(item.rating).toFixed(1)}</Text>
                      <RatingRow rating={Math.round(item.rating)} />
                    </View>
                  </View>

                  <Text style={styles.reviewDate}>
                    {new Date(item.createdAt ?? item.created_at).toLocaleDateString()}
                  </Text>
                  {item.review_text ? (
                    <Text style={styles.reviewText}>{item.review_text}</Text>
                  ) : (
                    <Text style={[styles.reviewText, styles.muted]}>No written review.</Text>
                  )}

                  {Array.isArray(item.replies) && item.replies.length ? (
                    <View style={styles.replyStack}>
                      {item.replies.map(reply => (
                        <View key={reply._id ?? reply.response_id} style={styles.replyCard}>
                          <View style={styles.replyHeader}>
                            <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.primary} />
                            <Text style={styles.replyLabel}>
                              {reply.business_establishment_profile_id ? 'Owner response' : 'LGU response'}
                            </Text>
                            <Text style={styles.replyDate}>
                              {new Date(reply.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                          <Text style={styles.replyBody}>{reply.response_text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.replyPlaceholder}>
                      <Ionicons name="time-outline" size={16} color={colors.muted} />
                      <Text style={styles.replyPlaceholderText}>Awaiting a response</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No feedback yet</Text>
          <Text style={styles.emptyBody}>
            Share your experiences to help fellow travelers and let establishments know what stood out.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/explore')} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Explore destinations</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing(2), gap: spacing(1) },
  title: { fontFamily: 'Inter_700Bold', fontSize: 26, color: colors.text },
  subtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 20 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.75), marginTop: spacing(0.5) },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.4),
    backgroundColor: colors.white,
  },
  sortChipActive: { backgroundColor: 'rgba(108,92,231,0.12)', borderColor: colors.primary },
  sortText: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 13 },
  sortTextActive: { color: colors.primary },
  sectionList: { paddingHorizontal: spacing(1.5), paddingBottom: spacing(4), gap: spacing(2) },
  section: { gap: spacing(1.25) },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.25),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text },
  sectionDates: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  sectionBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: 'rgba(108,92,231,0.1)',
    paddingHorizontal: spacing(1.2),
    paddingVertical: spacing(0.4),
  },
  sectionBadgeText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 16 },
  sectionBadgeSub: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 11 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: spacing(1.25),
    gap: spacing(0.8),
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(1) },
  estName: { fontFamily: 'Inter_700Bold', color: colors.text },
  estMeta: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  ratingBadge: {
    alignItems: 'flex-end',
    gap: spacing(0.3),
  },
  ratingValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.primary },
  reviewDate: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.muted },
  reviewText: { fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 18 },
  muted: { color: colors.muted },
  replyStack: { gap: spacing(0.8) },
  replyCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    backgroundColor: 'rgba(108,92,231,0.05)',
    padding: spacing(0.9),
    gap: spacing(0.4),
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.4) },
  replyLabel: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
  replyDate: { marginLeft: 'auto', fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  replyBody: { fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 16 },
  replyPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
    padding: spacing(0.6),
    borderRadius: radii.md,
    backgroundColor: 'rgba(148,163,184,0.15)',
  },
  replyPlaceholderText: { fontFamily: 'Inter_500Medium', color: colors.muted },
  starRow: { flexDirection: 'row', gap: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
    padding: spacing(2),
  },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.text },
  emptyBody: { fontFamily: 'Inter_400Regular', color: colors.muted, textAlign: 'center', lineHeight: 18 },
  cta: {
    marginTop: spacing(1),
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.9),
  },
  ctaText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
});
