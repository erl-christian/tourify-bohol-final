import { useRouter, useLocalSearchParams  } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import DestinationCard from '../../components/DestinationCard';
import SectionHeader from '../../components/SectionHeader';
import {
  getRecommendations,
  generateRecommendations,
  enrichRecommendations,
  checkinStop,
  completeItinerary,
} from '../../lib/tourist';
import { optimizeRoute, saveItinerary, listSavedItineraries } from '../../lib/itinerary';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  Camera,
  CameraType,
  useCameraPermissions,
} from 'expo-camera';
import * as Linking from 'expo-linking';

import useSafeBack from '../../hooks/useSafeBack';


const PENDING_KEY = '@tourify/pending_itinerary_stops';
const FALLBACK_IMAGE = require('../../assets/auth-hero.jpg');

const initialRegion = {
  latitude: 9.75,
  longitude: 124.1,
  latitudeDelta: 0.6,
  longitudeDelta: 0.6,
};

const formatDuration = mins => {
  if (!mins && mins !== 0) return '—';
  const hours = Math.floor(mins / 60);
  const minutes = Math.round(mins % 60);
  if (!hours) return `${minutes} mins`;
  return `${hours}h ${minutes}m`;
};

const formatDistance = km => {
  if (!km && km !== 0) return '—';
  return `${km.toFixed(1)} km`;
};

const formatISODate = date => date.toISOString().slice(0, 10);

export default function ItineraryPlanner() {
  const router = useRouter();
  const safeBack = useSafeBack();
  
  const { profile } = useAuth();
  const { itineraryId } = useLocalSearchParams(); 

  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [plan, setPlan] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [alternates, setAlternates] = useState([]);
  const [budget, setBudget] = useState('3500');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [title, setTitle] = useState('My Bohol Day Trip');
  const [savedPlans, setSavedPlans] = useState([]);
  const [roadPolyline, setRoadPolyline] = useState([]);
  const [recommendationFilter, setRecommendationFilter] = useState('popular'); // 'popular' | 'hidden'
  const [userLocation, setUserLocation] = useState(null);

  const segmentPalette = ['#facc15', '#60a5fa', '#8b5cf6', '#34d399', '#f87171'];
  const buildLabel = index => String.fromCharCode(65 + index); // A, B, C …
  const [isLocating, setIsLocating] = useState(true);

  const mapRef = useRef(null);
  const canOptimise = plan.length >= 1;

  const [scannerVisible, setScannerVisible] = useState(false);
  const [activeStop, setActiveStop] = useState(null);
  const [stopOptionsVisible, setStopOptionsVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false); // optional, for UI feedback

  const openStopOptions = stop => {
    setActiveStop(stop);
    setStopOptionsVisible(true);
  };

  const closeStopOptions = () => setStopOptionsVisible(false);

  const loadRecommendations = async () => {
    if (!profile?.tourist_profile_id) return;
    setLoadingRecommendations(true);
    try {
      let items = await getRecommendations(profile.tourist_profile_id, 8);
      if (!items.length) {
        const { items: generated } = await generateRecommendations({
          tourist_profile_id: profile.tourist_profile_id,
          preferences: profile.preferences ?? [],
          limit: 8,
        });
        items = generated;
      }
      const enriched = await enrichRecommendations(items);
      setSuggestions(enriched);
    } catch (err) {
      console.error(err);
      Alert.alert('Oops', 'We could not load suggestions right now.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const loadSaved = async () => {
    try {
      const results = await listSavedItineraries();
      setSavedPlans(results.slice(0, 5));
    } catch (err) {
      console.warn('Unable to load saved itineraries', err);
    }
  };

  useEffect(() => {
    if (scannerVisible && !cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, [scannerVisible, cameraPermission?.granted, requestCameraPermission]);

  useEffect(() => {
    loadRecommendations();
    loadSaved();
  }, [profile?.tourist_profile_id]);

  useEffect(() => {
    let watcher;

    const request = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          setIsLocating(false);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        setIsLocating(false);

        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          update =>
            setUserLocation({
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            })
        );
      } catch (err) {
        console.warn('Unable to determine location', err);
        setIsLocating(false);
      }
    };

    request();
    return () => watcher?.remove?.();
  }, []);

  const haversineDist = (a, b) => {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  };

  
  const sortedPlan = useMemo(
    () => [...plan].sort((a, b) => (a.preferredOrder ?? 0) - (b.preferredOrder ?? 0)),
    [plan]
  );

  const findNearestIndex = (target, polyline) => {
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    polyline.forEach((point, idx) => {
      const dist = haversineDist(target, point);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };
  
  const mapMarkers = useMemo(
    () =>
      sortedPlan
        .map((stop, index) => {
          const est = stop.establishment ?? {};
          const lat = est.latitude ?? est.location?.coordinates?.[1];
          const lng = est.longitude ?? est.location?.coordinates?.[0];
          if (typeof lat !== 'number' || typeof lng !== 'number') return null;

          return {
            id: stop.id ?? `plan-${index}`,
            title: est.name,
            subtitle: stop.reason ?? est.type ?? 'Scheduled stop',
            latitude: lat,
            longitude: lng,
            order: index,
            label: buildLabel(index),
          };
        })
        .filter(Boolean),
    [sortedPlan]
  );

  const routeSegments = useMemo(() => {
    const markersWithOrigin = userLocation
      ? [
          {
            id: 'origin',
            label: 'Start',
            order: -1,
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          ...mapMarkers,
        ]
      : mapMarkers;

    if (roadPolyline.length > 1 && markersWithOrigin.length > 1) {
      const stopIndices = markersWithOrigin
        .map(marker => ({
          marker,
          index: findNearestIndex(
            { latitude: marker.latitude, longitude: marker.longitude },
            roadPolyline
          ),
        }))
        .sort((a, b) => a.marker.order - b.marker.order);

      const segments = [];
      for (let i = 0; i < stopIndices.length - 1; i += 1) {
        const startIdx = stopIndices[i].index;
        const endIdx = stopIndices[i + 1].index;
        const slice =
          startIdx <= endIdx
            ? roadPolyline.slice(startIdx, endIdx + 1)
            : roadPolyline.slice(endIdx, startIdx + 1).reverse();

        segments.push({
          id: `${stopIndices[i].marker.id}-to-${stopIndices[i + 1].marker.id}`,
          color: segmentPalette[i % segmentPalette.length],
          coordinates: slice,
        });
      }
      return segments;
    }

    if (markersWithOrigin.length >= 2) {
      return markersWithOrigin.slice(0, -1).map((marker, idx) => ({
        id: `${marker.id}-to-${markersWithOrigin[idx + 1].id}`,
        color: segmentPalette[idx % segmentPalette.length],
        coordinates: [
          { latitude: marker.latitude, longitude: marker.longitude },
          {
            latitude: markersWithOrigin[idx + 1].latitude,
            longitude: markersWithOrigin[idx + 1].longitude,
          },
        ],
      }));
    }

    return [];
  }, [roadPolyline, mapMarkers, userLocation]);

  useEffect(() => {
    if (!mapRef.current || !mapMarkers.length) return;

    const coords = mapMarkers.map(marker => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
    }));

    if (userLocation) {
      coords.push({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    }

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }, [mapMarkers, userLocation]);


  const buildStopPayload = (item, index) => {
    const est = item.establishment ?? {};
    const rating =
      typeof est.rating_avg === 'number'
        ? est.rating_avg
        : typeof item.rating === 'number'
        ? item.rating
        : null;

    return {
      id: item.id ?? est.businessEstablishment_id ?? `stop-${index}`,
      title: est.name ?? `Stop ${index + 1}`,
      municipality: est.address ?? est.municipality_id ?? 'Bohol',
      rating: rating != null ? rating.toFixed(1) : null,
      order: index + 1,
    };
  };

  const popularSuggestions = useMemo(() => {
  return (suggestions ?? [])
    .map(item => {
      const est = item.establishment ?? {};
      const rating = Number(est.rating_avg ?? item.rating ?? 0);
      const visits = Number(est.rating_count ?? item.rating_count ?? 0);
      return { item, rating, visits };
    })
    .sort((a, b) => {
      if (b.visits === a.visits) return b.rating - a.rating;
      return b.visits - a.visits;
    })
    .map(entry => entry.item);
}, [suggestions]);

  const hiddenGems = useMemo(() => {
    return (suggestions ?? [])
      .map(item => {
        const est = item.establishment ?? {};
        const rating = Number(est.rating_avg ?? item.rating ?? 0);
        const visits = Number(est.rating_count ?? item.rating_count ?? 0);
        return { item, rating, visits };
      })
      .filter(entry => entry.rating >= 4.3 && entry.visits <= 15)
      .sort((a, b) => b.rating - a.rating)
      .map(entry => entry.item);
  }, [suggestions]);

  

  const filteredSuggestions =
    recommendationFilter === 'popular' ? popularSuggestions : hiddenGems;


  const polylineCoords = mapMarkers.map(marker => ({
    latitude: marker.latitude,
    longitude: marker.longitude,
  }));


  const handleAddToPlan = (item, options = {}) => {
    const { silentDuplicate = false } = options;

    setPlan(prev => {
      const incomingId =
        item.id ??
        item.travel_recommendation_id ??
        item.business_establishment_id ??
        item.establishment?.business_establishment_id;

      const exists =
        incomingId &&
        prev.some(existing => {
          const existingId =
            existing.id ??
            existing.travel_recommendation_id ??
            existing.business_establishment_id ??
            existing.establishment?.business_establishment_id;
          return existingId && existingId === incomingId;
        });

      if (exists) {
        if (!silentDuplicate) {
          Alert.alert('Already added', 'This destination is already in your itinerary.');
        }
        return prev;
      }

      const nextOrder =
        prev.length === 0
          ? 0
          : Math.max(...prev.map(stop => stop.preferredOrder ?? -1)) + 1;

      return [
        ...prev,
        {
          ...item,
          preferredOrder: nextOrder,
        },
      ];
    });
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (!activeStop) return;
    setScannerVisible(false);

    try {
      let establishmentId =
        activeStop.business_establishment_id ??
        activeStop.establishment?.business_establishment_id ??
        '';

      try {
        if (data.startsWith('{')) {
          const parsed = JSON.parse(data);
          establishmentId = parsed.business_establishment_id ?? establishmentId;
        } else if (data.startsWith('http')) {
          const params = Linking.parse(data).queryParams;
          establishmentId = params.est ?? establishmentId;
        }
      } catch (err) {
        console.warn('Unable to parse QR payload, falling back to stop ID');
      }

      if (!establishmentId) throw new Error('Invalid QR code');

      const response = await checkinStop(itineraryId, establishmentId);
      const updatedItinerary = response?.itinerary;

      if (updatedItinerary) {
        setPlan(updatedItinerary.stops); // refresh stops in state

        if (response?.allVisited && updatedItinerary.status !== 'Completed') {
          Alert.alert(
            'All stops visited!',
            'Would you like to mark this itinerary as completed now?',
            [
              { text: 'Not yet' },
              {
                text: 'Mark as completed',
                onPress: async () => {
                  await completeItinerary(itineraryId);
                  loadSaved(); // reuse your existing refresh
                },
              },
            ]
          );
        } else {
          Alert.alert('Check-in recorded', 'Enjoy your stay!');
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Check-in failed', err.response?.data?.message ?? err.message ?? 'Please try again.');
    } finally {
      setActiveStop(null);
    }
  };

  const handleManualVisited = async stop => {
    try {
      const estId =
        stop.business_establishment_id ??
        stop.establishment?.business_establishment_id ??
        stop.establishment?.businessEstablishment_id ??
        stop.id;

      if (!estId) throw new Error('Missing establishment id');

      closeStopOptions();
      await checkinStop(itineraryId, estId);

      const updated = await getItinerary(itineraryId); // or reuse your existing refresh logic
      setPlan(updated.stops);
    } catch (err) {
      Alert.alert('Unable to mark visited', err.message ?? 'Please try again.');
    }
  };


  useEffect(() => {
    const consumePending = async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        if (!raw) return;

        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length) {
          items.forEach(item => handleAddToPlan(item, { silentDuplicate: true }));
          await AsyncStorage.removeItem(PENDING_KEY);
          Alert.alert('Itinerary updated', 'Destinations from Explore have been added.');
        } else {
          await AsyncStorage.removeItem(PENDING_KEY);
        }
      } catch (err) {
        console.warn('Failed to sync pending itinerary stops', err);
      }
    };

    consumePending();
  }, []);

  const handleRemove = id => {
    setPlan(prev =>
      prev
        .filter(item => item.id !== id)
        .map((item, index) => ({ ...item, preferredOrder: index }))
    );
  };

  const openScanner = stop => {
    setActiveStop(stop);
    setScannerVisible(true);
  };
  
  const handleSave = async () => {
    if (!sortedPlan.length) {
      Alert.alert('Nothing to save', 'Add destinations to your itinerary first.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Missing dates', 'Please provide both a start and an end date.');
      return;
    }

    const serializableStops = sortedPlan
      .map((item, index) => {
        const est = item.establishment ?? {};
        const latitude = est.latitude ?? est.location?.coordinates?.[1];
        const longitude = est.longitude ?? est.location?.coordinates?.[0];
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

        return {
          id:
            item.business_establishment_id ??
            item.businessEstablishment_id ??
            est.businessEstablishment_id ??
            item.id ??
            `stop-${index}`,
          title: est.name ?? `Stop ${index + 1}`,
          municipality: est.address ?? est.municipality_id ?? 'Bohol',
          latitude,
          longitude,
          order: index,
        };
      })
      .filter(Boolean);

    if (!serializableStops.length) {
      Alert.alert('Missing coordinates', 'Each stop needs valid coordinates before saving.');
      return;
    }

    setSaving(true);
    try {
      const response = await saveItinerary({
        title,
        start_date: formatISODate(startDate),
        end_date: formatISODate(endDate),
        total_budget: Number(budget) || null,
        stops: sortedPlan.map((item, index) => ({
          order: index + 1,
          business_establishment_id:
            item.business_establishment_id ??
            item.businessEstablishment_id ??
            item.establishment?.business_establishment_id,
        })),
      });

      loadSaved(); // refresh “Saved itineraries”
      const livePayload = encodeURIComponent(
        JSON.stringify({
          itineraryId: response?.itinerary?.itinerary_id ?? null,
          title,
          start_date: formatISODate(startDate),
          end_date: formatISODate(endDate),
          stops: serializableStops,
          route: roadPolyline,
          summary: routeSummary,
          origin: userLocation,
        })
      );

      router.push({
        pathname: '/itinerary/live',
        params: { data: livePayload },
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Cannot save itinerary', err.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };


  const handleOptimise = async () => {
    if (!sortedPlan.length) return;
    if (!userLocation) {
      Alert.alert('Locating you', 'Turn on location services to optimise from your current position.');
      return;
    }
    setLoadingRoute(true);

    try {
      
      const payload = {
      title,
      total_budget: Number(budget) || null,
      start_date: formatISODate(startDate),
      end_date: formatISODate(endDate),
      origin: {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      stops: sortedPlan.map((item, index) => {
        const est = item.establishment ?? {};
        const latitude = est.latitude ?? est.location?.coordinates?.[1];
        const longitude = est.longitude ?? est.location?.coordinates?.[0];
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          throw new Error('One of the selected stops is missing coordinates.');
        }

        return {
          order: index,
          preferred_order: item.preferredOrder ?? index,
          business_establishment_id:
            item.business_establishment_id ??
            item.businessEstablishment_id ??
            est.businessEstablishment_id,
          latitude,
          longitude,
        };
      }),
      manual_order: sortedPlan.every(item => typeof item.preferredOrder === 'number'),
    };

      const result = await optimizeRoute(payload);
      console.log('Route geometry points:', result?.route_geometry?.length);
      if (Array.isArray(result?.route_geometry)) {
        console.log('Example route coords:', result.route_geometry.slice(0, 3));
      }

      const hasPolyline =
        Array.isArray(result?.route_geometry) && result.route_geometry.length > 1;

      if (!hasPolyline && sortedPlan.length === 1) {
        const onlyStop = sortedPlan[0];
        const est = onlyStop.establishment ?? {};
        const latitude = est.latitude ?? est.location?.coordinates?.[1];
        const longitude = est.longitude ?? est.location?.coordinates?.[0];

        const fallbackPolyline = [
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude, longitude },
        ];

        setRoadPolyline(fallbackPolyline);
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(fallbackPolyline, {
            edgePadding: { top: 64, right: 64, bottom: 64, left: 64 },
            animated: true,
          });
        }

        setRouteSummary(
          result?.summary ?? {
            distance_km: 0,
            duration_minutes: 0,
          }
        );
        setLoadingRoute(false);
        return;
      }

      if (Array.isArray(result?.orderedStops) && !payload.manual_order) {
        const reordered = result.orderedStops
          .map(stop =>
            plan.find(
              item =>
                item.business_establishment_id === stop.business_establishment_id ||
                item.establishment?.business_establishment_id === stop.business_establishment_id
            )
          )
          .filter(Boolean)
          .map((item, idx) => ({ ...item, preferredOrder: idx }));

        if (reordered.length === plan.length) {
          setPlan(reordered);
        }
      }

      if (Array.isArray(result?.route_geometry) && result.route_geometry.length > 1) {
        setRoadPolyline(result.route_geometry);
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(result.route_geometry, {
            edgePadding: { top: 64, right: 64, bottom: 64, left: 64 },
            animated: true,
          });
        }
      } else {
        setRoadPolyline([]);
      }

      setRouteSummary(result?.summary ?? null);
    } catch (err) {
      console.error(err);
      Alert.alert('Route optimisation failed', err.message ?? 'Please try again.');
      setRoadPolyline([]);
    } finally {
      setLoadingRoute(false);
    }
  };


  const handleDateChange = (event, selectedDate, type) => {
    if (type === 'start') {
      setShowStartPicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
        if (selectedDate > endDate) {
          setEndDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000));
        }
      }
    } else {
      setShowEndPicker(false);
      if (selectedDate) {
        const normalized = selectedDate < startDate ? startDate : selectedDate;
        setEndDate(normalized);
      }
    }
  };

  const renderSuggestion = (item, index) => {
    const est = item.establishment ?? item;
    const cardPayload = {
      id: item.travel_recommendation_id ?? est.businessEstablishment_id ?? item._id,
      image:
        est.coverImage || est.photos?.[0]
          ? { uri: est.coverImage ?? est.photos?.[0] }
          : FALLBACK_IMAGE,
      title: est.name ?? 'Discover Bohol',
      municipality: est.municipality_id ?? est.address ?? 'Bohol',
      tags: est.tag_names ?? (est.type ? [est.type] : ['Recommended']),
      rating: typeof est.rating_avg === 'number' ? est.rating_avg : 0,
      reason: item.reason ?? 'Curated for your interests.',
    };

    const suggestionKey =
      cardPayload.id ??
      item.travel_recommendation_id ??
      item.business_establishment_id ??
      `suggestion-${index}`;

    return (
      <View key={suggestionKey} style={styles.suggestionCard}>
        <DestinationCard item={cardPayload} />
        <TouchableOpacity
          style={styles.suggestionButton}
          onPress={() => handleAddToPlan(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.suggestionButtonText}>Add to itinerary</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLocating && !userLocation) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your route…</Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Plan your route</Text>
            <Text style={styles.subtitle}>Add destinations and let Tourify optimise the journey.</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={safeBack} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.formBlock}>
          <View style={styles.inputColumn}>
            <Text style={styles.inputLabel}>Itinerary name</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Name this plan"
            />
          </View>

          <View style={[styles.inputRow, styles.dateRow]}>
            <View style={styles.inputColumn}>
              <Text style={styles.inputLabel}>Start date</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.pickerButton}
                onPress={() => setShowStartPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose start date"
              >
                <Text style={styles.pickerButtonText}>{formatISODate(startDate)}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="calendar"
                  minimumDate={new Date()}
                  onChange={(event, date) => handleDateChange(event, date, 'start')}
                />
              )}
            </View>

            <View style={styles.inputColumn}>
              <Text style={styles.inputLabel}>End date</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.pickerButton}
                onPress={() => setShowEndPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose end date"
              >
                <Text style={styles.pickerButtonText}>{formatISODate(endDate)}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="calendar"
                  minimumDate={startDate}
                  onChange={(event, date) => handleDateChange(event, date, 'end')}
                />
              )}
            </View>
          </View>

          <View style={styles.inputColumn}>
            <Text style={styles.inputLabel}>Daily budget (₱)</Text>
            <TextInput
              style={styles.textInput}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>

        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsCompass
            showsPointsOfInterest={false}
            toolbarEnabled={false}
          >
            {roadPolyline.length > 1 && (
              <Polyline coordinates={roadPolyline} strokeColor="rgba(15,23,42,0.2)" strokeWidth={3} />
            )}

            {routeSegments.map(segment => (
              <Polyline
                key={segment.id}
                coordinates={segment.coordinates}
                strokeColor={segment.color}
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {mapMarkers.map(marker => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={`${marker.label}. ${marker.title}`}
                description={marker.subtitle}
              >
                <View
                  style={[
                    styles.markerBubble,
                    { backgroundColor: segmentPalette[marker.order % segmentPalette.length] },
                  ]}
                >
                  <Text style={styles.markerText}>{marker.label}</Text>
                </View>
              </Marker>
            ))}

            {userLocation ? (
              <Marker coordinate={userLocation} title="You are here" pinColor="#ff6b6b" />
            ) : null}

          </MapView>
          <View style={styles.summaryCard}>
            <TouchableOpacity
              style={styles.mapLocateButton}
              onPress={() => {
                if (userLocation && mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    },
                    500
                  );
                } else {
                  Alert.alert('Location unavailable', 'We have not determined your position yet.');
                }
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={18} color={colors.primary} />
              <Text style={styles.mapLocateText}>Locate me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optimizeButton, (!canOptimise || loadingRoute) && styles.optimizeButtonDisabled]}
              onPress={handleOptimise}
              disabled={!canOptimise || loadingRoute}
              activeOpacity={0.85}
            >
              {loadingRoute ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={16} color={colors.white} />
                  <Text style={styles.optimizeButtonText}>Optimise route</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.summaryRow}>
              <Ionicons name="walk" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>
                Distance: {formatDistance(routeSummary?.distance_km)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.summaryText}>
                Travel time: {formatDuration(routeSummary?.duration_minutes)}
              </Text>
            </View>
          </View>
        </View>

        <SectionHeader
          title="Suggested destinations"
          subtitle="Handpicked for you by Tourify."
          actionSlot={
            <TouchableOpacity onPress={loadRecommendations} disabled={loadingRecommendations}>
              <Text style={styles.linkText}>Refresh</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.filterPillsRow}>
          {[
            { id: 'popular', label: 'Popular picks' },
            { id: 'hidden', label: 'Hidden gems' },
          ].map(option => {
            const isActive = recommendationFilter === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setRecommendationFilter(option.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sortedPlan.length ? (
          <DraggableFlatList
            data={sortedPlan}
            keyExtractor={item =>
              item.id ?? item.business_establishment_id ?? `stop-${item.preferredOrder}`
            }
            horizontal
            contentContainerStyle={styles.stopScroller}
            showsHorizontalScrollIndicator={false}
            onDragEnd={({ data }) => {
              const reindexed = data.map((item, index) => ({
                ...item,
                preferredOrder: index,
              }));
              setPlan(reindexed);
            }}
            
            renderItem={({ item, index, drag, isActive }) => {
              const stop = buildStopPayload(item, index);
              return (
                <ScaleDecorator>
                  <TouchableOpacity
                      onPress={() => openStopOptions(item)}
                      onLongPress={drag}
                      disabled={isActive}
                      style={[styles.stopChip, isActive && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
                      activeOpacity={0.9}
                  >
                  <View style={styles.stopActionsRow}>
                      <TouchableOpacity
                        style={[styles.stopActionButton, item.visited && styles.stopActionVisited]}
                        onPress={() => openScanner(item)}
                        disabled={item.visited}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={item.visited ? 'checkmark-circle' : 'qr-code-outline'}
                          size={16}
                          color={item.visited ? '#22c55e' : colors.primary}
                        />
                        <Text style={styles.stopActionText}>{item.visited ? 'Visited' : 'Scan QR'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.stopHeader}>
                      <Text style={styles.stopOrder}>{buildLabel(index)}</Text>
                      <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={8}>
                        <Ionicons name="close" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.stopTitle} numberOfLines={2}>
                      {stop.title}
                    </Text>

                    <Text style={styles.stopMeta} numberOfLines={1}>
                      {stop.municipality}
                    </Text>

                    {stop.rating ? (
                      <View style={styles.stopRating}>
                        <Ionicons name="star" size={14} color="#facc15" />
                        <Text style={styles.stopRatingText}>{stop.rating}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  <View style={styles.stopActions}>
                    <TouchableOpacity
                      style={styles.stopActionButton}
                      onPress={() =>
                        router.push({
                          pathname: '/feedback/compose',
                          params: {
                            estId:
                              item.business_establishment_id ??
                              item.businessEstablishment_id ??
                              item.establishment?.business_establishment_id,
                            estName: stop.title,
                            itineraryId: itineraryId ?? '',
                          },
                        })
                      }
                      disabled={!itineraryId}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
                      <Text style={styles.stopActionText}>
                        {itineraryId ? 'Write feedback' : 'Save itinerary to review'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScaleDecorator>
              );
            }}
          />
        ) : (
          <View style={styles.emptyTimeline}>
            <Ionicons name="calendar-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyTimelineTitle}>No stops yet</Text>
            <Text style={styles.emptyTimelineSubtitle}>
              Add destinations from the suggestions below and watch them appear on the map.
            </Text>
          </View>
        )}

        <SectionHeader
          title="Suggested destinations"
          subtitle="Handpicked for you by Tourify."
          actionSlot={
            <TouchableOpacity onPress={loadRecommendations} disabled={loadingRecommendations}>
              <Text style={styles.linkText}>Refresh</Text>
            </TouchableOpacity>
          }
        />

        {loadingRecommendations ? (
          <ActivityIndicator style={{ marginVertical: spacing(1.5) }} />
        ) : filteredSuggestions.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionScroller}
          >
            {filteredSuggestions.map((item, index) => renderSuggestion(item, index))}
          </ScrollView>
        ) : (
          <View style={styles.emptySuggestions}>
            <Ionicons name="sparkles-outline" size={24} color={colors.primary} />
            <Text style={styles.emptySuggestionsTitle}>No matches yet</Text>
            <Text style={styles.emptySuggestionsSubtitle}>
              Adjust your interests or refresh to see more destinations.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Save itinerary</Text>
            </>
          )}
        </TouchableOpacity>
        {stopOptionsVisible ? (
          <Modal transparent animationType="fade" onRequestClose={closeStopOptions}>
            <View style={styles.sheetBackdrop}>
              <View style={styles.sheetCard}>
                <Text style={styles.sheetTitle}>
                  {activeStop?.establishment?.name ?? activeStop?.title ?? 'This stop'}
                </Text>

                <TouchableOpacity
                  style={styles.sheetPrimary}
                  onPress={() => {
                    closeStopOptions();
                    openScanner(activeStop);
                  }}
                >
                  <Ionicons name="qr-code-outline" size={18} color={colors.white} />
                  <Text style={styles.sheetPrimaryText}>Scan QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetSecondary}
                  onPress={() => handleManualVisited(activeStop)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.sheetSecondaryText}>Mark as visited</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : null}

      </ScrollView>
      {scannerVisible ? (
      <Modal visible transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerOverlay}>
          {!cameraPermission ? (
            <View style={styles.scannerFallback}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.scannerFallbackText}>Checking camera permissions…</Text>
            </View>
          ) : !cameraPermission.granted ? (
            <View style={styles.scannerFallback}>
              <Text style={styles.scannerFallbackText}>Camera access is required to scan QR codes.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={requestCameraPermission}>
                <Text style={styles.primaryButtonText}>Allow camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Camera
              style={StyleSheet.absoluteFillObject}
              type={CameraType.back}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onCameraReady={() => setCameraReady(true)}
            />
          )}
          <TouchableOpacity
            style={[styles.secondaryButton, styles.scannerClose]}
            onPress={() => setScannerVisible(false)}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1 },
  content: { paddingHorizontal: spacing(1.5), paddingBottom: spacing(4) },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing(1.5),
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
  subtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 20 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(108,92,231,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBlock: {
    gap: spacing(1.5),
    marginBottom: spacing(1.5),
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing(1.5),
  },
    dateRow: {
    flexWrap: 'wrap',
  },
  pickerButton: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingHorizontal: spacing(1.25),
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  pickerButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  inputColumn: { flex: 1, gap: spacing(0.5) },
  inputLabel: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 12 },
  textInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingHorizontal: spacing(1),
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  mapCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    overflow: 'hidden',
    marginBottom: spacing(2),
  },
  map: {
    width: Dimensions.get('window').width - spacing(3),
    height: 260,
  },
  summaryCard: {
    padding: spacing(1.25),
    gap: spacing(0.75),
    backgroundColor: colors.white,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.6),
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  optimizeButtonDisabled: { opacity: 0.6 },
  optimizeButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  summaryText: { fontFamily: 'Inter_500Medium', color: colors.text },
  timelineCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    backgroundColor: 'rgba(108,92,231,0.05)',
    padding: spacing(1),
    marginBottom: spacing(1),
  },
  timelineActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing(0.5) },
  timelineAction: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  timelineActionText: { fontFamily: 'Inter_500Medium', color: '#ef4444' },
  emptyTimeline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(2),
    gap: spacing(0.75),
  },
  emptyTimelineTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 16 },
  emptyTimelineSubtitle: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  suggestionCard: {
    width: 260,
    marginRight: spacing(1),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    backgroundColor: colors.white,
    padding: spacing(1),
  },
  suggestionButton: {
    marginTop: spacing(0.75),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
  },
  suggestionButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  savedRow: { marginBottom: spacing(2) },
  savedCard: {
    width: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    backgroundColor: colors.white,
    padding: spacing(1),
    marginRight: spacing(1),
    gap: spacing(0.4),
  },
  savedTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  savedMeta: { fontFamily: 'Inter_400Regular', color: colors.muted },
  saveButton: {
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.75),
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
  linkText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  mapLocateButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing(0.5),
  backgroundColor: colors.white,
  borderRadius: 999,
  paddingHorizontal: spacing(1.2),
  paddingVertical: spacing(0.6),
  alignSelf: 'flex-start',
  marginTop: spacing(1),
  elevation: 2,
  },
  mapLocateText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  pickerButton: {
  height: 44,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: 'rgba(108,92,231,0.25)',
  paddingHorizontal: spacing(1),
  justifyContent: 'center',
  backgroundColor: 'rgba(108,92,231,0.08)',
  },
  pickerButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  filterPillsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing(1),
  marginBottom: spacing(1),
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.6),
    backgroundColor: colors.white,
  },
  filterPillActive: {
    backgroundColor: 'rgba(108,92,231,0.12)',
    borderColor: colors.primary,
  },
  filterPillText: {
    fontFamily: 'Inter_500Medium',
    color: colors.muted,
  },
  filterPillTextActive: {
    color: colors.primary,
  },
  suggestionScroller: {
    paddingVertical: spacing(0.5),
    paddingRight: spacing(1.5),
  },
  emptySuggestions: {
    padding: spacing(2),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    alignItems: 'center',
    gap: spacing(0.5),
  },
  emptySuggestionsTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    fontSize: 16,
  },
  emptySuggestionsSubtitle: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    textAlign: 'center',
  },
  stopScroller: {
    paddingVertical: spacing(0.5),
    paddingRight: spacing(1.5),
    gap: spacing(1),
  },
  stopChip: {
    width: 200,
    borderRadius: radii.md,
    backgroundColor: 'rgba(108,92,231,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.18)',
    padding: spacing(1),
    marginRight: spacing(1),
    gap: spacing(0.4),
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopOrder: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    fontSize: 12,
  },
  stopTitle: {
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    fontSize: 16,
  },
  stopMeta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 12,
  },
  stopRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.25),
    marginTop: spacing(0.25),
  },
  stopRatingText: {
    fontFamily: 'Inter_500Medium',
    color: colors.text,
    fontSize: 12,
  },
  markerBubble: {
    minWidth: 26,
    minHeight: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  markerText: {
    fontFamily: 'Inter_700Bold',
    color: '#1f2937',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing(1),
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  stopActions: {
    marginTop: spacing(0.75),
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  stopActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
    paddingHorizontal: spacing(0.9),
    paddingVertical: spacing(0.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  stopActionText: {
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
    fontSize: 12,
  },
  stopActionsRow: { marginTop: spacing(0.75), flexDirection: 'row', justifyContent: 'flex-end' },
  stopActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    backgroundColor: 'rgba(108,92,231,0.08)',
    paddingHorizontal: spacing(1.1),
    paddingVertical: spacing(0.45),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
  },
  stopActionVisited: {
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  stopActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.primary,
  },
  scannerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  scannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(2),
    gap: spacing(1),
  },
  scannerFallbackText: { fontFamily: 'Inter_600SemiBold', color: colors.white, textAlign: 'center' },
  scannerClose: { alignSelf: 'center', marginBottom: spacing(3) },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(1.75),
    paddingTop: spacing(1.5),
    paddingBottom: spacing(2.5),
    gap: spacing(1.1),
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 12,
  },
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  sheetPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    backgroundColor: colors.primary,
    paddingVertical: spacing(0.9),
    borderRadius: radii.lg,
  },
  sheetPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  sheetSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    backgroundColor: 'rgba(108,92,231,0.08)',
    paddingVertical: spacing(0.9),
    borderRadius: radii.lg,
  },
  sheetSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },

});
