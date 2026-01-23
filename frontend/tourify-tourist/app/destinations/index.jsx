import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageBackground,
  TextInput, 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DestinationCard from '../../components/DestinationCard';
import SectionHeader from '../../components/SectionHeader';
import { colors, spacing, radii } from '../../constants/theme';
import { buildEstablishmentCard } from '../../lib/establishments';
import { getPublicDestinations } from '../../lib/tourist';

const PAGE_SIZE = 24;
const HERO_IMAGE = require('../../assets/auth-hero.jpg');

const filters = ['All', 'Beach', 'Nature', 'Heritage', 'Food', 'Adventure'];

const toCardEntry = (est, index) => ({
  establishment: est,
  card: buildEstablishmentCard({ establishment: est }, index),
});

export default function DestinationDirectory() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const SKELETON_COUNT = 5;

  const loadDestinations = useCallback(async () => {
    setError('');
    try {
      const items = await getPublicDestinations({ pageSize: PAGE_SIZE, sort: 'rating_desc' });
      const formatted = (items ?? []).map(toCardEntry);
      setEntries(formatted);
    } catch (err) {
      console.warn('Failed to load destinations', err);
      setError('Unable to fetch destinations. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDestinations();
  };

  const filteredEntries = useMemo(() => {
    let list = entries;

    if (activeFilter !== 'All') {
      const tag = activeFilter.toLowerCase();
      list = list.filter(entry => {
        const tags = entry.establishment?.tag_names ?? entry.card.tags ?? [];
        return tags.some(t => t?.toLowerCase?.().includes(tag));
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter(entry => {
      const est = entry.establishment ?? {};
      const name = est.name ?? entry.card.title ?? '';
      const location = est.address ?? est.municipality_id ?? '';
      const tags = Array.isArray(est.tag_names) ? est.tag_names.join(' ') : '';
      return `${name} ${location} ${tags}`.toLowerCase().includes(query);
    });
  }, [entries, activeFilter, searchQuery]);

  const featured = filteredEntries.slice(0, 5);
  const rest = filteredEntries.slice(5);

  const openDestination = est => {
    const estId =
      est.businessEstablishment_id ??
      est.business_establishment_id ??
      est._id ??
      null;
    if (!estId) return;
    router.push({ pathname: '/destinations/[id]', params: { id: estId } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.topCopy}>
            <Text style={styles.topTitle}>Destinations</Text>
            <Text style={styles.topSubtitle}>Browse every verified spot in Bohol.</Text>
          </View>
        </View>

        <ImageBackground source={HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>Plan your next escape</Text>
            <Text style={styles.heroTitle}>Discover verified destinations across Bohol</Text>
            <Text style={styles.heroSubtitle}>
              Curated by the Provincial Tourism Office and LGUs.
            </Text>
          </View>
        </ImageBackground>

        <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search destinations"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map(label => {
            const active = label === activeFilter;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(label)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <SectionHeader
          title="Popular right now"
          subtitle="Swipe through the most loved destinations this week."
          actionLabel="See all"
          onPressAction={() => setActiveFilter('All')}
        />

        {loading ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
                <View key={`featured-skeleton-${idx}`} style={styles.skeletonFeaturedCard}>
                  <View style={styles.skeletonFeaturedImage} />
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineSmall} />
                </View>
              ))}
            </ScrollView>

            <View style={styles.list}>
              {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
                <View key={`list-skeleton-${idx}`} style={styles.skeletonListCard}>
                  <View style={styles.skeletonListImage} />
                  <View style={styles.skeletonListBody}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLineSmall} />
                    <View style={styles.skeletonTagRow}>
                      <View style={styles.skeletonTag} />
                      <View style={styles.skeletonTag} />
                      <View style={styles.skeletonTag} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle" size={24} color={colors.primary} />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="compass-outline" size={24} color={colors.primary} />
            <Text style={styles.stateText}>
              No destinations matched the selected filter. Try another tag.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featured.map(entry => (
                <TouchableOpacity
                  key={entry.card.id}
                  activeOpacity={0.9}
                  onPress={() => openDestination(entry.establishment)}
                >
                  <DestinationCard item={entry.card} establishment={entry.establishment} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <SectionHeader
              title="All destinations"
              subtitle="Tap any card to dive deeper."
              compact
            />

            <View style={styles.list}>
              {rest.map(entry => {
                const est = entry.establishment;
                const key =
                  est.businessEstablishment_id ?? est.business_establishment_id ?? entry.card.id;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.listCard}
                    activeOpacity={0.9}
                    onPress={() => openDestination(est)}
                  >
                    <ImageBackground
                      source={entry.card.image}
                      resizeMode="cover"
                      style={styles.listImage}
                      imageStyle={styles.listImageRadius}
                    >
                      <View style={styles.listGradient} />
                    </ImageBackground>

                    <View style={styles.listBody}>
                      <View style={styles.listHeader}>
                        <Text style={styles.listTitle} numberOfLines={2}>
                          {est.name ?? 'Unnamed Establishment'}
                        </Text>
                        <View style={styles.ratingTag}>
                          <Ionicons name="star" size={14} color="#facc15" />
                          <Text style={styles.ratingValue}>
                            {typeof est.rating_avg === 'number' ? est.rating_avg.toFixed(1) : '0.0'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.listMeta} numberOfLines={1}>
                        {est.address || est.municipality_id || 'Bohol'}
                      </Text>

                      <View style={styles.tagRow}>
                        {(est.tag_names ?? entry.card.tags ?? []).slice(0, 3).map(tag => (
                          <View key={`${key}-${tag}`} style={styles.tagChip}>
                            <Text style={styles.tagChipText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: spacing(4),
        paddingHorizontal: spacing(1.5), // new
        gap: spacing(1.5),
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(1),
        width: '100%',
        paddingTop: spacing(0.5),
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    topCopy: { flex: 1, gap: spacing(0.15) },
    topTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 20,
        color: colors.text,
    },
    topSubtitle: {
        fontFamily: 'Inter_400Regular',
        color: colors.muted,
    },
    hero: {
        marginHorizontal: spacing(1.5),
        height: 220,
        borderRadius: radii.xl,
        overflow: 'hidden',
    },
    heroImage: { borderRadius: radii.xl },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,23,42,0.5)',
    },
    heroContent: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing(2),
        gap: spacing(0.5),
    },
    heroEyebrow: {
        fontFamily: 'Inter_600SemiBold',
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1, 
        fontSize: 12,
    },
    heroTitle: {
        fontFamily: 'Inter_700Bold',
        fontSize: 24,
        color: colors.white,
    },
    heroSubtitle: {
        fontFamily: 'Inter_400Regular',
        color: 'rgba(255,255,255,0.9)',
    },
    filterRow: {
        width: '100%',
        gap: spacing(0.75),
    },
    filterChip: {
        paddingHorizontal: spacing(1.25),
        paddingVertical: spacing(0.5),
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.2)',
        backgroundColor: colors.white,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontFamily: 'Inter_500Medium',
        color: colors.text,
    },
    filterTextActive: { color: colors.white },
    featuredRow: {
        paddingHorizontal: spacing(1.5),
        gap: spacing(1),
    },
    stateCard: {
        marginHorizontal: spacing(1.5),
        padding: spacing(1.5),
        borderRadius: spacing(1),
        backgroundColor: colors.white,
        borderColor: 'rgba(108,92,231,0.15)',
        borderWidth: 1,
        alignItems: 'center',
        gap: spacing(0.5),
    },
    stateText: {
        fontFamily: 'Inter_500Medium',
        color: colors.text,
        textAlign: 'center',
    },
    list: {
        paddingHorizontal: spacing(1.5),
        gap: spacing(1),
    },
    listCard: {
        borderRadius: radii.lg,
        backgroundColor: colors.white,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.2)',
    },
    listImage: {
        height: 160,
        width: '100%',
    },
    listImageRadius: {
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
    },
    listGradient: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,23,42,0.15)',
    },
    listBody: {
        padding: spacing(1.25),
        gap: spacing(0.5),
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing(1),
    },
    listTitle: {
        flex: 1,
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
        color: colors.text,
    },
    ratingTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.25),
        backgroundColor: 'rgba(250,204,21,0.12)',
        borderRadius: radii.md,
        paddingHorizontal: spacing(0.75),
        paddingVertical: spacing(0.25),
    },
    ratingValue: {
        fontFamily: 'Inter_600SemiBold',
        color: '#854d0e',
    },
    listMeta: {
        fontFamily: 'Inter_400Regular',
        color: colors.muted,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing(0.5),
        marginTop: spacing(0.5),
    },
    tagChip: {
        borderRadius: radii.md,
        paddingHorizontal: spacing(0.75),
        paddingVertical: spacing(0.25),
        backgroundColor: 'rgba(108,92,231,0.1)',
    },
    tagChipText: {
        fontFamily: 'Inter_500Medium',
        color: colors.primary,
        fontSize: 12,
    },
    searchRow: {
      marginHorizontal: spacing(1.5),
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(0.75),
      borderWidth: 1,
      borderColor: 'rgba(108,92,231,0.2)',
      borderRadius: 999,
      paddingHorizontal: spacing(1.25),
      backgroundColor: colors.white,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontFamily: 'Inter_500Medium',
      color: colors.text,
    },
    skeletonFeaturedCard: {
      width: 240,
      borderRadius: radii.lg,
      backgroundColor: colors.white,
      padding: spacing(1),
      marginRight: spacing(1),
      borderWidth: 1,
      borderColor: 'rgba(108,92,231,0.12)',
      gap: spacing(0.75),
    },
    skeletonFeaturedImage: {
      height: 140,
      borderRadius: radii.md,
      backgroundColor: 'rgba(15,23,42,0.08)',
    },
    skeletonListCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.white,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(148,163,184,0.2)',
    },
    skeletonListImage: {
      height: 160,
      backgroundColor: 'rgba(15,23,42,0.08)',
    },
    skeletonListBody: {
      padding: spacing(1.25),
      gap: spacing(0.5),
    },
    skeletonLineWide: {
      height: 14,
      borderRadius: 7,
      backgroundColor: 'rgba(15,23,42,0.08)',
    },
    skeletonLineSmall: {
      height: 10,
      width: '60%',
      borderRadius: 5,
      backgroundColor: 'rgba(15,23,42,0.08)',
    },
    skeletonTagRow: {
      flexDirection: 'row',
      gap: spacing(0.5),
      marginTop: spacing(0.5),
    },
    skeletonTag: {
      width: 50,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(15,23,42,0.08)',
    },


});
