import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../constants/theme';
import FeedbackForm from '../../components/FeedbackForm';
import { createFeedback, uploadFeedbackMedia } from '../../lib/feedback';
import { useAuth } from '../../hooks/useAuth';

export default function FeedbackCompose() {
    const router = useRouter();
    const { estId, estName, itineraryId } = useLocalSearchParams();
    const { profile } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    <Text style={styles.subtitle}>
        {estName ?? 'Bohol establishment'}
        {!itineraryId ? ' · Walk-in review' : ''}
    </Text>

    if (!estId) {
    return (
    <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
        <Text style={styles.errorTitle}>Missing information</Text>
        <Text style={styles.errorBody}>
            We couldn’t identify the establishment you want to review.
        </Text>
        </View>
    </SafeAreaView>
    );
    }

    const handleSubmit = async ({ rating, review_text, assets }) => {
        if (!profile?.tourist_profile_id) {
            Alert.alert('Sign in required', 'You need to be logged in as a tourist to submit feedback.');
            return;
        }
    setSubmitting(true);
    try {
        const targetItineraryId = itineraryId && itineraryId.length ? itineraryId : `WALKIN-${Date.now()}`;

        const feedback = await createFeedback({
        itinerary_id: targetItineraryId,
        business_establishment_id: estId,
        rating,
        review_text,
        });
        if (feedback?.feedback_id && assets?.length) {
        await uploadFeedbackMedia(feedback.feedback_id, assets);
        }

        Alert.alert('Thank you!', 'Your feedback has been submitted.', [
        { text: 'View reviews', onPress: () => router.back() },
        ]);
    } catch (err) {
        console.error(err);
        Alert.alert('Unable to submit feedback', err.response?.data?.message ?? err.message ?? 'Please try again.');
    } finally {
        setSubmitting(false);
    }
    };

    return (
    <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
        <Text style={styles.title}>Share your experience</Text>
        <Text style={styles.subtitle}>{estName ?? 'Bohol establishment'}</Text>
        </View>
        <FeedbackForm onSubmit={handleSubmit} submitting={submitting} />
    </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing(1.5),
    },
    header: { paddingTop: spacing(2), paddingBottom: spacing(1.5), gap: spacing(0.5) },
    title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: colors.text },
    subtitle: { fontFamily: 'Inter_400Regular', color: colors.muted },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing(1), padding: spacing(2) },
    errorTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: colors.text },
    errorBody: { fontFamily: 'Inter_400Regular', color: colors.muted, textAlign: 'center', lineHeight: 18 },
});
