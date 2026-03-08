import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '../../constants/theme';
import { getTravelHistory } from '../../lib/tourist';

const buildRegion = stops => {
  const coords = (stops ?? [])
    .map(stop => ({
      latitude: stop?.establishment?.latitude ?? stop?.latitude,
      longitude: stop?.establishment?.longitude ?? stop?.longitude,
    }))
    .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (!coords.length) {
    return {
      latitude: 9.85,
      longitude: 124.15,
      latitudeDelta: 1.2,
      longitudeDelta: 1.2,
    };
  }

  if (coords.length === 1) {
    return {
      latitude: coords[0].latitude,
      longitude: coords[0].longitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
  }

  const latitudes = coords.map(item => item.latitude);
  const longitudes = coords.map(item => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.18),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.18),
  };
};

const formatDateRange = itinerary => {
  const start = itinerary?.start_date ? new Date(itinerary.start_date).toLocaleDateString() : 'N/A';
  const end = itinerary?.end_date ? new Date(itinerary.end_date).toLocaleDateString() : start;
  return `${start} - ${end}`;
};

export default function TravelHistory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [payload, setPayload] = useState({
    itineraries: [],
    stats: { totalTrips: 0, totalDestinations: 0, totalBudget: 0, favoriteCategories: [] },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getTravelHistory();
        if (!active) return;
        setPayload({
          itineraries: data?.itineraries ?? [],
          stats: data?.stats ?? { totalTrips: 0, totalDestinations: 0, totalBudget: 0, favoriteCategories: [] },
        });
      } catch (error) {
        console.warn('Failed to load travel history', error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const favoriteChips = useMemo(
    () => (payload.stats?.favoriteCategories ?? []).slice(0, 4),
    [payload.stats]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing(4) }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={payload.itineraries}
        keyExtractor={item => item.itinerary_id ?? item._id}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.heroCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Travel history</Text>
                <Text style={styles.heroSubtitle}>
                  Tap an item to expand trip details.
                </Text>
              </View>
              <Ionicons name="time-outline" size={34} color={colors.primary} />
            </View>

            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Trips</Text>
                <Text style={styles.statValue}>{payload.stats?.totalTrips ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Destinations</Text>
                <Text style={styles.statValue}>{payload.stats?.totalDestinations ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Budget</Text>
                <Text style={styles.statValue}>PHP {Number(payload.stats?.totalBudget ?? 0).toLocaleString()}</Text>
              </View>
            </View>

            {favoriteChips.length ? (
              <View style={styles.favoriteRow}>
                {favoriteChips.map(item => (
                  <View key={item.category} style={styles.favoriteChip}>
                    <Text style={styles.favoriteChipText}>
                      {item.category} · {item.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const itineraryId = item.itinerary_id ?? item._id;
          const isExpanded = expandedId === itineraryId;
          const routePoints = Array.isArray(item.route_geometry) ? item.route_geometry : item.route ?? [];

          return (
            <View style={styles.itemCard}>
              <TouchableOpacity
                style={styles.itemHeader}
                activeOpacity={0.86}
                onPress={() => setExpandedId(prev => (prev === itineraryId ? null : itineraryId))}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title ?? 'Untitled route'}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {formatDateRange(item)} · {(item.stops ?? []).length} stops
                  </Text>
                </View>
                <View style={styles.itemPill}>
                  <Text style={styles.itemPillText}>PHP {Number(item.total_budget ?? 0).toLocaleString()}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.itemBody}>
                  <MapView
                    style={styles.map}
                    pointerEvents="none"
                    initialRegion={buildRegion(item.stops ?? [])}
                  >
                    {(item.stops ?? []).map((stop, index) => {
                      const latitude = stop?.establishment?.latitude ?? stop?.latitude;
                      const longitude = stop?.establishment?.longitude ?? stop?.longitude;
                      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
                      return (
                        <Marker
                          key={`${itineraryId}-${index}`}
                          coordinate={{ latitude, longitude }}
                          title={stop?.establishment?.name ?? stop?.title ?? 'Destination'}
                        />
                      );
                    })}
                    {Array.isArray(routePoints) && routePoints.length > 1 ? (
                      <Polyline
                        coordinates={routePoints.map(point => ({
                          latitude: Number(point.latitude),
                          longitude: Number(point.longitude),
                        }))}
                        strokeWidth={4}
                        strokeColor="rgba(108,92,231,0.55)"
                      />
                    ) : null}
                  </MapView>

                  <View style={styles.stopList}>
                    {(item.stops ?? []).map((stop, index) => (
                      <View key={`${itineraryId}-stop-${index}`} style={styles.stopRow}>
                        <View style={styles.stopMarker}>
                          <Text style={styles.stopMarkerText}>{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stopTitle}>
                            {stop?.establishment?.name ?? stop?.title ?? 'Destination'}
                          </Text>
                          <Text style={styles.stopMeta}>
                            {stop?.establishment?.municipality_id ?? 'Bohol'} · {stop?.establishment?.type ?? 'Experience'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        router.push(`/itinerary/live?data=${encodeURIComponent(JSON.stringify(item))}`)
                      }
                    >
                      <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                      <Text style={styles.actionText}>Replay route</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        router.push(`/share/itinerary/${item.itinerary_id ?? item._id}`)
                      }
                    >
                      <Ionicons name="share-outline" size={16} color={colors.primary} />
                      <Text style={styles.actionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={34} color={colors.primary} />
            <Text style={styles.emptyTitle}>No completed trips yet</Text>
            <Text style={styles.emptyText}>
              Complete an itinerary to see it in your travel history.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  listContent: {
    paddingHorizontal: spacing(1.25),
    paddingBottom: spacing(3),
    gap: spacing(1.2),
  },
  headerWrap: { gap: spacing(1.2), marginTop: spacing(1), marginBottom: spacing(0.5) },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  heroTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 22 },
  heroSubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted },
  statGrid: { flexDirection: 'row', gap: spacing(0.75) },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  statLabel: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 12 },
  statValue: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16, marginTop: spacing(0.3) },
  favoriteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.5) },
  favoriteChip: {
    paddingHorizontal: spacing(0.85),
    paddingVertical: spacing(0.45),
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.12)',
  },
  favoriteChipText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 12 },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    overflow: 'hidden',
  },
  itemHeader: {
    paddingHorizontal: spacing(1.2),
    paddingVertical: spacing(1),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.6),
  },
  itemTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16 },
  itemMeta: { fontFamily: 'Inter_400Regular', color: colors.muted, marginTop: 2 },
  itemPill: {
    borderRadius: 999,
    paddingHorizontal: spacing(0.8),
    paddingVertical: spacing(0.28),
    backgroundColor: 'rgba(108,92,231,0.1)',
  },
  itemPillText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 11 },
  itemBody: { padding: spacing(1.1), gap: spacing(0.9), borderTopWidth: 1, borderTopColor: 'rgba(108,92,231,0.1)' },
  map: { width: '100%', height: 170, borderRadius: radii.md },
  stopList: { gap: spacing(0.7) },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.65) },
  stopMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(108,92,231,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarkerText: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 12 },
  stopTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  stopMeta: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: spacing(0.75), marginTop: spacing(0.2) },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    borderRadius: 999,
    paddingHorizontal: spacing(0.9),
    paddingVertical: spacing(0.45),
  },
  actionText: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
  emptyState: {
    marginTop: spacing(2),
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    alignItems: 'center',
    gap: spacing(0.6),
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 16 },
  emptyText: { fontFamily: 'Inter_400Regular', color: colors.muted, textAlign: 'center' },
});
