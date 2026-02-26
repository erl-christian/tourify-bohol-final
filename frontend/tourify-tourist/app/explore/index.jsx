import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ImageBackground,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
// import { MapView, Marker } from '../../components/MapLibreMap'
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, spacing, radii } from '../../constants/theme';
import SectionHeader from '../../components/SectionHeader';
import DestinationCard from '../../components/DestinationCard';
import client from '../../lib/http';
import {
  generateRecommendations,
  getPublicDestinations,
  enrichRecommendations,
} from '../../lib/tourist';
import {
  buildEstablishmentCard,
  extractEstablishmentId,
  formatReviewDate,
  normaliseEstablishmentSource,
  toTitle,
} from '../../lib/establishments';

const PENDING_KEY = '@tourify/pending_itinerary_stops';
const DEFAULT_INTEREST_VALUES = ['beach', 'heritage', 'adventure', 'nature', 'food'];
const BUNDLE_MAX_COUNT = 4;
const BUNDLE_MEMBER_LIMIT = 5;

const makeInterestOption = value => {
  const trimmed = value.trim();
  const id = trimmed.toLowerCase();
  return { id, value: trimmed, label: toTitle(trimmed) || trimmed };
};

const DEFAULT_INTEREST_OPTIONS = DEFAULT_INTEREST_VALUES.map(makeInterestOption);

const buildMarkers = items =>
  (items ?? [])
    .map(rec => {
      const normalised = normaliseEstablishmentSource(rec);
      if (!normalised) return null;
      const data = normalised.establishment ?? {};
      const lat = data.latitude ?? data.location?.coordinates?.[1];
      const lng = data.longitude ?? data.location?.coordinates?.[0];
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;

      return {
        id:
          normalised.travel_recommendation_id ??
          data.businessEstablishment_id ??
          data.business_establishment_id ??
          data._id ??
          `${data.name}-${Math.random()}`,
        title: data.name ?? 'Bohol Destination',
        snippet: normalised.reason ?? data.description ?? '',
        latitude: lat,
        longitude: lng,
        cardSource: normalised,
      };
    })
    .filter(Boolean);

const parseFinite = value => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normaliseTagKey = value =>
  String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const deriveSpmValue = recommendation => {
  const est = recommendation?.establishment ?? {};
  const supportFromEst = parseFinite(est.spm_support_total);
  const supportFromRec = parseFinite(recommendation?.spm_support_total);
  const confidence = parseFinite(recommendation?.params?.spm?.confidence);
  const lift = parseFinite(recommendation?.params?.spm?.lift);
  const confidenceLiftScore = confidence > 0 ? confidence * Math.max(1, lift) * 100 : 0;
  return Math.max(supportFromEst, supportFromRec, confidenceLiftScore);
};

const buildBundlesFrom = items => {
  const prepared = (items ?? [])
    .map(source => normaliseEstablishmentSource(source))
    .filter(Boolean)
    .map(rec => {
      const est = rec.establishment ?? {};
      const estId = extractEstablishmentId(rec);
      if (!estId) return null;

      const rawTags = Array.isArray(est.tag_names) ? est.tag_names : [];
      const tags = [...new Set([...rawTags, est.type].map(normaliseTagKey).filter(Boolean))];
      const bundleTags = tags.length ? tags : ['featured'];

      return {
        recommendation: rec,
        estId,
        tags: bundleTags,
        rating: Math.max(0, Math.min(5, parseFinite(est.rating_avg))),
        spm: deriveSpmValue(rec),
      };
    })
    .filter(Boolean);

  if (!prepared.length) return [];

  const maxSpm = Math.max(...prepared.map(item => item.spm), 1);
  const totalPrepared = prepared.length;
  const tagFrequency = new Map();

  prepared.forEach(item => {
    item.tags.forEach(tag => {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    });
  });

  const buckets = new Map();
  prepared.forEach(item => {
    const destinationScore = (item.rating / 5) * 0.55 + (item.spm / maxSpm) * 0.45;

    item.tags.forEach(tag => {
      const coverage = Math.min((tagFrequency.get(tag) ?? 0) / totalPrepared, 1);
      const weightedScore = destinationScore * (0.75 + coverage * 0.25);

      if (!buckets.has(tag)) {
        buckets.set(tag, {
          tag,
          members: [],
          score: 0,
          ratingTotal: 0,
          spmTotal: 0,
        });
      }

      const bucket = buckets.get(tag);
      bucket.members.push({ ...item, destinationScore });
      bucket.score += weightedScore;
      bucket.ratingTotal += item.rating;
      bucket.spmTotal += item.spm;
    });
  });

  const rawBundles = Array.from(buckets.values())
    .map(bucket => {
      const uniqueMemberMap = new Map();

      bucket.members.forEach(member => {
        const existing = uniqueMemberMap.get(member.estId);
        if (!existing || member.destinationScore > existing.destinationScore) {
          uniqueMemberMap.set(member.estId, member);
        }
      });

      const members = Array.from(uniqueMemberMap.values()).sort(
        (a, b) => b.destinationScore - a.destinationScore
      );
      if (!members.length) return null;

      const count = members.length;
      const avgRating = bucket.ratingTotal / bucket.members.length;
      const totalSpm = bucket.spmTotal;
      const bundleScore = bucket.score / bucket.members.length + Math.min(count / 5, 1) * 0.2;
      const label = toTitle(bucket.tag) || 'Featured';
      const rankedMembers = members
        .slice(0, BUNDLE_MEMBER_LIMIT)
        .map(member => member.recommendation);

      return {
        id: bucket.tag.replace(/\s+/g, '-'),
        title: `${label} Smart Route`,
        description: `${count} stops prioritised by rating and SPM travel flow support.`,
        tags: [
          label,
          `${count} spots`,
          `Rating ${avgRating.toFixed(1)}`,
          `SPM ${Math.round(totalSpm)}`,
        ],
        members: rankedMembers,
        count,
        score: bundleScore,
      };
    })
    .filter(Boolean);

  const multiStopBundles = rawBundles.filter(bundle => bundle.count >= 2);
  const base = multiStopBundles.length ? multiStopBundles : rawBundles;

  return base
    .sort((a, b) => b.score - a.score)
    .slice(0, BUNDLE_MAX_COUNT)
    .map(bundle => ({
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      tags: bundle.tags,
      members: bundle.members,
    }));
};

export default function Explore() {
  const router = useRouter();
  const { profile } = useAuth();

  const inlineMapRef = useRef(null);
  const modalMapRef = useRef(null);

  const [interestOptions, setInterestOptions] = useState(DEFAULT_INTEREST_OPTIONS);
  const [interests, setInterests] = useState(
    DEFAULT_INTEREST_OPTIONS.slice(0, 3).map(opt => opt.value)
  );
  const [autoSeedInterests, setAutoSeedInterests] = useState(true);

  const [budget, setBudget] = useState({ min: 0, max: 3000 });
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [fallbackDestinations, setFallbackDestinations] = useState([]);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  const [selectedDestination, setSelectedDestination] = useState(null);
  const [detailInfo, setDetailInfo] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState(null);
  const [isLocating, setIsLocating] = useState(true);

  const [mapRegion, setMapRegion] = useState({
    latitude: 9.75,
    longitude: 124.1,
    latitudeDelta: 0.8,
    longitudeDelta: 0.8,
  });

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const SKELETON_COUNT = 4;

  const loadPendingCount = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!raw) {
        setPendingCount(0);
        return;
      }
      const arr = JSON.parse(raw);
      setPendingCount(Array.isArray(arr) ? arr.length : 0);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  useFocusEffect(
    useCallback(() => {
      loadPendingCount();
    }, [loadPendingCount])
  );

  const isProfileReady = Boolean(profile?.tourist_profile_id);

  const headerCopy = useMemo(() => {
    if (!isProfileReady) {
      return {
        title: 'Complete your profile',
        subtitle:
          'Tell us about your travel preferences first so we can tailor recommendations for you.',
      };
    }
    return {
      title: 'Smart recommendations',
      subtitle:
        'Tap Smart Suggest to generate ACO-powered itineraries based on your interests, budget, and proximity.',
    };
  }, [isProfileReady]);

  const mergeInterestOptions = items => {
    setInterestOptions(prev => {
      const map = new Map(prev.map(opt => [opt.id, opt]));
      DEFAULT_INTEREST_OPTIONS.forEach(opt => map.set(opt.id, opt));

      (items ?? []).forEach(item => {
        const data = item.establishment ?? item ?? {};
        const tags = Array.isArray(data.tag_names) ? data.tag_names : data.tags ?? [];
        const add = raw => {
          if (!raw) return;
          const option = makeInterestOption(String(raw));
          map.set(option.id, option);
        };
        tags.forEach(add);
        add(data.type);
      });

      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    });
  };

  useEffect(() => {
    setInterests(prev => {
      const valid = new Set(interestOptions.map(opt => opt.value));
      const filtered = prev.filter(value => valid.has(value));
      if (filtered.length) return filtered;

      if (autoSeedInterests) {
        const auto = interestOptions.slice(0, 3).map(opt => opt.value);
        return auto.length ? auto : [];
      }
      return [];
    });
  }, [interestOptions, autoSeedInterests]);

  const focusRegion = region => {
    if (!region) return;
    setMapRegion(region);
    inlineMapRef.current?.animateToRegion(region, 600);
    modalMapRef.current?.animateToRegion(region, 600);
  };

  const handleSmartSuggest = async () => {
    if (!isProfileReady) {
      router.push('/profile/setup');
      return;
    }

    const selectedInterests = interests.map(i => String(i).trim()).filter(Boolean);
    if (!selectedInterests.length) {
      Alert.alert('Select interests', 'Please choose at least one interest before generating.');
      return;
    }

    const locationPayload = userLocation
      ? { lat: userLocation.latitude, lng: userLocation.longitude }
      : null;

    setLoading(true);
    try {
      const normalizedBudget = {
        min: Math.max(0, Number(budget.min) || 0),
        max: Math.max(0, Number(budget.max) || 0),
      };

      if (normalizedBudget.max < normalizedBudget.min) {
        normalizedBudget.max = normalizedBudget.min;
      }

      const normalizedRadius = Math.max(1, Number(radius) || 10);

      const payload = {
        tourist_profile_id: profile.tourist_profile_id,
        preferences: selectedInterests,
        budget: normalizedBudget,
        radius: normalizedRadius,
        location: locationPayload,
        limit: 200,
      };

      const { items, message } = await generateRecommendations(payload);
      setEmptyMessage(items.length ? null : message);

      const enriched = await enrichRecommendations(items);
      setRecommendations(enriched);
      mergeInterestOptions(enriched);
      setBundles(buildBundlesFrom(enriched));

      const markers = buildMarkers(enriched);
      setMapMarkers(markers);

      if (markers.length) {
        focusRegion({
          latitude: markers[0].latitude,
          longitude: markers[0].longitude,
          latitudeDelta: 0.45,
          longitudeDelta: 0.45,
        });
      }
    } catch (error) {
      Alert.alert('Unable to generate suggestions', error.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await handleSmartSuggest();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getPublicDestinations({ pageSize: 12 })
      .then(items => {
        setFallbackDestinations(items);
        mergeInterestOptions(items);

        if (!mapMarkers.length) {
          const markers = buildMarkers(items);
          setMapMarkers(markers);
          if (markers.length) {
            focusRegion({
              latitude: markers[0].latitude,
              longitude: markers[0].longitude,
              latitudeDelta: 0.45,
              longitudeDelta: 0.45,
            });
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let watcher;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          setIsLocating(false);
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setUserLocation(coords);
        setIsLocating(false);

        if (!mapMarkers.length) {
          focusRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.35,
            longitudeDelta: 0.35,
          });
        }

        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 250,
          },
          position => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        );
      } catch (err) {
        console.warn('Location error', err);
        setIsLocating(false);
      }
    })();

    return () => watcher?.remove?.();
  }, [mapMarkers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapModalVisible && mapMarkers.length) {
      modalMapRef.current?.animateToRegion(
        {
          latitude: mapMarkers[0].latitude,
          longitude: mapMarkers[0].longitude,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        },
        500
      );
    }
  }, [mapModalVisible, mapMarkers]);

  const loadDetail = async payload => {
    const estId = extractEstablishmentId(payload);
    setDetailInfo(null);

    if (!estId) {
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const res = await client.get(`/public/establishments/${estId}`);
      mergeInterestOptions([res.data.establishment]);
      setDetailInfo({
        ...res.data.establishment,
        feedback_summary: res.data.feedback_summary,
        recent_feedback:
          res.data.recent_feedback ??
          res.data.feedback_preview ??
          res.data.feedbacks ??
          [],
      });
    } catch (err) {
      console.warn('Failed to load establishment detail', err);
      setDetailInfo(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = source => {
    const normalised = normaliseEstablishmentSource(source);
    if (!normalised) return;
    setSelectedDestination(normalised);
    loadDetail(normalised);
  };

  const handleLocate = () => {
    if (userLocation) {
      focusRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.22,
        longitudeDelta: 0.22,
      });
      return;
    }
    if (mapMarkers.length) {
      focusRegion({
        latitude: mapMarkers[0].latitude,
        longitude: mapMarkers[0].longitude,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      });
      return;
    }
    Alert.alert('Location unavailable', 'Generate recommendations to plot destinations.');
  };

  const buildPlannerPayload = source => {
    const normalised = normaliseEstablishmentSource(source);
    if (!normalised) return null;

    const est = normalised.establishment ?? {};
    const latitude = est.latitude ?? est.location?.coordinates?.[1];
    const longitude = est.longitude ?? est.location?.coordinates?.[0];

    return {
      id:
        normalised.travel_recommendation_id ??
        est.businessEstablishment_id ??
        est.business_establishment_id ??
        est._id ??
        `dest-${Date.now()}`,
      travel_recommendation_id: normalised.travel_recommendation_id ?? null,
      business_establishment_id:
        est.businessEstablishment_id ?? est.business_establishment_id ?? null,
      establishment: est,
      reason: normalised.reason ?? '',
      title: est.name ?? 'Bohol Destination',
      municipality: est.municipality_id ?? est.address ?? 'Bohol',
      latitude,
      longitude,
    };
  };

  const queueIdentity = item =>
    item?.id ??
    item?.travel_recommendation_id ??
    item?.business_establishment_id ??
    item?.establishment?.business_establishment_id ??
    item?.establishment?.businessEstablishment_id ??
    null;

  const queuePlannerSources = async sources => {
    const payloads = (Array.isArray(sources) ? sources : [sources])
      .map(buildPlannerPayload)
      .filter(Boolean);

    if (!payloads.length) {
      return { added: 0, skipped: 0, total: 0 };
    }

    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const current = Array.isArray(list) ? list : [];
    const currentIds = new Set(current.map(queueIdentity).filter(Boolean));

    const updated = [...current];
    let added = 0;
    let skipped = 0;

    payloads.forEach(payload => {
      const incomingId = queueIdentity(payload);
      if (incomingId && currentIds.has(incomingId)) {
        skipped += 1;
        return;
      }
      if (incomingId) currentIds.add(incomingId);
      updated.push(payload);
      added += 1;
    });

    if (added > 0) {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(updated));
      setPendingCount(updated.length);
    }

    return { added, skipped, total: payloads.length };
  };

  const addToPlanner = async source => {
    try {
      const { added } = await queuePlannerSources([source]);

      if (added === 0) {
        Alert.alert('Already saved', 'This destination is already queued for route planning.');
        return;
      }

      Alert.alert('Itinerary updated', 'Destination saved for route planning.');

      if (selectedDestination) {
        setSelectedDestination(null);
        setDetailInfo(null);
      }
    } catch (err) {
      console.warn('Unable to queue itinerary stop', err);
      Alert.alert('Oops', 'Could not save this destination. Please try again.');
    }
  };

  const addBundleToPlanner = async bundle => {
    const members = Array.isArray(bundle?.members) ? bundle.members : [];
    if (!members.length) {
      Alert.alert('Bundle unavailable', 'No destinations were found for this bundle.');
      return;
    }

    try {
      const { added, skipped } = await queuePlannerSources(members);

      if (added === 0) {
        Alert.alert('Already saved', 'All destinations in this bundle are already queued.');
        return;
      }

      const detail = skipped > 0 ? ` ${skipped} were already queued.` : '';
      Alert.alert('Itinerary updated', `${added} destination(s) added from bundle.${detail}`);
    } catch (err) {
      console.warn('Unable to queue bundle stops', err);
      Alert.alert('Oops', 'Could not save this bundle. Please try again.');
    }
  };

  const detailCard = selectedDestination ? buildEstablishmentCard(selectedDestination) : null;
  const detailTags = detailInfo?.tag_names ?? detailCard?.tags ?? [];
  const selectedEst = selectedDestination?.establishment ?? {};

  const parseFiniteBudget = value => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatBudgetPhp = value =>
    `PHP ${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

  const rawBudgetMin = detailInfo?.budget_min ?? selectedEst?.budget_min;
  const rawBudgetMax = detailInfo?.budget_max ?? selectedEst?.budget_max;
  const budgetMin = parseFiniteBudget(rawBudgetMin);
  const budgetMax = parseFiniteBudget(rawBudgetMax);

  const detailPriceRange = detailInfo?.price_range ?? selectedEst?.price_range ?? null;
  const detailAverageSpend = detailInfo?.average_spend ?? selectedEst?.average_spend ?? null;

  const budgetLabel =
    detailPriceRange ||
    (budgetMin !== null && budgetMax !== null
      ? `${formatBudgetPhp(budgetMin)} - ${formatBudgetPhp(budgetMax)}`
      : budgetMin !== null
      ? `${formatBudgetPhp(budgetMin)} and up`
      : budgetMax !== null
      ? `Up to ${formatBudgetPhp(budgetMax)}`
      : null);

  const feedbackSummary = detailInfo?.feedback_summary;
  const feedbackItems = Array.isArray(detailInfo?.recent_feedback)
    ? detailInfo.recent_feedback.slice(0, 3)
    : [];

  const primaryList = recommendations.length ? recommendations : fallbackDestinations;
  const showEmptyState = !primaryList.length && !!emptyMessage;

  const isPicksLoading = loading && !primaryList.length;

  if (isLocating && !userLocation) {
    return (
      <SafeAreaView style={styles.loadingSafe} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing nearby destinations…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={{ flex: 1, gap: spacing(0.5) }}>
            <Text style={styles.heroTitle}>Explore Bohol</Text>
            <Text style={styles.heroSubtitle}>{headerCopy.subtitle}</Text>
          </View>
          <Ionicons name="compass-outline" size={36} color={colors.primary} />
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filtersTitle}>What interests you?</Text>
          <View style={styles.filterRow}>
            {interestOptions.map(option => {
              const selected = interests.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => {
                    setAutoSeedInterests(false);
                    setInterests(prev =>
                      prev.includes(option.value)
                        ? prev.filter(val => val !== option.value)
                        : [...prev, option.value]
                    );
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inlineInputs}>
            <View style={[styles.inputGroup, styles.inputGroupHalf]}>
              <Text style={styles.inputLabel}>Budget (min)</Text>
              <TextInput
                style={styles.inputField}
                keyboardType='numeric'
                value={String(budget.min)}
                onChangeText={value =>
                  setBudget(prev => ({ ...prev, min: Math.max(0, Number(value) || 0) }))
                }
              />
              <Text style={styles.inputHint}>PHP</Text>
            </View>
            <View style={[styles.inputGroup, styles.inputGroupHalf]}>
              <Text style={styles.inputLabel}>Budget (max)</Text>
              <TextInput
                style={styles.inputField}
                keyboardType='numeric'
                value={String(budget.max)}
                onChangeText={value =>
                  setBudget(prev => ({
                    ...prev,
                    max: Math.max(prev.min, Number(value) || prev.max),
                  }))
                }
              />
              <Text style={styles.inputHint}>PHP</Text>
            </View>
            <View style={[styles.inputGroup, styles.inputGroupFull]}>
              <Text style={styles.inputLabel}>Radius (km)</Text>
              <TextInput
                style={styles.inputField}
                keyboardType='numeric'
                value={String(radius)}
                onChangeText={value => setRadius(Math.max(1, Number(value) || radius))}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isProfileReady && styles.primaryButtonDisabled]}
            onPress={handleSmartSuggest}
            disabled={loading || !isProfileReady}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name='sparkles-outline' size={20} color={colors.white} />
                <Text style={styles.primaryButtonText}>Smart Suggest</Text>
              </>
            )}
          </TouchableOpacity>

          {!isProfileReady && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/profile/setup')}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Complete profile first</Text>
            </TouchableOpacity>
          )}
        </View>

        {mapMarkers.length ? (
          <View style={styles.mapWrapper}>
            <View style={styles.mapContainer}>
              <MapView
                ref={inlineMapRef}
                style={styles.map}
                initialRegion={mapRegion}
                onRegionChangeComplete={setMapRegion}
                showsCompass
                showsPointsOfInterest={false}
                zoomControlEnabled
                rotateEnabled
                pitchEnabled
              >
                {mapMarkers.map(marker => (
                  <Marker
                    key={marker.id}
                    coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                    title={marker.title}
                    description={marker.snippet}
                    pinColor='#6c5ce7'
                    onPress={() => openDetail(marker.cardSource)}
                  />
                ))}
                {userLocation ? (
                  <Marker coordinate={userLocation} title='You are here' pinColor='#ff6b6b' />
                ) : null}
              </MapView>
            </View>

            <View style={styles.mapControls}>
              <TouchableOpacity
                style={styles.mapLocateButton}
                onPress={handleLocate}
                activeOpacity={0.85}
              >
                <Ionicons name='navigate' size={18} color={colors.primary} />
                <Text style={styles.mapLocateText}>Locate me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapExpandButton}
                onPress={() => setMapModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name='expand-outline' size={18} color={colors.white} />
                <Text style={styles.mapExpandText}>Expand map</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name='map-outline' size={42} color={colors.primary} />
            <Text style={styles.mapTitle}>Tap Smart Suggest to populate the map</Text>
            <Text style={styles.mapSubtitle}>
              We’ll plot the recommended spots once results are ready.
            </Text>
          </View>
        )}

        {bundles.length > 0 && (
          <>
            <SectionHeader
              title='Smart bundles'
              subtitle='Auto-ranked by tags, ratings, and SPM travel flow strength.'
              actionSlot={
                <TouchableOpacity onPress={handleSmartSuggest}>
                  <Text style={styles.linkText}>Refresh</Text>
                </TouchableOpacity>
              }
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bundleRow}>
              {bundles.map((bundle, index) => (
                <View key={bundle.id ?? index} style={styles.bundleCard}>
                  <Text style={styles.bundleTitle}>{bundle.title}</Text>
                  <Text style={styles.bundleDescription}>{bundle.description}</Text>
                  <View style={styles.bundleTags}>
                    {bundle.tags.map(tag => (
                      <View key={`${bundle.title}-${tag}`} style={styles.bundleTag}>
                        <Text style={styles.bundleTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.bundleButton}
                    onPress={() => addBundleToPlanner(bundle)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name='add-circle-outline' size={16} color={colors.primary} />
                    <Text style={styles.bundleButtonText}>Add all to itinerary</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <SectionHeader
          title='Individual picks'
          subtitle='Verified by LGUs and Bohol Tourism. Tap to view details.'
          actionSlot={
            <TouchableOpacity onPress={handleSmartSuggest}>
              <Text style={styles.linkText}>Regenerate</Text>
            </TouchableOpacity>
          }
        />

        {/* {showEmptyState ? (
          <Text style={styles.emptyState}>
            {emptyMessage ?? 'No destinations matched your current filters.'}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.picksScroller}
          >
            {primaryList.map((item, index) => {
              const cardPayload = buildEstablishmentCard(item, index);
              const cardSource = normaliseEstablishmentSource(item);
              const itemKey =
                cardPayload.id ??
                item.travel_recommendation_id ??
                item.business_establishment_id ??
                `pick-${index}`;

              return (
                <View key={itemKey} style={styles.horizontalCardWrapper}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => openDetail(cardSource)}>
                    <DestinationCard item={cardPayload} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.horizontalAddButton}
                    onPress={() => addToPlanner(cardSource)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name='add-circle-outline' size={16} color={colors.primary} />
                    <Text style={styles.horizontalAddText}>Add to itinerary</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )} */}

        {isPicksLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.picksScroller}
            >
              {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
                <View key={`skeleton-${idx}`} style={styles.skeletonCard}>
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonLineWide} />
                  <View style={styles.skeletonLineSmall} />
                </View>
              ))}
            </ScrollView>
          ) : showEmptyState ? (
            <Text style={styles.emptyState}>
              {emptyMessage ?? 'No destinations matched your current filters.'}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.picksScroller}
            >
              {primaryList.map((item, index) => {
                 const cardPayload = buildEstablishmentCard(item, index);
              const cardSource = normaliseEstablishmentSource(item);
              const itemKey =
                cardPayload.id ??
                item.travel_recommendation_id ??
                item.business_establishment_id ??
                `pick-${index}`;

              return (
                <View key={itemKey} style={styles.horizontalCardWrapper}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => openDetail(cardSource)}>
                    <DestinationCard item={cardPayload} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.horizontalAddButton}
                    onPress={() => addToPlanner(cardSource)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name='add-circle-outline' size={16} color={colors.primary} />
                    <Text style={styles.horizontalAddText}>Add to itinerary</Text>
                  </TouchableOpacity>
                </View>
              );
              })}
            </ScrollView>
          )}

        {pendingCount > 0 && (
          <View style={styles.proceedCard}>
            <Text style={styles.proceedCopy}>
              {pendingCount === 1
                ? '1 destination ready for route planning.'
                : `${pendingCount} destinations ready for route planning.`}
            </Text>
            <TouchableOpacity
              style={styles.proceedButton}
              onPress={() => router.push('/itinerary')}
              activeOpacity={0.9}
            >
              <Ionicons name='navigate-outline' size={18} color={colors.white} />
              <Text style={styles.proceedButtonText}>Proceed to route planning</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!selectedDestination}
        transparent
        animationType='slide'
        onRequestClose={() => {
          setSelectedDestination(null);
          setDetailInfo(null);
        }}
      >
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            {detailCard ? (
              <ScrollView contentContainerStyle={styles.detailContent}>
                <View style={styles.detailHero}>
                  <ImageBackground
                    source={detailCard.image}
                    style={styles.detailImage}
                    imageStyle={styles.detailImageBorder}
                  >
                    <View style={styles.detailImageOverlay} />
                    <View style={styles.detailImageContent}>
                      <Text style={styles.detailTagline}>Verified Destination</Text>
                      <Text style={styles.detailTitle}>{detailCard.title}</Text>
                      <Text style={styles.detailSubtitle}>{detailCard.municipality}</Text>
                    </View>
                  </ImageBackground>
                </View>

                <View style={styles.detailChips}>
                  {detailTags.length ? (
                    detailTags.map(tag => (
                      <View key={tag} style={styles.detailChip}>
                        <Text style={styles.detailChipText}>{toTitle(tag)}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.detailChip}>
                      <Text style={styles.detailChipText}>Accredited</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailActionsRow}>
                  <TouchableOpacity style={styles.detailActionPill} activeOpacity={0.85}>
                    <Ionicons name='map-outline' size={18} color={colors.primary} />
                    <Text style={styles.detailActionText}>Nearby</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailActionPill} activeOpacity={0.85}>
                    <Ionicons name='bookmark-outline' size={18} color={colors.primary} />
                    <Text style={styles.detailActionText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailActionPill} activeOpacity={0.85}>
                    <Ionicons name='share-outline' size={18} color={colors.primary} />
                    <Text style={styles.detailActionText}>Share</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>About</Text>
                  <Text style={styles.detailBodyText}>
                    {detailInfo?.description ?? detailCard.reason ?? 'No description provided yet.'}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Essential info</Text>
                  <View style={styles.detailInfoRow}>
                    <Ionicons name='location-outline' size={18} color={colors.primary} />
                    <Text style={styles.detailInfoText}>
                      {detailInfo?.address ?? detailCard.municipality ?? 'Address coming soon.'}
                    </Text>
                  </View>
                  {detailInfo?.contact_info ? (
                    <View style={styles.detailInfoRow}>
                      <Ionicons name='call-outline' size={18} color={colors.primary} />
                      <Text style={styles.detailInfoText}>{detailInfo.contact_info}</Text>
                    </View>
                  ) : null}
                  {detailInfo?.accreditation_no ? (
                    <View style={styles.detailInfoRow}>
                      <Ionicons name='shield-checkmark-outline' size={18} color={colors.primary} />
                      <Text style={styles.detailInfoText}>
                        DOT Accreditation: {detailInfo.accreditation_no}
                      </Text>
                    </View>
                  ) : null}
                  {budgetLabel ? (
                    <View style={styles.detailInfoRow}>
                      <Ionicons name='cash-outline' size={18} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailInfoText}>Budget: {budgetLabel}</Text>
                        {detailAverageSpend ? (
                          <Text style={styles.detailBodyText}>Average spend: {detailAverageSpend}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Traveler feedback</Text>
                  {feedbackSummary ? (
                    <View style={styles.detailRatingSummary}>
                      <View style={styles.ratingBadge}>
                        <Ionicons name='star' size={20} color='#facc15' />
                        <Text style={styles.ratingBadgeText}>
                          {feedbackSummary.average_rating?.toFixed(1) ?? '0.0'}
                        </Text>
                      </View>
                      <Text style={styles.detailBodyText}>
                        Based on {feedbackSummary.count ?? 0} verified reviews.
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.detailBodyText}>
                      No ratings yet. Be the first to review!
                    </Text>
                  )}

                  {feedbackItems.length ? (
                    <View style={styles.detailFeedbackList}>
                      {feedbackItems.map((fb, idx) => (
                        <View key={fb.feedback_id ?? idx} style={styles.detailFeedbackCard}>
                          <View style={styles.detailFeedbackHeader}>
                            <View style={styles.detailFeedbackAvatar}>
                              <Text style={styles.detailFeedbackInitials}>
                                {(fb.tourist_name ?? 'Guest')
                                  .split(' ')
                                  .map(n => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailFeedbackName}>
                                {fb.tourist_name ?? 'Verified traveler'}
                              </Text>
                              <Text style={styles.detailFeedbackMeta}>
                                {formatReviewDate(fb.createdAt)}
                              </Text>
                            </View>
                            {typeof fb.rating === 'number' ? (
                              <View style={styles.detailFeedbackScore}>
                                <Ionicons name='star' size={14} color='#facc15' />
                                <Text style={styles.detailFeedbackScoreText}>
                                  {fb.rating.toFixed(1)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.detailFeedbackBody}>
                            {fb.comment ?? fb.review ?? 'No comment provided.'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            ) : null}

            <View style={styles.detailFooter}>
              <TouchableOpacity
                style={styles.detailPrimary}
                onPress={() => addToPlanner(selectedDestination)}
                activeOpacity={0.85}
                disabled={detailLoading}
              >
                {detailLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name='add' size={18} color={colors.white} />
                    <Text style={styles.detailPrimaryText}>Add to itinerary</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailSecondary}
                onPress={() => {
                  setSelectedDestination(null);
                  setDetailInfo(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.detailSecondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={mapModalVisible}
        animationType='slide'
        presentationStyle='fullScreen'
        onRequestClose={() => setMapModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Map preview</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setMapModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalMapContainer}>
            <MapView
              ref={modalMapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={mapRegion}
              onRegionChangeComplete={setMapRegion}
              showsCompass
              showsPointsOfInterest={false}
              zoomControlEnabled
              rotateEnabled
              pitchEnabled
            >
              {mapMarkers.map(marker => (
                <Marker
                  key={marker.id}
                  coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                  title={marker.title}
                  description={marker.snippet}
                  pinColor='#6c5ce7'
                  onPress={() => openDetail(marker.cardSource)}
                />
              ))}
              {userLocation ? (
                <Marker coordinate={userLocation} title='You are here' pinColor='#ff6b6b' />
              ) : null}
            </MapView>

            <TouchableOpacity
              style={styles.modalLocateButton}
              onPress={handleLocate}
              activeOpacity={0.85}
            >
              <Ionicons name='navigate' size={18} color={colors.primary} />
              <Text style={styles.modalLocateText}>Locate me</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing(1.5),
  },
  root: { flex: 1 },
  content: { paddingHorizontal: spacing(1.5), paddingBottom: spacing(4), gap: spacing(2.5) },
  hero: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
  heroSubtitle: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 20 },
  filtersCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2),
    gap: spacing(1.5),
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  filtersTitle: { fontFamily: 'Inter_600SemiBold', color: colors.text },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  filterChip: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.6),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
  },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 13 },
  filterChipTextSelected: { color: colors.white },
  inlineInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing(1),
    rowGap: spacing(1),
  },
  inputGroup: {
    gap: spacing(0.5),
    flexGrow: 1,
    minWidth: 140,
  },
  inputGroupHalf: { flexBasis: '48%' },
  inputGroupFull: { flexBasis: '100%' },
  inputLabel: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 12 },
  inputField: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    paddingHorizontal: spacing(1),
    backgroundColor: 'rgba(108,92,231,0.08)',
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  inputHint: { fontFamily: 'Inter_400Regular', color: colors.muted, fontSize: 12 },
  primaryButton: {
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing(0.75),
  },
  primaryButtonDisabled: { backgroundColor: colors.muted, opacity: 0.6 },
  primaryButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.white, fontSize: 16 },
  secondaryButton: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  mapWrapper: { position: 'relative' },
  mapContainer: {
    height: 280,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  map: { flex: 1 },
  mapPlaceholder: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(2.5),
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  mapTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text },
  mapSubtitle: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  mapControls: {
    position: 'absolute',
    bottom: spacing(1),
    left: spacing(1),
    right: spacing(1),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapLocateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: colors.white,
    paddingHorizontal: spacing(1.2),
    paddingVertical: spacing(0.6),
    borderRadius: 999,
    elevation: 2,
  },
  mapLocateText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  mapExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: 'rgba(108,92,231,0.85)',
    paddingHorizontal: spacing(1.2),
    paddingVertical: spacing(0.6),
    borderRadius: 999,
  },
  mapExpandText: { color: colors.white, fontFamily: 'Inter_600SemiBold' },
  bundleRow: { paddingHorizontal: spacing(0.5), gap: spacing(1.5) },
  bundleCard: {
    width: 260,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    gap: spacing(0.75),
    marginRight: spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
  },
  bundleTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.text },
  bundleDescription: { fontFamily: 'Inter_400Regular', color: colors.muted, lineHeight: 18 },
  bundleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(0.5) },
  bundleTag: {
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.12)',
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.25),
  },
  bundleTagText: { fontFamily: 'Inter_500Medium', color: colors.primary, fontSize: 12 },
  bundleButton: {
    marginTop: spacing(0.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
  },
  bundleButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  linkText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  cardWrapper: {
    gap: spacing(0.75),
    marginBottom: spacing(1.5),
  },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.5) },
  addButtonText: { fontFamily: 'Inter_600SemiBold', color: colors.primary },
  emptyState: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing(2),
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
    padding: spacing(1.5),
  },
  detailSheet: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingTop: spacing(1.5),
    paddingHorizontal: spacing(1.5),
    paddingBottom: spacing(1),
    maxHeight: '82%',
  },
  detailContent: {
    gap: spacing(1.5),
    paddingBottom: spacing(1.5),
  },
  detailHero: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  detailImage: {
    height: 160,
    width: '100%',
    justifyContent: 'flex-end',
  },
  detailImageBorder: {
    borderRadius: radii.lg,
  },
  detailImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  detailImageContent: {
    padding: spacing(1.5),
    gap: spacing(0.25),
  },
  detailTagline: {
    fontFamily: 'Inter_500Medium',
    color: colors.white,
    fontSize: 12,
  },
  detailTitle: {
    fontFamily: 'Inter_700Bold',
    color: colors.white,
    fontSize: 20,
  },
  detailSubtitle: {
    fontFamily: 'Inter_400Regular',
    color: colors.white,
    opacity: 0.85,
  },
  detailChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(0.6),
  },
  detailChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(108,92,231,0.15)',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.35),
  },
  detailChipText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    fontSize: 12,
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: spacing(0.75),
  },
  detailActionPill: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.2)',
    backgroundColor: 'rgba(108,92,231,0.05)',
    paddingVertical: spacing(0.75),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
  },
  detailActionText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    fontSize: 13,
  },
  detailSection: {
    gap: spacing(0.75),
  },
  detailSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    fontSize: 16,
  },
  detailBodyText: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    lineHeight: 20,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
  },
  detailInfoText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  detailRatingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: 'rgba(250,204,21,0.15)',
    paddingHorizontal: spacing(0.75),
    paddingVertical: spacing(0.4),
    borderRadius: radii.sm,
  },
  ratingBadgeText: {
    fontFamily: 'Inter_700Bold',
    color: '#b45309',
  },
  detailFeedbackList: {
    gap: spacing(1),
  },
  detailFeedbackCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
    backgroundColor: 'rgba(108,92,231,0.05)',
    padding: spacing(1),
    gap: spacing(0.5),
  },
  detailFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.75),
  },
  detailFeedbackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(108,92,231,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailFeedbackInitials: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  detailFeedbackName: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  detailFeedbackMeta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 12,
  },
  detailFeedbackScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.25),
  },
  detailFeedbackScoreText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#b45309',
  },
  detailFeedbackBody: {
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    lineHeight: 18,
  },
  detailFooter: {
    marginTop: spacing(1),
    gap: spacing(0.75),
  },
  detailPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.75),
    backgroundColor: colors.primary,
    paddingVertical: spacing(1),
    borderRadius: radii.md,
  },
  detailPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  detailSecondary: {
    alignItems: 'center',
    paddingVertical: spacing(0.75),
  },
  detailSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.text,
  },
  modalCloseButton: {
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.5),
    backgroundColor: 'rgba(108,92,231,0.15)',
    borderRadius: radii.sm,
  },
  modalCloseText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  modalMapContainer: {
    flex: 1,
    position: 'relative',
  },
  modalLocateButton: {
    position: 'absolute',
    left: spacing(1.5),
    bottom: spacing(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing(1.2),
    paddingVertical: spacing(0.6),
    elevation: 2,
  },
  modalLocateText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  proceedCard: {
    marginTop: spacing(2),
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing(1.5),
    gap: spacing(0.75),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.15)',
  },
  proceedCopy: {
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing(0.75),
  },
  proceedButtonText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  loadingSafe: {
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
   picksScroller: {
    paddingHorizontal: spacing(1),
    paddingBottom: spacing(1),
    gap: spacing(1),
  },
  horizontalCardWrapper: {
    width: 280,
    marginRight: spacing(1),
    gap: spacing(0.6),
  },
  horizontalAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.4),
  },
  horizontalAddText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  skeletonCard: {
    width: 240,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    padding: spacing(1),
    marginRight: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(108,92,231,0.12)',
    gap: spacing(0.75),
  },
  skeletonImage: {
    height: 140,
    borderRadius: radii.md,
    backgroundColor: 'rgba(15,23,42,0.08)',
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

});
