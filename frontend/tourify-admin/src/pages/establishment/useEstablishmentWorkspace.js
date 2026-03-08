import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchOwnerEstablishments,
  updateOwnerEstablishment,
  regenerateQr,
} from '../../services/establishmentApi';
import {
  fetchOwnerRatingTrend,
  fetchOwnerReviewCounts,
  fetchOwnerCheckins,
  fetchOwnerFeedbackCategories,
  fetchOwnerTagPerformance,
  fetchOwnerNationalities,
} from '../../services/ownerAnalyticsApi';

const initialForm = {
  type: '',
  ownershipType: 'private',
  address: '',
  description: '',
  contactInfo: '',
  accreditationNo: '',
  latitude: '',
  longitude: '',
  budgetMin: '',
  budgetMax: '',
};

const toValue = (promiseResult, path, fallback) => {
  if (promiseResult.status !== 'fulfilled') return fallback;
  return path(promiseResult.value) ?? fallback;
};

export const resolveQrLink = url => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || '';
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
};

export default function useEstablishmentWorkspace(estId) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');

  const [establishment, setEstablishment] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [analytics, setAnalytics] = useState({
    ratingTrend: [],
    reviewCounts: [],
    checkins: [],
    categories: [],
    tags: [],
    nationalities: [],
  });

  const loadWorkspace = useCallback(async () => {
    if (!estId) return;

    try {
      setLoading(true);
      setError('');
      setAnalyticsError('');

      const listRes = await fetchOwnerEstablishments({ limit: 200 });
      const list = Array.isArray(listRes?.data?.items) ? listRes.data.items : [];
      const selected = list.find(item => {
        const id = item.businessEstablishment_id || item.business_establishment_id || item.id;
        return id === estId;
      });

      if (!selected) throw new Error('Establishment not found in your account.');

      setEstablishment(selected);
      setForm({
        type: selected.type || '',
        ownershipType: selected.ownership_type || 'private',
        address: selected.address || '',
        description: selected.description || '',
        contactInfo: selected.contact_info || '',
        accreditationNo: selected.accreditation_no || '',
        latitude: selected.latitude ?? '',
        longitude: selected.longitude ?? '',
        budgetMin: selected.budget_min ?? '',
        budgetMax: selected.budget_max ?? '',
      });

      const analyticsResults = await Promise.allSettled([
        fetchOwnerRatingTrend(estId),
        fetchOwnerReviewCounts(estId),
        fetchOwnerCheckins(estId),
        fetchOwnerFeedbackCategories(estId),
        fetchOwnerTagPerformance(estId),
        fetchOwnerNationalities(estId, { limit: 8 }),
      ]);

      const [trendRes, reviewsRes, checkinsRes, categoriesRes, tagsRes, nationalitiesRes] = analyticsResults;

      setAnalytics({
        ratingTrend: toValue(trendRes, r => r?.data?.trend, []),
        reviewCounts: toValue(reviewsRes, r => r?.data?.monthly, []),
        checkins: toValue(checkinsRes, r => r?.data?.monthly, []),
        categories: toValue(categoriesRes, r => r?.data?.categories, []),
        tags: toValue(tagsRes, r => r?.data?.tags, []),
        nationalities: toValue(nationalitiesRes, r => r?.data?.nationalities, []),
      });

      if (analyticsResults.some(item => item.status === 'rejected')) {
        setAnalyticsError('Some analytics could not be loaded, but the page is still usable.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load establishment workspace.');
    } finally {
      setLoading(false);
    }
  }, [estId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const updateFormField = useCallback((name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const saveDetails = useCallback(
    async event => {
      event.preventDefault();
      if (!establishment?.businessEstablishment_id) return;
      setSaving(true);
      setMessage('');
      try {
        await updateOwnerEstablishment(establishment.businessEstablishment_id, {
          type: form.type,
          ownership_type: form.ownershipType,
          address: form.address || undefined,
          description: form.description || undefined,
          contact_info: form.contactInfo || undefined,
          accreditation_no: form.accreditationNo || undefined,
          latitude: form.latitude === '' ? undefined : Number(form.latitude),
          longitude: form.longitude === '' ? undefined : Number(form.longitude),
          budget_min: form.budgetMin === '' ? undefined : Number(form.budgetMin),
          budget_max: form.budgetMax === '' ? undefined : Number(form.budgetMax),
        });
        setMessage('Establishment details updated.');
        await loadWorkspace();
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to save establishment details.');
      } finally {
        setSaving(false);
      }
    },
    [establishment?.businessEstablishment_id, form, loadWorkspace],
  );

  const refreshQr = useCallback(async () => {
    if (!estId) return;
    try {
      await regenerateQr(estId);
      setMessage('QR code refreshed.');
      await loadWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to refresh QR code.');
    }
  }, [estId, loadWorkspace]);

  const stats = useMemo(() => {
    const latestRating = analytics.ratingTrend.length
      ? analytics.ratingTrend[analytics.ratingTrend.length - 1]?.rating
      : null;
    const totalReviews = analytics.reviewCounts.reduce((acc, row) => acc + (row.reviews || 0), 0);
    const totalVisits = analytics.checkins.reduce((acc, row) => acc + (row.qr || 0) + (row.manual || 0), 0);
    return {
      latestRating: latestRating == null ? '-' : Number(latestRating).toFixed(2),
      totalReviews,
      totalVisits,
    };
  }, [analytics]);

  return {
    loading,
    saving,
    error,
    message,
    analyticsError,
    establishment,
    form,
    analytics,
    stats,
    updateFormField,
    saveDetails,
    refreshQr,
    reload: loadWorkspace,
  };
}
