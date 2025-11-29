import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useMemo,useRef  } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    ImageBackground,
    Image,    
    Alert,
    Animated,
    Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';

import { colors, spacing, radii } from '../../constants/theme';
import DestinationCard from '../../components/DestinationCard';
import SectionHeader from '../../components/SectionHeader';
import client from '../../lib/http';
import {
    amenityIconMap,
    buildEstablishmentCard,
    extractEstablishmentId,
    formatReviewDate,
    normaliseEstablishmentSource,
    toTitle,
} from '../../lib/establishments';
import FeedbackCard from '../../components/FeedbackCard';
import { listPublicFeedback } from '../../lib/feedback';

const PENDING_KEY = '@tourify/pending_itinerary_stops';

export default function DestinationDetail() {
    const router = useRouter();
    const { id, recId, itineraryId  } = useLocalSearchParams();

    const [detail, setDetail] = useState(null);
    const [nearby, setNearby] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [pendingIds, setPendingIds] = useState(() => new Set());
    const [actionsExpanded, setActionsExpanded] = useState(false);

    const establishmentId = id ?? '';
    const normalised = normaliseEstablishmentSource(detail);
    const cardPayload = buildEstablishmentCard(normalised ?? {});
    const coords = useMemo(() => {
    const est = normalised?.establishment ?? {};
    const latitude = est.latitude ?? est.location?.coordinates?.[1];
    const longitude = est.longitude ?? est.location?.coordinates?.[0];
        return typeof latitude === 'number' && typeof longitude === 'number'
        ? { latitude, longitude }
        : null;
    }, [normalised]);

    const [feedbackPage, setFeedbackPage] = useState(1);
    const [feedbackSort, setFeedbackSort] = useState('newest');
    const [feedbackData, setFeedbackData] = useState({ items: [], total: 0, pages: 0, summary: null });
    const [loadingFeedback, setLoadingFeedback] = useState(true);

    const actionAnim = useRef(new Animated.Value(0)).current; // 0 collapsed, 1 expanded

    const [activeTab, setActiveTab] = useState('overview');
    
    const galleryItems = useMemo(() => {
        const est = normalised?.establishment ?? {};
        return (Array.isArray(est.media) ? est.media : [])
            .filter(item => (item.file_type ?? item.type ?? 'image').startsWith('image'))
            .map((item, index) => {
            const uri = item.file_url ?? item.url ?? item.uri ?? null;
            return {
                id: item.media_id ?? `${uri ?? index}`,
                source: uri ? { uri } : null,
                caption: item.caption ?? null,
            };
            })
            .filter(item => !!item.source);
    }, [normalised]);

    const galleryDisplayItems =
    galleryItems.length > 0
        ? galleryItems
        : cardPayload.image
        ? [{ id: 'fallback', source: cardPayload.image, caption: cardPayload.title }]
        : [];
    const tags = useMemo(() => {
        const set = new Set(cardPayload.tags);
        if (detail?.accreditation_no) set.add('DOT Accredited');
        if (detail?.is_ecofriendly) set.add('Eco-Friendly');
        if (detail?.is_verified) set.add('Verified');
        return Array.from(set);
    }, [cardPayload.tags, detail]);

    const amenities = useMemo(() => {
        const list = Array.isArray(detail?.amenities) ? detail.amenities : [];
        return list.filter(item => amenityIconMap[item.toLowerCase?.()] ?? false);
    }, [detail]);

    const toggleQueued = async () => {
        if (!normalised) return;
        setIsToggling(true);
        try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const array = Array.isArray(list) ? list : [];

        const targetId = extractEstablishmentId(normalised);
        const foundIndex = array.findIndex(item => extractEstablishmentId(item) === targetId);

        if (foundIndex >= 0) {
            array.splice(foundIndex, 1);
            Alert.alert('Itinerary updated', 'Destination removed from your pending route.');
        } else {
            array.push({
            ...normalised,
            queued_at: Date.now(),
            recommendation_context: recId ?? null,
            });
            Alert.alert('Itinerary updated', 'Destination added to your pending route.');
        }

        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(array));
        setPendingIds(new Set(array.map(item => extractEstablishmentId(item))));
        } catch (err) {
        console.warn('Unable to toggle itinerary queue', err);
        Alert.alert('Oops', 'We could not update your itinerary queue, please try again.');
        } finally {
        setIsToggling(false);
        }
    };

    const loadPendingIds = async () => {
        try {
        const raw = await AsyncStorage.getItem(PENDING_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const array = Array.isArray(list) ? list : [];
        setPendingIds(new Set(array.map(item => extractEstablishmentId(item))));
        } catch {
        setPendingIds(new Set());
        }
    };

    useEffect(() => {
        if (!establishmentId) return;
        setIsLoading(true);

        Promise.all([
        client
            .get(`/public/establishments/${establishmentId}`)
            .then(res => res.data)
            .catch(err => {
            throw err;
            }),
        client
            .get(`/public/establishments/${establishmentId}/nearby`, { params: { radius: 3 } })
            .then(res => res.data?.items ?? [])
            .catch(() => []),
        ])
        .then(([estData, nearbyData]) => {
            setDetail({
            ...estData.establishment,
            feedback_summary: estData.feedback_summary,
            recent_feedback:
                estData.recent_feedback ??
                estData.feedback_preview ??
                estData.feedbacks ??
                [],
            });
            setNearby(nearbyData);
            loadPendingIds();
        })
        .catch(err => {
            console.warn('Unable to load destination detail', err);
            Alert.alert(
            'Destination unavailable',
            'We could not load this destination right now. Please try again later.',
            [{ text: 'OK', onPress: () => router.back() }]
            );
        })
        .finally(() => setIsLoading(false));
    }, [establishmentId]);

    useEffect(() => {
        if (!establishmentId) return;
        setLoadingFeedback(true);
        listPublicFeedback(establishmentId, { page: feedbackPage, sort: feedbackSort })
            .then(res => setFeedbackData(res))
            .catch(err => console.warn('Unable to load feedback', err))
            .finally(() => setLoadingFeedback(false));
    }, [establishmentId, feedbackPage, feedbackSort]);

    useEffect(() => {
        Animated.timing(actionAnim, {
            toValue: actionsExpanded ? 1 : 0,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [actionsExpanded]);

    if (isLoading) {
        return (
        <SafeAreaView style={styles.loadingSafe} edges={['top', 'bottom']}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading destination…</Text>
        </SafeAreaView>
        );
    }

    if (!normalised) {
        return (
        <SafeAreaView style={styles.loadingSafe} edges={['top', 'bottom']}>
            <Text style={styles.loadingText}>Destination not found.</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
            </TouchableOpacity>
        </SafeAreaView>
        );
    }

    // const feedback = Array.isArray(detail?.recent_feedback)
    //     ? detail.recent_feedback.slice(0, 3)
    //     : [];
    const isQueued = pendingIds.has(extractEstablishmentId(normalised));

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ImageBackground source={cardPayload.image} style={styles.heroImage}>
            <View style={styles.heroOverlay} />
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
            >
                <Ionicons name="arrow-back" size={20} color={colors.white} />
            </TouchableOpacity>

            <View style={styles.heroContent}>
                <View>
                <Text style={styles.heroTagline}>Verified Destination</Text>
                <Text style={styles.heroTitle}>{cardPayload.title}</Text>
                <Text style={styles.heroSubtitle}>{cardPayload.municipality}</Text>
                </View>
                <View style={styles.heroTags}>
                {tags.map(tag => (
                    <View key={tag} style={styles.heroTag}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.white} />
                    <Text style={styles.heroTagText}>{tag}</Text>
                    </View>
                ))}
                </View>
            </View>
            </ImageBackground>
            <View style={styles.tabRow}>
            {['overview', 'gallery'].map(tab => {
                const isActive = activeTab === tab;
                return (
                <TouchableOpacity
                    key={tab}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => setActiveTab(tab)}
                >
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab === 'overview' ? 'Overview' : 'Gallery'}
                    </Text>
                </TouchableOpacity>
                );
            })}
            </View>

            {activeTab === 'gallery' ? (
                <View style={styles.gallerySection}>
                    {galleryDisplayItems.length === 0 ? (
                    <Text style={styles.muted}>No uploads yet.</Text>
                    ) : (
                    <View style={styles.galleryGrid}>
                        {galleryDisplayItems.map((item, index) => (
                        <View
                            key={item.id}
                            style={[
                            styles.galleryTile,
                            (index % 6 === 0 || index % 6 === 3) && styles.galleryTileTall,
                            ]}
                        >
                            <Image
                            source={item.source}
                            style={styles.galleryTileImage}
                            resizeMode="contain"
                            />
                            {item.caption ? (
                            <View style={styles.galleryCaptionBadge}>
                                <Text style={styles.galleryCaptionText} numberOfLines={1}>
                                {item.caption}
                                </Text>
                            </View>
                            ) : null}
                        </View>
                        ))}
                    </View>
                    )}
                </View>
            ) : (
            <>
                <View style={styles.metaCard}>
                        <View style={styles.metaColumn}>
                            <Text style={styles.metaLabel}>Rating</Text>
                            <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={18} color="#facc15" />
                            <Text style={styles.ratingValue}>
                                {detail?.feedback_summary?.average_rating?.toFixed(1) ?? '0.0'}
                            </Text>
                            </View>
                        </View>
                        <View style={styles.metaColumn}>
                            <Text style={styles.metaLabel}>Status</Text>
                            <Text style={styles.metaValue}>
                            {detail?.open_now ? 'Open now' : 'Closed'}
                            </Text>
                            {detail?.hours ? (
                            <Text style={styles.metaSubtext}>{detail.hours}</Text>
                            ) : null}
                        </View>
                        <View style={styles.metaColumn}>
                            <Text style={styles.metaLabel}>Budget</Text>
                            <Text style={styles.metaValue}>
                            {detail?.price_range ?? 'Not specified'}
                            </Text>
                            {detail?.average_spend ? (
                            <Text style={styles.metaSubtext}>Avg. {detail.average_spend}</Text>
                            ) : null}
                        </View>
                        </View>
                        
                        <View style={styles.section}>
                        <SectionHeader title="Contact & Location" />
                        <View style={styles.contactCard}>
                            <InfoRow icon="location-outline" text={detail?.address ?? 'Address coming soon.'} />
                            {detail?.contact_info ? (
                            <InfoRow icon="call-outline" text={detail.contact_info} />
                            ) : null}
                            {detail?.email ? (
                            <InfoRow icon="mail-outline" text={detail.email} />
                            ) : null}
                            {detail?.website ? (
                            <InfoRow icon="globe-outline" text={detail.website} />
                            ) : null}
                            {coords ? (
                            <MapView style={styles.inlineMap} initialRegion={{ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
                                <Marker coordinate={coords} title={cardPayload.title} />
                            </MapView>
                            ) : null}
                            {coords ? (
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() =>
                                router.push({
                                    pathname: '/itinerary/live',
                                    params: {
                                    latitude: coords.latitude,
                                    longitude: coords.longitude,
                                    label: cardPayload.title,
                                    },
                                })
                                }
                                activeOpacity={0.85}
                            >
                                <Ionicons name="navigate" size={18} color={colors.white} />
                                <Text style={styles.primaryButtonText}>Open in live map</Text>
                            </TouchableOpacity>
                            ) : null}
                        </View>
                        </View>

                        <View style={styles.section}>
                        <SectionHeader title="About" />
                        <Text style={styles.bodyText}>
                            {detail?.description ?? cardPayload.reason ?? 'No description provided yet.'}
                        </Text>
                        </View>

                        {amenities.length ? (
                            <View style={styles.section}>
                                <SectionHeader title="Amenities" />
                                <View style={styles.amenitiesGrid}>
                                {amenities.map(item => {
                                    const id = item.toLowerCase();
                                    const iconName = amenityIconMap[id];
                                    return (
                                    <View key={item} style={styles.amenityChip}>
                                        <Ionicons name={iconName ?? 'information-circle-outline'} size={18} color={colors.primary} />
                                        <Text style={styles.amenityText}>{toTitle(item)}</Text>
                                    </View>
                                    );
                                })}
                                </View>
                            </View>
                            ) : null}

                            {nearby.length ? (
                            <View style={styles.section}>
                                <SectionHeader
                                title="Nearby services"
                                subtitle="Restaurants, transport hubs, and support within 3 km."
                                />
                                <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.nearbyScroller}
                                >
                                {nearby.map((item, index) => {
                                    const card = buildEstablishmentCard(item, index);
                                    const source = normaliseEstablishmentSource(item);
                                    return (
                                    <View key={card.id} style={styles.nearbyCardWrapper}>
                                        <DestinationCard item={card} />
                                        <TouchableOpacity
                                        style={styles.horizontalAddButton}
                                        onPress={() => toggleQueued(source)}
                                        activeOpacity={0.85}
                                        >
                                        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                                        <Text style={styles.horizontalAddText}>Add to itinerary</Text>
                                        </TouchableOpacity>
                                    </View>
                                    );
                                })}
                                </ScrollView>
                            </View>
                            ) : null}
            </>
            )}


            

            <View style={styles.section}>
                <SectionHeader
                    title="Traveler feedback"
                    subtitle={
                    feedbackData.summary
                        ? `${feedbackData.summary.average_rating.toFixed(1)} average (${feedbackData.summary.count} reviews)`
                        : 'Share your experience to help others.'
                    }
                    actionSlot={
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: '/feedback/compose',
                                params: {
                                estId: establishmentId,
                                estName: cardPayload.title,
                                itineraryId: itineraryId ?? '',
                                },
                            })
                        }
                        activeOpacity={0.85}
                    >
                        <Text style={styles.linkText}>Write a review</Text>
                    </TouchableOpacity>
                    }
                />

                <View style={styles.sortRow}>
                    {[
                    { key: 'newest', label: 'Most recent' },
                    { key: 'rating_desc', label: 'Top rated' },
                    { key: 'rating_asc', label: 'Lowest rating' },
                    ].map(opt => (
                    <TouchableOpacity
                        key={opt.key}
                        style={[styles.sortChip, feedbackSort === opt.key && styles.sortChipActive]}
                        onPress={() => {
                        setFeedbackSort(opt.key);
                        setFeedbackPage(1);
                        }}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.sortChipText, feedbackSort === opt.key && styles.sortChipTextActive]}>
                        {opt.label}
                        </Text>
                    </TouchableOpacity>
                    ))}
                </View>

                {loadingFeedback ? (
                    <ActivityIndicator color={colors.primary} />
                ) : feedbackData.items?.length ? (
                    <View style={styles.feedbackStack}>
                    {feedbackData.items.map(item => (
                        <FeedbackCard key={item.feedback_id} feedback={item} />
                    ))}
                    </View>
                ) : (
                    <Text style={styles.bodyText}>No reviews yet. Be the first to leave feedback!</Text>
                )}
                </View>

        </ScrollView>

        <Animated.View
    pointerEvents={actionsExpanded ? 'auto' : 'none'}
    style={[
        styles.footer,
        {
        opacity: actionAnim,
        transform: [
            {
            translateY: actionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
            }),
            },
        ],
        },
    ]}
    >
    <TouchableOpacity
        style={[
        styles.primaryButton,
        pendingIds.has(extractEstablishmentId(normalised)) && styles.primaryButtonGhost,
        ]}
        onPress={toggleQueued}
        activeOpacity={0.85}
        disabled={isToggling}
    >
        {isToggling ? (
        <ActivityIndicator color={colors.white} />
        ) : (
        <>
            <Ionicons
            name={
                pendingIds.has(extractEstablishmentId(normalised))
                ? 'checkmark-circle-outline'
                : 'add-circle-outline'
            }
            size={18}
            color={
                pendingIds.has(extractEstablishmentId(normalised)) ? colors.primary : colors.white
            }
            />
            <Text
            style={[
                styles.primaryButtonText,
                pendingIds.has(extractEstablishmentId(normalised)) && styles.primaryButtonGhostText,
            ]}
            >
            {pendingIds.has(extractEstablishmentId(normalised))
                ? 'Remove from itinerary'
                : 'Add to itinerary'}
            </Text>
        </>
        )}
    </TouchableOpacity>

    <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/itinerary')}
        activeOpacity={0.85}
    >
        <Text style={styles.secondaryButtonText}>View itinerary</Text>
    </TouchableOpacity>
    </Animated.View>

    <TouchableOpacity
    style={[styles.footerToggle, actionsExpanded && styles.footerToggleOpen]}
    onPress={() => setActionsExpanded(prev => !prev)}
    activeOpacity={0.9}
    >
    <Animated.View
        style={{
        transform: [
            {
            rotate: actionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '135deg'], // 135° gives a nice “×” when open
            }),
            },
        ],
        }}
    >
        <Ionicons name="add" size={28} color={actionsExpanded ? colors.primary : colors.white} />
    </Animated.View>
    </TouchableOpacity>
        </SafeAreaView>
    );
    }

    function InfoRow({ icon, text }) {
    if (!text) return null;
    return (
        <View style={styles.infoRow}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.infoRowText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: spacing(14),
        gap: spacing(2),
    },
    heroImage: {
        height: 280,
        justifyContent: 'flex-end',
        position: 'relative',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    heroContent: {
        paddingHorizontal: spacing(2),
        paddingVertical: spacing(2),
        gap: spacing(1),
    },
    backButton: {
        position: 'absolute',
        top: spacing(2),
        left: spacing(1.5),
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(15,23,42,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    heroTagline: {
        color: colors.white,
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    heroTitle: {
        color: colors.white,
        fontFamily: 'Inter_700Bold',
        fontSize: 26,
    },
    heroSubtitle: {
        color: colors.white,
        fontFamily: 'Inter_400Regular',
        opacity: 0.85,
    },
    heroTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing(0.5),
    },
    heroTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.35),
        paddingHorizontal: spacing(0.9),
        paddingVertical: spacing(0.35),
        borderRadius: 999,
        backgroundColor: 'rgba(108,92,231,0.35)',
    },
    heroTagText: { color: colors.white, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    metaCard: {
        marginHorizontal: spacing(2),
        marginTop: -spacing(2),
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        padding: spacing(1.5),
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing(1.5),
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.15)',
    },
    metaColumn: {
        flex: 1,
        gap: spacing(0.35),
    },
    metaLabel: {
        fontFamily: 'Inter_500Medium',
        color: colors.muted,
        fontSize: 12,
    },
    metaValue: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.text,
        fontSize: 14,
    },
    metaSubtext: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        color: colors.muted,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.4),
        backgroundColor: 'rgba(250,204,21,0.15)',
        paddingHorizontal: spacing(0.75),
        paddingVertical: spacing(0.4),
        borderRadius: radii.sm,
    },
    ratingValue: {
        fontFamily: 'Inter_700Bold',
        color: '#b45309',
    },
    section: {
        paddingHorizontal: spacing(2),
        gap: spacing(1),
    },
    contactCard: {
    backgroundColor: colors.white,
        borderRadius: radii.lg,
        padding: spacing(1.5),
        gap: spacing(1),
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.12)',
    },
    infoRow: {
        flexDirection: 'row',
        gap: spacing(0.75),
        alignItems: 'center',
    },
    infoRowText: {
        flex: 1,
        fontFamily: 'Inter_500Medium',
        color: colors.text,
    },
    inlineMap: {
        height: 160,
        borderRadius: radii.lg,
    },
    bodyText: {
        fontFamily: 'Inter_400Regular',
        color: colors.muted,
        lineHeight: 20,
    },
    amenitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing(0.75),
    },
    amenityChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.5),
        paddingHorizontal: spacing(0.9),
        paddingVertical: spacing(0.5),
        backgroundColor: 'rgba(108,92,231,0.12)',
        borderRadius: 999,
    },
    amenityText: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.primary,
        fontSize: 12,
    },
    nearbyScroller: {
        paddingBottom: spacing(1),
        gap: spacing(1),
    },
    nearbyCardWrapper: {
        width: 240,
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
    feedbackList: {
        gap: spacing(1),
    },
    feedbackCard: {
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing(1.2),
        gap: spacing(0.75),
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.12)',
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.75),
    },
    feedbackAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(108,92,231,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackInitials: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.primary,
    },
    feedbackName: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.text,
    },
    feedbackMeta: {
        fontFamily: 'Inter_400Regular',
        color: colors.muted,
        fontSize: 12,
    },
    feedbackRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing(0.25),
    },
    feedbackRatingText: {
        fontFamily: 'Inter_600SemiBold',
        color: '#b45309',
    },
    feedbackBody: {
        fontFamily: 'Inter_400Regular',
        color: colors.text,
        lineHeight: 18,
    },
    footer: {
        position: 'absolute',
        left: spacing(2),
        right: spacing(2),
        bottom: spacing(10),
        padding: spacing(1.25),
        borderRadius: radii.lg,
        gap: spacing(0.75),
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.12)',
        shadowColor: '#0f172a',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },

    footerToggle: {
        position: 'absolute',
        right: spacing(2),
        bottom: spacing(2),
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 16,
    },

    footerToggleOpen: {
        bottom: spacing(2),
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    primaryButton: {
        height: 52,
        borderRadius: 999,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing(0.75),
    },
        primaryButtonGhost: {
        backgroundColor: 'rgba(108,92,231,0.12)',
    },
    primaryButtonText: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.white,
        fontSize: 16,
    },
    primaryButtonGhostText: {
    
    },
    secondaryButton: {
        height: 48,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.primary,
    },
    loadingSafe: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        gap: spacing(1),
    },
    loadingText: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.text,
    },
    sortRow: { flexDirection: 'row', gap: spacing(0.75), marginBottom: spacing(1) },
    sortChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.25)',
        paddingHorizontal: spacing(1.25),
        paddingVertical: spacing(0.4),
    },
    sortChipActive: { backgroundColor: 'rgba(108,92,231,0.12)', borderColor: colors.primary },
    sortChipText: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 13 },
    sortChipTextActive: { color: colors.primary },
    gallerySection: {
  marginHorizontal: spacing(2),
  marginTop: spacing(1.5),
    gap: spacing(0.75),
    },
    galleryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    galleryTitle: {
        fontFamily: 'Inter_700Bold',
        color: colors.text,
        fontSize: 18,
    },
    galleryCount: {
        fontFamily: 'Inter_500Medium',
        color: colors.muted,
        fontSize: 14,
    },
    galleryRow: {
    
    },
    galleryImage: {
        width: 140,
        height: 120,
        borderRadius: radii.md,
        overflow: 'hidden',
    },
    galleryImagePrimary: {
        width: 220,
        height: 150,
    },
    galleryImageRadius: {
        borderRadius: radii.md,
    },
    tabRow: {
        flexDirection: 'row',
        gap: spacing(0.75),
        marginHorizontal: spacing(2),
        marginTop: spacing(1.25),
    },
    tabButton: {
        flex: 1,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: 'rgba(108,92,231,0.2)',
        paddingVertical: spacing(0.75),
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    tabButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabLabel: {
        fontFamily: 'Inter_600SemiBold',
        color: colors.text,
    },
    tabLabelActive: {
        color: colors.white,
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing(0.75),
        justifyContent: 'space-between',
    },
    galleryTile: {
        width: '48%',
        aspectRatio: 3 / 4,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: 'rgba(15,23,42,0.05)',
    },
    galleryTileTall: { 
        aspectRatio: 2 / 3,
    },
        galleryTileImage: {
        borderRadius: radii.md,
        width: '100%',
        height: '100%',
    },
    galleryCaptionBadge: {
        position: 'absolute',
        left: spacing(0.5),
        right: spacing(0.5),
        bottom: spacing(0.5),
        backgroundColor: 'rgba(15,23,42,0.55)',
        borderRadius: radii.sm,
        paddingHorizontal: spacing(0.5),
        paddingVertical: spacing(0.25),
    },
    galleryCaptionText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        color: colors.white,
    },

});
