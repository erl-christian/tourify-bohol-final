import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../../constants/theme';
import { getTravelHistory } from '../../lib/tourist';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const buildRegion = stops => {
  const coords = stops
    .map(stop => ({
      latitude: stop?.establishment?.latitude,
      longitude: stop?.establishment?.longitude,
    }))
    .filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number');
  if (!coords.length) {
    return {
      latitude: 9.75,
      longitude: 124.1,
      latitudeDelta: 1.5,
      longitudeDelta: 1.5,
    };
  }
  if (coords.length === 1) {
    return {
      latitude: coords[0].latitude,
      longitude: coords[0].longitude,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }
  const latitudes = coords.map(c => c.latitude);
  const longitudes = coords.map(c => c.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.4 || 0.5,
    longitudeDelta: (maxLng - minLng) * 1.4 || 0.5,
  };
};

export default function TravelHistory() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    itineraries: [],
    stats: { totalTrips: 0, totalDestinations: 0, totalBudget: 0, favoriteCategories: [] },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getTravelHistory();
        if (!mounted) return;
        setState({ loading: false, itineraries: data?.itineraries ?? [], stats: data?.stats ?? {} });
      } catch (err) {
        console.error('Failed to load travel history', err);
        if (mounted) setState(prev => ({ ...prev, loading: false }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const favoriteBadges = useMemo(() => {
    const list = state.stats?.favoriteCategories ?? [];
    return list.slice(0, 5);
  }, [state.stats]);

  if (state.loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing(4) }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroTitle}>Travel history</Text>
            <Text style={styles.heroSubtitle}>
              Relive your Bohol journeys, see stats, and share your favorite routes.
            </Text>
          </View>
          <Ionicons name="time-outline" size={36} color={colors.primary} />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completed itineraries</Text>
            <Text style={styles.statValue}>{state.stats?.totalTrips ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Destinations visited</Text>
            <Text style={styles.statValue}>{state.stats?.totalDestinations ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total budget used</Text>
            <Text style={styles.statValue}>
              ₱{Number(state.stats?.totalBudget ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {favoriteBadges.length ? (
          <View style={styles.favoriteCard}>
            <Text style={styles.favoriteTitle}>Top categories you love</Text>
            <View style={styles.favoriteChips}>
              {favoriteBadges.map(item => (
                <View key={item.category} style={styles.favoriteChip}>
                  <Ionicons name="prism-outline" size={14} color={colors.primary} />
                  <Text style={styles.favoriteText}>
                    {item.category} · {item.count} visits
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {state.itineraries.length ? (
          state.itineraries.map(itinerary => (
            <View key={itinerary.itinerary_id ?? itinerary._id} style={styles.itineraryCard}>
              <View style={styles.itineraryHeader}>
                <View>
                  <Text style={styles.itineraryTitle}>{itinerary.title ?? 'Untitled route'}</Text>
                  <Text style={styles.itineraryDates}>
                    {itinerary.start_date ?? 'N/A'} – {itinerary.end_date ?? 'N/A'}
                  </Text>
                </View>
                <View style={styles.itineraryActions}>
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => router.push(`/itinerary/live?data=${encodeURIComponent(
                      JSON.stringify(itinerary)
                    )}`)}
                  >
                    <Ionicons name="navigate-outline" size={14} color={colors.primary} />
                    <Text style={styles.actionText}>Replay route</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => router.push(`/share/itinerary/${itinerary.itinerary_id}`)}
                  >
                    <Ionicons name="share-outline" size={14} color={colors.primary} />
                    <Text style={styles.actionText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.mapWrapper}>
                <MapView
                  style={styles.map}
                  pointerEvents="none"
                  initialRegion={buildRegion(itinerary.stops ?? [])}
                >
                  {(itinerary.stops ?? []).map((stop, idx) => {
                    const lat = stop?.establishment?.latitude;
                    const lng = stop?.establishment?.longitude;
                    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
                    return (
                      <Marker
                        key={stop.business_establishment_id ?? idx}
                        coordinate={{ latitude: lat, longitude: lng }}
                        title={stop.establishment?.name ?? 'Destination'}
                        description={stop.establishment?.address ?? ''}
                      >
                        <View style={styles.markerBubble}>
                          <Text style={styles.markerLabel}>{String.fromCharCode(65 + idx)}</Text>
                        </View>
                      </Marker>
                    );
                  })}
                  {(itinerary.route ?? []).length > 1 ? (
                    <Polyline
                      coordinates={itinerary.route.map(point => ({
                        latitude: point.latitude,
                        longitude: point.longitude,
                      }))}
                      strokeWidth={4}
                      strokeColor="rgba(108,92,231,0.6)"
                    />
                  ) : null}
                </MapView>
              </View>

              <View style={styles.timeline}>
                {(itinerary.stops ?? []).length ? (
                  itinerary.stops.map((stop, idx) => (
                    <View key={stop.business_establishment_id ?? idx} style={styles.timelineRow}>
                      <View style={styles.timelineMarker}>
                        <Ionicons name="location" size={16} color={colors.primary} />
                        <View style={styles.timelineConnector} />
                      </View>
                      <View style={styles.timelineDetails}>
                        <Text style={styles.timelineTitle}>
                          {String.fromCharCode(65 + idx)} · {stop.establishment?.name ?? 'Destination'}
                        </Text>
                        <Text style={styles.timelineSubtitle}>
                          {stop.establishment?.municipality_id ?? 'Bohol'} ·{' '}
                          {stop.establishment?.type ?? 'Experience'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.bodyText}>No stop details saved for this itinerary.</Text>
                )}
              </View>

              <View style={styles.metaFooter}>
                <Text style={styles.metaFooterText}>
                  Total budget recorded: ₱{Number(itinerary.total_budget ?? 0).toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={styles.linkButton}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/feedback/compose',
                      params: {
                        estId:
                          itinerary.stops?.[0]?.business_establishment_id ??
                          itinerary.stops?.[0]?.establishment?.businessEstablishment_id ??
                          '',
                        estName: itinerary.stops?.[0]?.establishment?.name ?? 'Bohol destination',
                        itineraryId: itinerary.itinerary_id ?? itinerary._id ?? '',
                      },
                    })
                  }
                >
                  <Ionicons name="pencil" size={14} color={colors.primary} />
                  <Text style={styles.linkButtonText}>Write a testimonial</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>No completed trips yet</Text>
            <Text style={styles.emptySubtitle}>
              Finish an itinerary to see it here. Your travel map and stats appear as soon as you mark a trip complete.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(1.5), gap: spacing(1.5), paddingBottom: spacing(4) },
  hero: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
  heroSubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 20 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    minWidth: width / 3 - spacing(2),
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    gap: spacing(0.5),
  },
  statLabel: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 12 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text },
  favoriteCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.1)',
    gap: spacing(1),
  },
  favoriteTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  favoriteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.75) },
  favoriteChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.12)',
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
  },
  favoriteText: { fontFamily: 'Inter_500Medium', color: colors.primary },
  itineraryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    gap: spacing(1.2),
  },
  itineraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(1) },
  itineraryTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 18 },
  itineraryDates: { fontFamily: 'Inter_400Regular', color: colors.muted },
  itineraryActions: { flexDirection: 'row', gap: spacing(0.75) },
  actionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
  },
  actionText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 13 },
  mapWrapper: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    height: 200,
  },
  map: { flex: 1 },
  markerBubble: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
  timeline: { gap: spacing(1) },
  timelineRow: { flexDirection: 'row', gap: spacing(1) },
  timelineMarker: { alignItems: 'center' },
  timelineConnector: { width: 1, flex: 1, backgroundColor: 'rgba(148,163,184,0.5)', marginTop: spacing(0.25) },
  timelineDetails: { flex: 1, gap: spacing(0.25) },
  timelineTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  timelineSubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  bodyText: { fontFamily: 'Inter_400Regular', color: colors.muted },
  metaFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaFooterText: { fontFamily: 'Inter_500Medium', color: colors.muted },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.4) },
  linkButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 13 },
  empty: {
    alignItems: 'center',
    gap: spacing(1),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: 'rgba(241,245,249,0.4)',
    padding: spacing(2),
  },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: colors.text },
  emptySubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, textAlign: 'center', lineHeight: 18 },
});
