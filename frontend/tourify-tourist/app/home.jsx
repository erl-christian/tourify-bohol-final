import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { Alert } from 'react-native'; 
import { colors, radii, spacing } from '../constants/theme';
import QuickAction from '../components/QuickActions';
import DestinationCard from '../components/DestinationCard';
import SectionHeader from '../components/SectionHeader';
import { quickActions } from '../constants/mockTouristData';
import {
  getTouristItineraries,
  getMyFeedback,
  getRecommendations,
  generateRecommendations,
} from '../lib/tourist';
import {
  buildEstablishmentCard,
  enrichRecommendations,
  extractEstablishmentId,
  listPublicEstablishments,
  normaliseEstablishmentSource,
} from '../lib/establishments';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'TB';



const AvatarBubble = ({ uri, name, size = 64 }) => {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarInitials, { fontSize: Math.max(16, size / 3) }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const formatDate = iso =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

const formatDateRange = (start, end) => {
  if (!start && !end) return 'Set your travel dates';
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel;
};

export default function Home() {
  const router = useRouter();
  const { account, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [itinerary, setItinerary] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [popularDestinations, setPopularDestinations] = useState([]);
  const [hiddenGemDestinations, setHiddenGemDestinations] = useState([]);
  const isUnverified = account && account.email_verified === false;

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);
  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You’ll be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');  // <— force navigation
        },
      },
    ]);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const load = async (opts = { regen: false }) => {
    if (!profile?.tourist_profile_id) return;
    const { regen } = opts;
    setError(null);
    const setBusy = opts.refresh ? setRefreshing : setLoading;
    setBusy(true);

    try {
      let recs = await getRecommendations(profile.tourist_profile_id, 6);
      if ((!recs || !recs.length) && regen) {
        recs = await generateRecommendations({
          tourist_profile_id: profile.tourist_profile_id,
          limit: 6,
          preferences: profile.preferences ?? [],
        });
      }

      const [popularRaw, underratedRaw] = await Promise.all([
        listPublicEstablishments({ sort: 'visits_desc', pageSize: 8 }),
        listPublicEstablishments({ sort: 'rating_desc', pageSize: 12 }),
      ]);

      const cleanedHidden = underratedRaw
        .filter(item => (item.rating_avg ?? 0) >= 4.5 && (item.rating_count ?? 0) < 20)
        .slice(0, 4);

      setPopularDestinations(popularRaw ?? []);
      setHiddenGemDestinations(cleanedHidden);

      let withMeta = await enrichRecommendations(recs);

      if (!withMeta.length) {
        const publicEst = await listPublicEstablishments();
        withMeta = publicEst.map(est => ({
          business_establishment_id: est.businessEstablishment_id,
          reason: 'Popular in Bohol',
          establishment: est,
        }));
      }

      const [itineraries, myFeedback] = await Promise.all([
        getTouristItineraries(),
        getMyFeedback(),
      ]);

      setRecommendations(withMeta);
      setItinerary(itineraries?.[0] ?? null);
      setFeedback((myFeedback ?? []).slice(0, 3));
    } catch (err) {
      console.error(err);
      setError(err.message ?? 'Unable to load your travel data.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (profile?.tourist_profile_id) load({ regen: true });
  }, [profile?.tourist_profile_id]);

  const onRefresh = () => load({ refresh: true, regen: true });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.hero}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{profile?.full_name ?? account?.email ?? 'Traveler'}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={26} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroAvatar} onPress={openMenu} activeOpacity={0.85}>
            <AvatarBubble
              uri={profile?.avatar_url}
              name={profile?.full_name ?? account?.email}
              size={48}
            />
          </TouchableOpacity>
        </View>

        {isUnverified ? (
          <View style={styles.verifyBanner}>
            <Ionicons name="warning-outline" size={18} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Email not verified</Text>
              <Text style={styles.verifyText}>Verify to secure your account.</Text>
            </View>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => {
                closeMenu();
                router.push('/(auth)/verify-email-request');
              }}
            >
              <Text style={styles.verifyButtonText}>Verify</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>Fetching your travel highlights…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>We hit a snag</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => load({ regen: true })}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <SectionHeader
              title="What would you like to do?"
              subtitle="Manage your travel essentials quickly."
            />
            <View style={styles.actionsRow}>
              {quickActions.map(action => (
                <QuickAction
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  onPress={() => {
                    if (action.id === 'plan') {
                      router.push('/itinerary');
                    }
                    else if (action.id === 'explore') {
                      router.push('/explore');
                    } else if (action.id === 'destinations'){
                      const featured = recommendations[0];
                      if (featured) {
                        const source = normaliseEstablishmentSource(featured);
                        const destinationId = extractEstablishmentId(source);
                        if (destinationId) {
                          router.push({
                            pathname: '/destinations',
                            params: {
                              id: destinationId,
                              recId: featured.travel_recommendation_id ?? '',
                            },
                          });
                          return;
                        } 
                      }
                    } else if (action.id === 'history') {
                      router.push('/history');
                    } else if (action.id === 'feedback') {
                        router.push('/feedback');
                    } else if (action.id === 'saved-itineraries') {
                      router.push('/community');
                    }
                    else {
                      console.log('Go to', action.id);
                    }
                  }}
                />
              ))}
            </View>
              
               <SectionHeader
                  title="Recommended for you"
                  subtitle="Top verified destinations based on your interests."
                  actionSlot={
                    <TouchableOpacity style={styles.linkBtn} onPress={() => console.log('See all recommendations')}>
                      <Text style={styles.linkText}>See all</Text>
                    </TouchableOpacity>
                  }
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {recommendations.map((item, index) => {
                    const source = normaliseEstablishmentSource(item);
                    const cardPayload = buildEstablishmentCard(source, index);
                    const destinationId = extractEstablishmentId(source);
                    const cardKey = cardPayload.id ?? destinationId ?? `recommendation-${index}`;

                    return (
                      <TouchableOpacity
                        key={cardKey}
                        activeOpacity={0.9}
                        onPress={() => {
                          if (destinationId) {
                            router.push({
                              pathname: '/destinations/[id]',
                              params: { id: destinationId, recId: item.travel_recommendation_id ?? '' },
                            });
                          }
                        }}
                      >
                        <View style={styles.badgeWrapper}>
                          <Text style={[styles.badge, styles.badgeRecommended]}>Recommended</Text>
                          <DestinationCard item={cardPayload} establishment={source?.establishment} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <SectionHeader
                  title="Trending right now"
                  subtitle="Most-visited establishments across Bohol."
                  actionSlot={
                    <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/destinations')}>
                      <Text style={styles.linkText}>See map</Text>
                    </TouchableOpacity>
                  }
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {popularDestinations.map((item, index) => {
                    const cardPayload = buildEstablishmentCard(normaliseEstablishmentSource(item), index);
                    const destinationId = extractEstablishmentId(item);
                    return (
                      <TouchableOpacity
                        key={`popular-${cardPayload.id}`}
                        activeOpacity={0.9}
                        onPress={() =>
                          destinationId && router.push({ pathname: '/destinations/[id]', params: { id: destinationId } })
                        }
                      >
                        <View style={styles.badgeWrapper}>
                          <Text style={styles.badge}>Most visited</Text>
                          <DestinationCard item={cardPayload} establishment={item.establishment} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <SectionHeader
                  title="Star 2 picks"
                  subtitle="Under-the-radar 4.5★ spots with fewer crowds."
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {hiddenGemDestinations.map((item, index) => {
                    const cardPayload = buildEstablishmentCard(normaliseEstablishmentSource(item), index);
                    const destinationId = extractEstablishmentId(item);
                    return (
                      <TouchableOpacity
                        key={`hidden-${cardPayload.id}`}
                        activeOpacity={0.9}
                        onPress={() =>
                          destinationId && router.push({ pathname: '/destinations/[id]', params: { id: destinationId } })
                        }
                      >
                        <View style={styles.badgeWrapper}>
                          <Text style={[styles.badge, styles.badgeGem]}>⭐ Hidden gem</Text>
                          <DestinationCard item={cardPayload} establishment={item.establishment} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

            <View style={styles.sectionSpacer}>
            <SectionHeader
              title="Next in your itinerary"
              subtitle="Stay on track with your upcoming plans."
            />
            {itinerary ? (
              <View style={styles.itineraryCard}>
                <View style={styles.itineraryHeader}>
                  <Ionicons name="flag" size={20} color={colors.primary} />
                  <Text style={styles.itineraryTitle}>{itinerary.title}</Text>
                </View>
                <Text style={styles.itineraryMeta}>
                  {formatDateRange(itinerary.start_date, itinerary.end_date)}
                </Text>
                <View style={styles.itineraryFooter}>
                  <Ionicons name="time-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.itineraryFooterText}>{itinerary.status ?? 'Planned'}</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Open itinerary</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Plan your first itinerary</Text>
                <Text style={styles.emptyText}>
                  Build a personalized schedule to unlock navigation and feedback tracking.
                </Text>
                <TouchableOpacity style={styles.primaryButtonOutline}>
                  <Text style={styles.primaryButtonOutlineText}>Plan a trip</Text>
                </TouchableOpacity>
              </View>
            )}
            </View>
            <SectionHeader
              title="Your latest feedback"
              subtitle="Share experiences to refine recommendations."
            />
            {feedback.length ? (
              <View style={styles.feedbackStack}>
                {feedback.map(item => (
                  <View key={item.feedback_id} style={styles.feedbackCard}>
                    <View style={styles.feedbackHeader}>
                      <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
                      <Text style={styles.feedbackPlace}>{item.business_establishment_id}</Text>
                      <Text style={styles.feedbackScore}>
                        {typeof item.rating === 'number' ? item.rating.toFixed(1) : '—'}
                      </Text>
                    </View>
                    <Text style={styles.feedbackHighlight}>
                      {item.review_text || 'No written review provided.'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No feedback yet</Text>
                <Text style={styles.emptyText}>
                  Rate the places you visit to help others and improve your recommendations.
                </Text>
                <TouchableOpacity style={styles.primaryButtonOutline}>
                  <Text style={styles.primaryButtonOutlineText}>Add feedback</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>View detailed travel analytics</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

<Modal transparent animationType="fade" visible={menuVisible} onRequestClose={closeMenu}>
        <Pressable style={styles.modalBackdrop} onPress={closeMenu}>
          <View style={styles.sheet}>
            <View style={styles.avatarWrapper}>
              <AvatarBubble uri={profile?.avatar_url} name={profile?.full_name ?? account?.email} />
              <View>
                <Text style={styles.nameLabel}>{profile?.full_name ?? 'Traveler'}</Text>
                <Text style={styles.emailLabel}>{account?.email ?? '—'}</Text>
              </View>
            </View>

            <Text style={styles.sheetTitle}>Tourist details</Text>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Full name</Text>
              <Text style={styles.detailValue}>{profile?.full_name ?? 'Not set yet'}</Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Contact</Text>
              <Text style={styles.detailValue}>{profile?.contact_no ?? 'Add contact number'}</Text>
            </View>

            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Nationality</Text>
              <Text style={styles.detailValue}>{profile?.nationality ?? 'Tell us your country'}</Text>
            </View>

            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => {
                closeMenu();
                router.push('/profile/setup');
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.sheetButtonText}>Update profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetButton, styles.signOut]} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={[styles.sheetButtonText, styles.signOutText]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background,},
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing(1.5), paddingVertical: spacing(3), gap: spacing(2) },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing(2),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  greeting: { fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  name: { fontFamily: 'Inter_700Bold', color: colors.white, fontSize: 22, marginTop: spacing(0.5) },
  roundBtn: { padding: spacing(0.25) },

  loader: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    alignItems: 'center',
    gap: spacing(1),
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  loaderText: { fontFamily: 'Inter_400Regular', color: colors.muted },

  errorCard: {
    backgroundColor: '#fff1f2',
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1),
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  errorTitle: { fontFamily: 'Inter_700Bold', color: '#be123c', fontSize: 18 },
  errorMessage: { fontFamily: 'Inter_400Regular', color: '#be123c' },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  linkBtn: { paddingVertical: spacing(0.5), paddingHorizontal: spacing(1) },
  linkText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  horizontalList: {
    paddingHorizontal: spacing(0.5),
    gap: spacing(1.25),
  },
  sectionSpacer: { marginTop: spacing(2.5) },
  itineraryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    gap: spacing(1),
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  itineraryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  itineraryTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 18 },
  itineraryMeta: { fontFamily: 'Inter_400Regular', color: colors.muted },
  itineraryFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  itineraryFooterText: { fontFamily: 'Inter_600SemiBold', color: colors.primaryDark },

  primaryButton: {
    marginTop: spacing(1.5),
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 15 },

  primaryButtonOutline: {
    marginTop: spacing(1),
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
  },
  primaryButtonOutlineText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.75),
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 20 },

  feedbackStack: { gap: spacing(1) },
  feedbackCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing(1.25),
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75) },
  feedbackPlace: { flex: 1, fontFamily: 'Inter_600SemiBold', color: colors.text },
  feedbackScore: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  feedbackHighlight: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 18 },

  secondaryButton: {
    marginTop: spacing(1),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.25),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing(0.75),
  },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primaryDark },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1.25),
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    fontSize: 16,
  },
  detailBlock: {
    paddingVertical: spacing(0.5),
    gap: spacing(0.25),
  },
  detailLabel: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
  },
  detailValue: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.25),
    borderRadius: radii.md,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  sheetButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  signOut: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  signOutText: {
    color: '#ef4444',
  },
  avatarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.25),
    marginBottom: spacing(1),
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108,92,231,0.12)',
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(108,92,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: colors.primary,
  },
  nameLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: colors.text,
  },
  emailLabel: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
  },

  badgeWrapper: { width: 220, marginRight: spacing(5),},
  badge: {
    position: 'absolute',
    top: spacing(0.5),
    left: spacing(0.75),
    zIndex: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.25),
    borderRadius: 999,
    textTransform: 'uppercase',
  },
  badgeGem: {
    backgroundColor: 'rgba(250, 204, 21, 0.95)',
    color: '#1f2937',
  },
  badgeRecommended: {
    backgroundColor: 'rgba(99,102,241,0.9)', // indigo
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
    padding: spacing(1),
    borderRadius: radii.md,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  verifyTitle: { fontFamily: 'Inter_700Bold', color: '#b45309' },
  verifyText: { fontFamily: 'Inter_400Regular', color: '#92400e' },
  verifyButton: {
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  verifyButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white },

});
