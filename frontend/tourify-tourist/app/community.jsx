import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
// import MapView, { Marker, Polyline } from 'react-native-maps';
import { MapView, Marker, Polyline } from '../components/MapLibreMap';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../constants/theme';
import SectionHeader from '../components/SectionHeader';
import { fetchSharedItineraries } from '../lib/tourist';

const buildCoordsFromStops = stops =>
  (stops ?? [])
    .map(stop => ({
      latitude: stop.latitude,
      longitude: stop.longitude,
    }))
    .filter(coord => Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude));

const buildRegion = coords => {
  if (!coords.length) {
    return { latitude: 9.75, longitude: 124.1, latitudeDelta: 1.5, longitudeDelta: 1.5 };
  }
  if (coords.length === 1) {
    return {
      latitude: coords[0].latitude,
      longitude: coords[0].longitude,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.4 || 0.5,
    longitudeDelta: (maxLng - minLng) * 1.4 || 0.5,
  };
};

export default function CommunityItineraries() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const shared = await fetchSharedItineraries(20);
        if (mounted) setItems(shared);
      } catch (err) {
        Alert.alert('Unable to load community trips', err?.message ?? 'Please try again later.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const categoryPills = useMemo(() => {
    const counts = new Map();
    items.forEach(itinerary =>
      (itinerary.stops ?? []).forEach(stop => {
        const label = stop.type || stop.category || stop.municipality || 'Destination';
        counts.set(label, (counts.get(label) || 0) + 1);
      })
    );
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));
  }, [items]);

  const mapMarkers = useMemo(() => {
    const points = [];
    items.forEach(itinerary =>
      (itinerary.stops ?? []).forEach(stop => {
        if (Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)) {
          points.push({ ...stop, itineraryId: itinerary._id });
        }
      })
    );
    return points;
  }, [items]);

  const overviewRegion = useMemo(() => buildRegion(mapMarkers), [mapMarkers]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader
          title="Community itineraries"
          subtitle="See the exact routes other tourists chose to share."
        />

        <View style={styles.mapWrapper}>
          <MapView style={styles.overviewMap} initialRegion={overviewRegion}>
            {mapMarkers.map(marker => (
              <Marker
                key={`${marker.itineraryId}-${marker.business_establishment_id ?? marker.name}`}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={marker.name}
                description={marker.municipality}
              />
            ))}
          </MapView>
        </View>

        {categoryPills.length ? (
          <View style={styles.pillTray}>
            {categoryPills.map(pill => (
              <View key={pill.label} style={styles.pill}>
                <Ionicons name="triangle-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.pillText}>
                  {pill.label} • {pill.count} visits
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loaderText}>Loading shared routes...</Text>
          </View>
        ) : items.length ? (
          items.map(item => {
            const stopCoords = buildCoordsFromStops(item.stops);
            const polylineCoords =
              item.route_geometry?.length ? item.route_geometry : stopCoords;
            const region = buildRegion(polylineCoords);
            const firstStop = item.stops?.[0];
            const sharedDate = item.shared_at
              ? new Date(item.shared_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Recently shared';

            return (
              <View key={item._id} style={styles.card}>
                <Text style={styles.tripTitle}>{item.title ?? 'Shared itinerary'}</Text>
                <Text style={styles.tripMeta}>{sharedDate}</Text>

                <View style={styles.mapWrapper}>
                  <MapView
                    style={styles.map}
                    initialRegion={region}
                    scrollEnabled
                    zoomEnabled
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                  >
                    {polylineCoords.length > 1 ? (
                      <Polyline
                        coordinates={polylineCoords}
                        strokeColor={colors.primary}
                        strokeWidth={4}
                        lineCap="round"
                        lineJoin="round"
                      />
                    ) : null}
                    {stopCoords.map((coord, idx) => (
                      <Marker
                        key={`${item._id}-marker-${idx}`}
                        coordinate={coord}
                        title={item.stops?.[idx]?.name}
                        description={item.stops?.[idx]?.municipality}
                      >
                        <View style={styles.markerBubble}>
                          <Text style={styles.markerLabel}>{String.fromCharCode(65 + idx)}</Text>
                        </View>
                      </Marker>
                    ))}
                  </MapView>
                </View>

                {firstStop ? (
                  <View style={styles.firstStop}>
                    <Ionicons name="location-outline" size={16} color={colors.primaryDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName}>{firstStop.name}</Text>
                      <Text style={styles.stopMeta}>
                        {firstStop.municipality ?? 'Bohol'} • {firstStop.type ?? 'Destination'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {item.caption ? <Text style={styles.caption}>"{item.caption}"</Text> : null}
              </View>
            );
          })
        ) : (
          <View style={styles.empty}>
            <Ionicons name="walk-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyTitle}>No shared trips yet</Text>
            <Text style={styles.emptyText}>
              Once tourists publish their itineraries, you will see them here.
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
  mapWrapper: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  overviewMap: { height: 220 },
  pillTray: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.25),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.1)',
    paddingHorizontal: spacing(0.9),
    paddingVertical: spacing(0.35),
  },
  pillText: { fontFamily: 'Inter_500Medium', color: colors.primaryDark },
  loader: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  loaderText: { fontFamily: 'Inter_500Medium', color: colors.muted },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  tripTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 17 },
  tripMeta: { fontFamily: 'Inter_400Regular', color: colors.muted },
  map: { height: 200, width: '100%' },
  markerBubble: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: { fontFamily: 'Inter_600SemiBold', color: colors.primary, fontSize: 12 },
  firstStop: {
    flexDirection: 'row',
    gap: spacing(0.5),
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(108,92,231,0.08)',
    paddingTop: spacing(0.75),
  },
  stopName: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  stopMeta: { fontFamily: 'Inter_400Regular', color: colors.muted },
  caption: { fontFamily: 'Inter_400Italic', color: colors.text },
  empty: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    alignItems: 'center',
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', color: colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', color: colors.muted, textAlign: 'center' },
});
