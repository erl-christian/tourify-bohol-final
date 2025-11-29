import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  InteractionManager,
  TextInput
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter, router as RouterSingleton } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radii, spacing } from '../../constants/theme';
import { checkinStop, completeItinerary, shareCompletedItinerary} from '../../lib/tourist';
import { fetchEstablishmentFeedback, createFeedback, uploadFeedbackMedia } from '../../lib/feedback';
import FeedbackForm from '../../components/FeedbackForm';
import FeedbackCard from '../../components/FeedbackCard';
import { CameraView, useCameraPermissions } from 'expo-camera';

import useSafeBack from '../../hooks/useSafeBack';


const formatDistance = km => {
  if (!km && km !== 0) return '—';
  return `${km.toFixed(1)} km`;
};

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

const segmentPalette = ['#facc15', '#60a5fa', '#8b5cf6', '#34d399', '#f87171'];

export default function LiveItinerary() {
  const { data } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const safeBack = useSafeBack();
  const hasParseError = useRef(false);

  const mapRef = useRef(null);
  const initialRouteRef = useRef([]);

  const [payload, setPayload] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isMapVisible, setIsMapVisible] = useState(true);

  const [activeStop, setActiveStop] = useState(null);
  const [stopOptionsVisible, setStopOptionsVisible] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackStop, setFeedbackStop] = useState(null);
  const [stopFeedback, setStopFeedback] = useState([]);

  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);

  const [processingStop, setProcessingStop] = useState(false);
  const [postCheckinStop, setPostCheckinStop] = useState(null);   // add here
  const [postCheckinModalVisible, setPostCheckinModalVisible] = useState(false);

  const [queuedFeedbackStop, setQueuedFeedbackStop] = useState(null);

  const [sharePromptVisible, setSharePromptVisible] = useState(false);
  const [shareCaption, setShareCaption] = useState('');

  const itineraryId = payload?.itineraryId ?? payload?.itinerary_id ?? payload?._id;

  const stops = payload?.stops ?? [];
  const totalStops = stops.length;
  const visitedCount = stops.filter(stop => stop.visited).length;
  const allStopsVisited = totalStops > 0 && visitedCount === totalStops;
  const nextPendingStop = stops.find(stop => !stop.visited);

  const unvisitedStops = stops.filter(stop => !stop.visited);
  const activeMarkers = unvisitedStops.length ? unvisitedStops : stops; // fallback if all visited


  useEffect(() => {
  const handlePayload = async () => {
      try {
      const parsed =
          typeof data === 'string' ? JSON.parse(decodeURIComponent(data)) : null;
      if (!parsed || !Array.isArray(parsed.stops)) throw new Error('Invalid itinerary payload.');
      setPayload(parsed);
      initialRouteRef.current = parsed.route ?? parsed.route_geometry ?? [];
      hasParseError.current = false;
      } catch (err) {
      if (hasParseError.current) return;
      hasParseError.current = true;
      Alert.alert('Unable to load itinerary', err.message ?? 'Please try again.');
      await InteractionManager.runAfterInteractions();
      safeBack();
      }
  };

  handlePayload();
  }, [data, safeBack]);

  useEffect(() => {
    let watcher;

    const request = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          Alert.alert('Location disabled', 'Allow location access to track your route.');
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
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
          update => {
            const next = {
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            };
            setUserLocation(next);

            if (mapRef.current) {
              mapRef.current.animateCamera({
                center: next,
                duration: 1000,
                zoom: 15,
              });
            }
          }
        );
      } catch (err) {
        Alert.alert('Location error', err.message ?? 'Unable to determine your location.');
        setIsLocating(false);
      }
    };

    request();
    return () => watcher?.remove?.();
  }, []);

  const markers = useMemo(() => {
    if (!activeMarkers.length) return [];
    return activeMarkers
      .map((stop, index) => {
        const latitude = Number(stop.latitude);
        const longitude = Number(stop.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const markerId =
          stop.travel_history_id ??
          stop.itinerary_stop_id ??
          stop.business_establishment_id ??
          stop.id ??
          `stop-${index}`;

        return {
          ...stop,
          latitude,
          longitude,
          markerId,
          label: String.fromCharCode(65 + index),
          color: segmentPalette[index % segmentPalette.length],
        };
      })
      .filter(Boolean);
  }, [activeMarkers]);


  const plannedPolyline = useMemo(() => {
    const coords = payload?.route ?? payload?.route_geometry ?? initialRouteRef.current;
    if (!Array.isArray(coords) || coords.length < 2) return [];

    const normalized = coords.map(point => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }));

    if (!userLocation) return normalized;

    // find the closest segment to the user and rebuild the path from there
    const nearestIdx = findNearestIndex(userLocation, normalized);
    return [userLocation, ...normalized.slice(nearestIdx + 1)];
  }, [payload?.route, payload?.route_geometry, userLocation]);


  const routeSegments = useMemo(() => {
    if (!plannedPolyline.length || !markers.length) return [];

    const findNearestIndex = (target, polyline) => {
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      polyline.forEach((point, idx) => {
        const dist = haversineDist(target, point); // same helper as before
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    const anchors = [
      userLocation
        ? { id: 'origin', latitude: userLocation.latitude, longitude: userLocation.longitude }
        : null,
      ...markers,
    ].filter(Boolean);

    const segments = [];
    for (let i = 0; i < anchors.length - 1; i += 1) {
      const startIdx = findNearestIndex(
        { latitude: anchors[i].latitude, longitude: anchors[i].longitude },
        plannedPolyline
      );
      const endIdx = findNearestIndex(
        { latitude: anchors[i + 1].latitude, longitude: anchors[i + 1].longitude },
        plannedPolyline
      );

      const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const slice = plannedPolyline.slice(lo, hi + 1);
      if (slice.length < 2) continue;

      segments.push({
        id: `${anchors[i].id}-to-${anchors[i + 1].id}`,
        color: segmentPalette[i % segmentPalette.length],
        coordinates: startIdx <= endIdx ? slice : slice.reverse(),
      });
    }
    return segments;
  }, [plannedPolyline, markers, userLocation]);

  const resolveEstablishmentId = stop =>
    stop?.business_establishment_id ??
    stop?.businessEstablishment_id ??
    stop?.establishment?.business_establishment_id ??
    stop?.establishment?.businessEstablishment_id ??
    stop?.establishment_id ??
    stop?.establishmentId ??
    stop?.business?.business_establishment_id ??
    stop?.id ??
    stop?.stop_id ??
    null;

  const withEstablishmentId = stop => {
    const estId = resolveEstablishmentId(stop);
    return estId && stop?.business_establishment_id !== estId
      ? { ...stop, business_establishment_id: estId }
      : stop;
  };

  const mergeStops = (prevStops = [], serverStops = []) => {
    if (!serverStops?.length) return prevStops ?? [];

    const prevMap = new Map(
      (prevStops ?? [])
        .map(stop => {
          const id = resolveEstablishmentId(stop);
          return id ? [id, stop] : null;
        })
        .filter(Boolean)
    );

    return serverStops.map(serverStop => {
      const id = resolveEstablishmentId(serverStop);
      const prev = id ? prevMap.get(id) : null;

      if (!prev) {
        // new stop the client hasn’t seen; normalise its ID so downstream logic works
        return withEstablishmentId(serverStop);
      }

      return {
        ...prev, // keep title, establishment, label, etc.
        order: serverStop.order ?? prev.order,
        visited: typeof serverStop.visited === 'boolean' ? serverStop.visited : prev.visited,
        visited_at: serverStop.visited_at ?? prev.visited_at,
        business_establishment_id:
          serverStop.business_establishment_id ?? prev.business_establishment_id,
      };
    });
  };

  const openStopOptions = stop => {
    const normalized = withEstablishmentId(stop);
    setActiveStop(normalized);
    setStopOptionsVisible(true);

    const estId = resolveEstablishmentId(normalized);
    if (estId) {
      fetchEstablishmentFeedback(estId)
        .then(list => setStopFeedback(list))
        .catch(() => setStopFeedback([]));
    }
  };

  const closeStopOptions = () => setStopOptionsVisible(false);

  const ensureCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      return res?.granted;
    }
    return true;
  };

  const openScanner = async stop => {
    const normalized = withEstablishmentId(stop);
    setActiveStop(normalized);
    setStopOptionsVisible(false);
    if (await ensureCamera()) {
      setScannerVisible(true);
    } else {
      Alert.alert('Camera permission required', 'Allow camera access to scan QR codes.');
    }
  };

  const applyItineraryUpdate = next => {
    if (!next?.itinerary) return;
    const targetId = resolveEstablishmentId(activeStop);

    setPayload(prev => {
      const mergedStops = mergeStops(prev?.stops ?? [], next.itinerary.stops ?? []);
      const nextRoute =
        (Array.isArray(next.itinerary.route_geometry) && next.itinerary.route_geometry.length > 1
          ? next.itinerary.route_geometry
          : prev?.route ??
            prev?.route_geometry ??
            initialRouteRef.current) ?? [];

      return {
        ...prev,
        ...next.itinerary,
        route: nextRoute,
        route_geometry: nextRoute,
        stops: mergedStops,
      };
    });

    const newlyVisited = next.itinerary.stops?.find(
      stop => stop.visited && resolveEstablishmentId(stop) === targetId
    );
    if (newlyVisited) {
      setQueuedFeedbackStop(withEstablishmentId(newlyVisited));
    }
  };

  const handleManualVisited = async stop => {
    if (!itineraryId) return Alert.alert('Missing itinerary');
    const normalized = withEstablishmentId(stop);
    const estId = resolveEstablishmentId(normalized);
    if (!estId) return Alert.alert('Missing establishment ID');

    setProcessingStop(true);
    closeStopOptions();
    try {
      const response = await checkinStop(itineraryId, estId);
      applyItineraryUpdate(response);
      setPostCheckinStop(normalized);
      setPostCheckinModalVisible(true);
    } catch (err) {
      Alert.alert('Unable to mark visited', err.message ?? 'Please try again.');
    } finally {
      setProcessingStop(false);
    }
};

  const handleScanSuccess = async ({ data }) => {
    setScannerVisible(false);
    if (!itineraryId) return;

    let estId =
      activeStop?.business_establishment_id ??
      activeStop?.establishment?.business_establishment_id;

    const normalizedActive = withEstablishmentId(activeStop);

    setPostCheckinStop(normalizedActive);
    try {
      if (data?.startsWith('{')) {
        const parsed = JSON.parse(data);
        estId = parsed.business_establishment_id ?? parsed.est ?? estId;
      } else if (data?.startsWith('http')) {
        const params = new URL(data).searchParams;
        estId = params.get('est') ?? estId;
      }
    } catch {
      // ignore parse errors
    }

    if (!estId) return Alert.alert('Invalid QR code', 'Please try again.');

    setProcessingStop(true);
    try {
      const response = await checkinStop(itineraryId, estId);
      applyItineraryUpdate(response);
      setPostCheckinStop(normalizedActive);
      setPostCheckinModalVisible(true);
    } catch (err) {
      Alert.alert('Check-in failed', err.message ?? 'QR scanning did not register.');
    } finally {
      setProcessingStop(false);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackVisible(false);
    setFeedbackStop(null);
    setQueuedFeedbackStop(null);
    if (completionPending) {
      setSharePromptVisible(true);
      setCompletionPending(false);
    }
  };

  const handleFeedbackSubmit = async ({ rating, review_text, assets }) => {
    if (!feedbackStop || !itineraryId) return;

    console.log('Submitting feedback for stop:', feedbackStop);
    console.log('Feedback stop payload:', feedbackStop);

    const establishmentId = resolveEstablishmentId(feedbackStop);
    
    if (!establishmentId) {
      Alert.alert('Unable to submit feedback', 'Missing establishment ID.');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const feedback = await createFeedback({
        itinerary_id: itineraryId,
        business_establishment_id: establishmentId,
        rating,
        review_text,
      });

      if (feedback?.feedback_id && Array.isArray(assets) && assets.length) {
        await uploadFeedbackMedia(feedback.feedback_id, assets);
      }

      closeFeedbackModal();
    } catch (err) {
      Alert.alert('Unable to submit feedback', err.message ?? 'Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleContinueItinerary = () => {
      setPostCheckinModalVisible(false);
      setPostCheckinStop(null);
    };

    const handleShowFeedbackFromModal = () => {
      const target = queuedFeedbackStop ?? (postCheckinStop ? withEstablishmentId(postCheckinStop) : null);
      if (target) {
        setFeedbackStop(target);
        setFeedbackVisible(true);
        setQueuedFeedbackStop(null);
      }
      setPostCheckinModalVisible(false);
      setPostCheckinStop(null);
  };

  const handleAddMoreStops = () => {
    setPostCheckinModalVisible(false);
    setPostCheckinStop(null);
    router.push({
      pathname: '/itinerary',
      params: { mode: 'add', itineraryId },
    });
  };

  const handleCompleteItinerary = async () => {
    if (!itineraryId) return;
    if (!allStopsVisited) {
      Alert.alert('Visit remaining stops', 'Please mark every stop as visited before completing the itinerary.');
      return;
    }
    setPostCheckinModalVisible(false);

    try {
      const result = await completeItinerary(itineraryId);
      setPayload(prev => ({
        ...prev,
        status: 'Completed',
        ...result?.itinerary,
      }));

      const targetFeedbackStop =
        queuedFeedbackStop ??
        (postCheckinStop ? withEstablishmentId(postCheckinStop) : null);

      setCompletionPending(true);
      if (targetFeedbackStop) {
        setFeedbackStop(targetFeedbackStop);
        setFeedbackVisible(true);
      } else {
        setSharePromptVisible(true);
      }

    } catch (err) {
      Alert.alert('Unable to complete itinerary', err.message ?? 'Please try again.');
    } finally {
      setPostCheckinStop(null);
    }
  };

  if (!payload || isLocating || !userLocation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing your live route…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {isMapVisible ? (
        <>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: markers[0]?.latitude ?? userLocation.latitude,
              longitude: markers[0]?.longitude ?? userLocation.longitude,
              latitudeDelta: 0.25,
              longitudeDelta: 0.25,
            }}
          >
            {plannedPolyline.length > 1 && (
              <Polyline coordinates={plannedPolyline} strokeColor="rgba(15,23,42,0.2)" strokeWidth={4} />
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

            {markers.map(marker => (
              <Marker
                key={`${marker.markerId}`}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                title={`${marker.label}. ${marker.title}`}
                description={marker.subtitle}
                onPress={() => openStopOptions(marker)}
                onCalloutPress={() => openStopOptions(marker)}
              >
                <View style={[styles.markerBubble, { backgroundColor: marker.color }]}>
                  <Text style={styles.markerText}>{marker.label}</Text>
                </View>
              </Marker>
            ))}

            <Marker coordinate={userLocation} title="You">
              <View style={styles.youMarker} />
            </Marker>
          </MapView>

          <View style={styles.mapOverlayButtons}>
            <TouchableOpacity
              style={styles.overlayButton}
              onPress={() => setIsMapVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-down" size={18} color="#1f2937" />
              <Text style={styles.overlayButtonText}>Minimize</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.overlayButton} onPress={safeBack} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color="#1f2937" />
              <Text style={styles.overlayButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.collapsedCard}>
          <Text style={styles.collapsedTitle}>{payload.title ?? 'Current itinerary'}</Text>
          <Text style={styles.collapsedSubtitle}>
            {payload.stops.length} stops • {formatDistance(payload.summary?.distance_km)} planned
          </Text>

          <TouchableOpacity style={styles.collapsedButton} onPress={() => setIsMapVisible(true)} activeOpacity={0.85}>
            <Ionicons name="chevron-up" size={18} color="#fff" />
            <Text style={styles.collapsedButtonText}>Show map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stopActionButton}
            disabled={!nextPendingStop}
            onPress={() => nextPendingStop && openStopOptions(nextPendingStop)}
          >
            <Ionicons name="qr-code-outline" size={14} color={colors.primary} />
            <Text style={styles.stopActionText}>
              {nextPendingStop ? 'Open next stop' : 'All stops visited'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.collapsedSecondary}
            onPress={() => router.push('/itinerary')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.collapsedSecondaryText}>Add more stops</Text>
          </TouchableOpacity>
        </View>
      )}

      {stopOptionsVisible ? (
        <Modal transparent animationType="fade" onRequestClose={closeStopOptions}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>
                {activeStop?.establishment?.name ?? activeStop?.title ?? 'This stop'}
              </Text>

              <TouchableOpacity
                style={[styles.sheetPrimary, processingStop && styles.disabled]}
                onPress={() => openScanner(activeStop)}
                disabled={processingStop}
              >
                <Ionicons name="qr-code-outline" size={18} color={colors.white} />
                <Text style={styles.sheetPrimaryText}>Scan QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetSecondary, processingStop && styles.disabled]}
                onPress={() => handleManualVisited(activeStop)}
                disabled={processingStop}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.sheetSecondaryText}>Mark visited</Text>
              </TouchableOpacity>

              <ScrollView style={styles.feedbackScroll} contentContainerStyle={styles.feedbackList}>
                <Text style={styles.feedbackHeading}>Recent feedback</Text>
                {stopFeedback.length ? (
                  stopFeedback.slice(0, 3).map(item => <FeedbackCard key={item._id} feedback={item} />)
                ) : (
                  <Text style={styles.feedbackEmpty}>No reviews yet. Be the first to share!</Text>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.sheetCancel} onPress={closeStopOptions}>
                <Text style={styles.sheetCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {scannerVisible ? (
        <Modal transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
          <View style={styles.scannerOverlay}>
            {cameraPermission?.granted ? (
               <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleScanSuccess}
              />
            ) : (
              <View style={styles.scannerFallback}>
                <Text style={styles.scannerFallbackText}>
                  Camera access is required to scan QR codes.
                </Text>
                <TouchableOpacity style={styles.sheetPrimary} onPress={requestCameraPermission}>
                  <Text style={styles.sheetPrimaryText}>Enable camera</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setScannerVisible(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      ) : null}

      {feedbackVisible && feedbackStop ? (
        <FeedbackModal
          visible={feedbackVisible}
          stop={feedbackStop}
          submitting={feedbackSubmitting}
          onSubmit={handleFeedbackSubmit}
          onClose={closeFeedbackModal}
        />
      ) : null}
        {postCheckinModalVisible && postCheckinStop ? (
        <Modal transparent animationType="fade" onRequestClose={handleContinueItinerary}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>
                {postCheckinStop.title ?? postCheckinStop.establishment?.name ?? 'Stop visited!'}
              </Text>
              <Text style={styles.sheetHelper}>{`${visitedCount}/${totalStops} stops completed`}</Text>
              <Text style={styles.sheetHelperMuted}>
                {allStopsVisited
                  ? 'All stops are done—ready to wrap up?'
                  : nextPendingStop
                    ? `Next up: ${nextPendingStop.title ?? nextPendingStop.establishment?.name}`
                    : 'Keep exploring your itinerary.'}
              </Text>

              <TouchableOpacity style={styles.sheetPrimary} onPress={handleContinueItinerary}>
                <Ionicons name="walk-outline" size={18} color={colors.white} />
                <Text style={styles.sheetPrimaryText}>Continue itinerary</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetSecondary} onPress={handleShowFeedbackFromModal}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                <Text style={styles.sheetSecondaryText}>Leave feedback now</Text>
              </TouchableOpacity>

              {allStopsVisited ? (
                <TouchableOpacity style={styles.sheetPrimary} onPress={handleCompleteItinerary}>
                  <Ionicons name="flag-outline" size={18} color={colors.white} />
                  <Text style={styles.sheetPrimaryText}>Complete itinerary</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.sheetSecondary} onPress={handleAddMoreStops}>
                <Ionicons name="map-outline" size={18} color={colors.primary} />
                <Text style={styles.sheetSecondaryText}>Add another stop</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetCancel} onPress={handleContinueItinerary}>
                <Text style={styles.sheetCancelText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
      {completionModalVisible ? (
        <Modal transparent animationType="fade" onRequestClose={() => setCompletionModalVisible(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>Itinerary completed</Text>
              <Text style={styles.sheetHelperMuted}>Thanks for sharing feedback! Ready for the next trip?</Text>

              <TouchableOpacity
                style={styles.sheetPrimary}
                onPress={() => {
                  setCompletionModalVisible(false);
                  router.replace('/home'); // or whichever home route you want
                }}
              >
                <Ionicons name="home-outline" size={18} color={colors.white} />
                <Text style={styles.sheetPrimaryText}>Return home</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetSecondary} onPress={() => setCompletionModalVisible(false)}>
                <Text style={styles.sheetSecondaryText}>Stay on map</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {sharePromptVisible ? (
        <Modal transparent animationType="fade" onRequestClose={() => setSharePromptVisible(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheetCard}>
              <Text style={styles.sheetTitle}>Share this itinerary?</Text>
              <Text style={styles.sheetHelperMuted}>
                Publish your completed route so other tourists can be inspired.
              </Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a short caption (optional)"
                value={shareCaption}
                onChangeText={setShareCaption}
                maxLength={300}
                multiline
              />
              <TouchableOpacity
                style={styles.sheetPrimary}
                onPress={async () => {
                  try {
                    await shareCompletedItinerary(itineraryId, shareCaption);
                  } catch (err) {
                    Alert.alert('Unable to share', err.message ?? 'Please try again later.');
                  } finally {
                    setSharePromptVisible(false);
                    setShareCaption('');
                    setCompletionModalVisible(true);
                  }
                }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.white} />
                <Text style={styles.sheetPrimaryText}>Share publicly</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetSecondary}
                onPress={() => {
                  setSharePromptVisible(false);
                  setShareCaption('');
                  setCompletionModalVisible(true);
                }}
              >
                <Text style={styles.sheetSecondaryText}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

    </SafeAreaView>
  );
}

function FeedbackModal({ visible, stop, submitting, onSubmit, onClose }) {
  if (!stop) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.feedbackBackdrop}>
        <View style={styles.feedbackSheet}>
          <Text style={styles.feedbackTitle}>How was {stop.title ?? stop.establishment?.name}?</Text>

          <FeedbackForm submitting={submitting} onSubmit={onSubmit} />

          <TouchableOpacity style={styles.feedbackCancel} onPress={onClose} disabled={submitting}>
            <Text style={styles.feedbackCancelText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* styles */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.white },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: spacing(1),
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  markerBubble: {
    minWidth: 26,
    minHeight: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  markerText: { fontFamily: 'Inter_700Bold', color: '#1f2937', fontSize: 13 },
  youMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff6b6b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapOverlayButtons: {
    position: 'absolute',
    top: spacing(2),
    right: spacing(2),
    flexDirection: 'column',
    gap: spacing(1),
  },
  overlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: spacing(1.4),
    paddingVertical: spacing(0.8),
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  overlayButtonText: { fontFamily: 'Inter_600SemiBold', color: '#1f2937' },
  collapsedCard: {
    margin: spacing(2),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.18)',
    backgroundColor: colors.white,
    padding: spacing(2),
    gap: spacing(1),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  collapsedTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 20 },
  collapsedSubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted },
  collapsedButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing(1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.4),
  },
  collapsedButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
  collapsedSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.4),
    paddingVertical: spacing(0.8),
  },
  collapsedSecondaryText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
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
    gap: spacing(1.2),
    maxHeight: '80%',
  },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
  sheetPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    borderRadius: 999,
    paddingVertical: spacing(0.9),
    backgroundColor: colors.primary,
  },
  sheetPrimaryText: { fontFamily: 'Inter_600SemiBold', color: colors.white },
  sheetSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    borderRadius: 999,
    paddingVertical: spacing(0.9),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    backgroundColor: 'rgba(108,92,231,0.08)',
  },
  sheetSecondaryText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  sheetCancel: { alignItems: 'center', paddingVertical: spacing(0.75) },
  sheetCancelText: { fontFamily: 'Inter_500Medium', color: colors.muted },
  feedbackScroll: { maxHeight: 220 },
  feedbackList: { gap: spacing(1) },
  feedbackHeading: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  feedbackEmpty: { fontFamily: 'Inter_400Regular', color: colors.muted },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    paddingBottom: spacing(3),
  },
  scannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(2),
    gap: spacing(1),
  },
  scannerFallbackText: { fontFamily: 'Inter_600SemiBold', color: colors.white, textAlign: 'center' },
  disabled: { opacity: 0.6 },
  feedbackBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  feedbackSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing(1.5),
    paddingTop: spacing(1.5),
    paddingBottom: spacing(2.5),
    gap: spacing(1.25),
    maxHeight: '85%',
  },
  feedbackTitle: { fontFamily: 'Inter_700Bold', color: colors.text, fontSize: 18 },
  feedbackCancel: { alignSelf: 'center', paddingVertical: spacing(0.75) },
  feedbackCancelText: { fontFamily: 'Inter_500Medium', color: colors.muted },
  sheetHelper: {
  textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  sheetHelperMuted: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    borderRadius: radii.md,
    padding: spacing(1),
    minHeight: 80,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    marginTop: spacing(1),
  },
});
