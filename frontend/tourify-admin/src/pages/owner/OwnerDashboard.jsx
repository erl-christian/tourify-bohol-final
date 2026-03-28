import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoChatbubbleEllipsesOutline,
  IoCompassOutline,
  IoStarOutline,
  IoTrailSignOutline,
} from 'react-icons/io5';
import OwnerLayout from '../../components/OwnerLayout';
import '../../styles/AdminDashboard.css';
import { fetchOwnerEstablishments } from '../../services/establishmentApi';
import {
  fetchOwnerRatingTrend,
  fetchOwnerReviewCounts,
  fetchOwnerCheckins,
} from '../../services/ownerAnalyticsApi';
import { fetchOwnerFeedback, ownerReplyToFeedback } from '../../services/feedbackApi';
import { useActionStatus } from '../../context/ActionStatusContext';
import OwnerAnalytics from './Analytics';

const getEstablishmentId = est =>
  est?.businessEstablishment_id ?? est?.business_establishment_id ?? est?.id ?? '';

const loadAllOwnerEstablishments = async () => {
  const limit = 100;
  let page = 1;
  let total = 0;
  const all = [];

  while (true) {
    const { data } = await fetchOwnerEstablishments({ page, limit });
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    if (!items.length) break;

    all.push(...items);
    total = Number(data?.total ?? all.length);
    if (all.length >= total) break;
    page += 1;
  }

  const unique = new Map();
  all.forEach(est => {
    const id = getEstablishmentId(est);
    if (id && !unique.has(id)) unique.set(id, est);
  });

  return Array.from(unique.values());
};

function OwnerDashboard() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const [businessName, setBusinessName] = useState('My Establishments');
  const [ownerEstablishments, setOwnerEstablishments] = useState([]);
  const [analyticsState, setAnalyticsState] = useState({
    loading: true,
    ratingTrend: [],
    reviewCounts: [],
    checkins: [],
    error: '',
  });

  const [feedbackState, setFeedbackState] = useState({
    loading: true,
    items: [],
    pendingReplies: 0,
    error: '',
  });

  const [replyDrafts, setReplyDrafts] = useState({});

  useEffect(() => {
    const loadEstablishments = async () => {
      try {
        const list = await loadAllOwnerEstablishments();
        if (!list.length) {
          setAnalyticsState(prev => ({
            ...prev,
            loading: false,
            error: 'No establishments found for this owner.',
          }));
          setFeedbackState(prev => ({
            ...prev,
            loading: false,
            pendingReplies: 0,
            error: 'No establishments found for this owner.',
          }));
          return;
        }

        setOwnerEstablishments(list);
        if (list.length === 1) {
          const only = list[0];
          setBusinessName(only.name ?? only.establishment_name ?? 'My Establishments');
        } else {
          setBusinessName('My Establishments');
        }
      } catch (err) {
        console.error('[OwnerDashboard] load establishments failed', err);
        setAnalyticsState(prev => ({
          ...prev,
          loading: false,
          error: 'Unable to load establishment info.',
        }));
        setFeedbackState(prev => ({
          ...prev,
          loading: false,
          pendingReplies: 0,
          error: 'Unable to load establishment info.',
        }));
      }
    };

    loadEstablishments();
  }, []);

  useEffect(() => {
    if (!ownerEstablishments.length) return;

    const loadAnalytics = async () => {
      try {
        setAnalyticsState(prev => ({ ...prev, loading: true, error: '' }));

        const perEstData = await Promise.all(
          ownerEstablishments.map(async est => {
            const estId = getEstablishmentId(est);
            if (!estId) return null;
            const [trendRes, reviewsRes, checkinsRes] = await Promise.all([
              fetchOwnerRatingTrend(estId),
              fetchOwnerReviewCounts(estId),
              fetchOwnerCheckins(estId),
            ]);
            return {
              ratingTrend: trendRes.data?.trend ?? [],
              reviewCounts: reviewsRes.data?.monthly ?? [],
              checkins: checkinsRes.data?.monthly ?? [],
            };
          }),
        );

        const normalized = perEstData.filter(Boolean);

        const mergedReviewMap = new Map();
        const mergedCheckinMap = new Map();
        const mergedRatingMap = new Map();

        normalized.forEach(entry => {
          const reviewsByMonth = new Map(
            entry.reviewCounts.map(point => [point.month, Number(point.reviews) || 0]),
          );

          entry.reviewCounts.forEach(point => {
            const existing = mergedReviewMap.get(point.month) ?? { month: point.month, reviews: 0 };
            existing.reviews += Number(point.reviews) || 0;
            mergedReviewMap.set(point.month, existing);
          });

          entry.checkins.forEach(point => {
            const existing = mergedCheckinMap.get(point.month) ?? {
              month: point.month,
              qr: 0,
              manual: 0,
            };
            existing.qr += Number(point.qr) || 0;
            existing.manual += Number(point.manual) || 0;
            mergedCheckinMap.set(point.month, existing);
          });

          entry.ratingTrend.forEach(point => {
            const rating = Number(point.rating);
            if (!Number.isFinite(rating)) return;
            const weight = reviewsByMonth.get(point.month) || 1;
            const existing = mergedRatingMap.get(point.month) ?? {
              month: point.month,
              weightedRating: 0,
              weight: 0,
            };
            existing.weightedRating += rating * weight;
            existing.weight += weight;
            mergedRatingMap.set(point.month, existing);
          });
        });

        const reviewCounts = Array.from(mergedReviewMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month),
        );
        const checkins = Array.from(mergedCheckinMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month),
        );
        const ratingTrend = Array.from(mergedRatingMap.values())
          .map(row => ({
            month: row.month,
            rating: row.weight ? Number((row.weightedRating / row.weight).toFixed(2)) : 0,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        setAnalyticsState({
          loading: false,
          ratingTrend,
          reviewCounts,
          checkins,
          error: '',
        });
      } catch (err) {
        console.error('[OwnerDashboard] analytics fetch failed', err);
        setAnalyticsState({
          loading: false,
          ratingTrend: [],
          reviewCounts: [],
          checkins: [],
          error: 'Unable to load performance data right now.',
        });
      }
    };

    loadAnalytics();
  }, [ownerEstablishments]);

  const loadFeedback = useCallback(async () => {
    if (!ownerEstablishments.length) return;
    try {
      setFeedbackState(prev => ({ ...prev, loading: true, error: '' }));

      const responses = await Promise.all(
        ownerEstablishments.map(async est => {
          const estId = getEstablishmentId(est);
          if (!estId) return [];
          const { data } = await fetchOwnerFeedback(estId, {
            page: 1,
            pageSize: 200,
            sort: 'newest',
          });
          const items = data?.feedback ?? data?.items ?? [];
          return items.map(item => ({
            ...item,
            establishment_name: est.name ?? est.establishment_name ?? estId,
          }));
        }),
      );

      const merged = responses
        .flat()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setFeedbackState({
        loading: false,
        items: merged.slice(0, 3),
        pendingReplies: merged.filter(item => !item.reply).length,
        error: '',
      });
    } catch (err) {
      console.error('[OwnerDashboard] feedback fetch failed', err);
      setFeedbackState({
        loading: false,
        items: [],
        pendingReplies: 0,
        error: 'Unable to load feedback right now.',
      });
    }
  }, [ownerEstablishments]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleReplySubmit = async feedbackId => {
    const draft = replyDrafts[feedbackId]?.trim();
    if (!draft) return;
    try {
      showLoading('Sending reply...');
      await ownerReplyToFeedback(feedbackId, { reply: draft });
      setReplyDrafts(prev => ({ ...prev, [feedbackId]: '' }));
      await loadFeedback();
      showSuccess('Reply sent successfully.');
    } catch (err) {
      console.error('[OwnerDashboard] reply failed', err);
      showError('Unable to send reply right now.');
    }
  };

  const quickMetrics = useMemo(() => {
    const latestRating = analyticsState.ratingTrend.at(-1)?.rating ?? null;
    const ratingCount = analyticsState.reviewCounts.reduce((acc, item) => acc + (item.reviews ?? 0), 0);
    const checkinsCount = analyticsState.checkins.reduce(
      (acc, item) => acc + (item.qr ?? 0) + (item.manual ?? 0),
      0,
    );
    const latestMonth = analyticsState.ratingTrend.at(-1)?.month ?? 'No data yet';
    const pendingReplies = Number(feedbackState.pendingReplies || 0);

    return [
      {
        id: 'avg-rating',
        label: 'Average Rating',
        value: typeof latestRating === 'number' ? `${latestRating.toFixed(2)} stars` : '--',
        helper: `${ratingCount} total reviews`,
        icon: <IoStarOutline />,
      },
      {
        id: 'checkins',
        label: 'Visitor Check-ins',
        value: checkinsCount ? checkinsCount.toLocaleString() : '--',
        helper: 'QR + manual captures',
        icon: <IoTrailSignOutline />,
      },
      {
        id: 'latest-month',
        label: 'Latest Trend Month',
        value: latestMonth,
        helper: 'Based on rating trend',
        icon: <IoCompassOutline />,
      },
      {
        id: 'pending-replies',
        label: 'Pending Replies',
        value: pendingReplies.toLocaleString(),
        helper: 'Recent feedback to answer',
        icon: <IoChatbubbleEllipsesOutline />,
      },
    ];
  }, [analyticsState.ratingTrend, analyticsState.reviewCounts, analyticsState.checkins, feedbackState.items]);

  return (
    <OwnerLayout
      title={`${businessName} Dashboard & Overview`}
      subtitle="Business overview, analytics snapshot, and feedback operations in one page."
    >
      <div className="bto-merged-content bto-merged-content--clean">
        <section className="bto-overview-strip">
          <header className="merged-section-head bto-overview-head">
            <h2>Dashboard Overview</h2>
            <p>Quick access to establishment metrics and performance analytics.</p>
          </header>
          <div className="bto-overview-actions">
            <a href="#owner-metrics-section" className="ghost-cta bto-link-cta">
              Go to Metrics
            </a>
            <a href="#owner-performance-section" className="primary-cta bto-link-cta">
              Go to Performance Analytics
            </a>
          </div>
          <div className="bto-overview-grid">
            {quickMetrics.map(item => (
              <article key={item.id} className="bto-overview-card">
                <p className="bto-overview-label">{item.label}</p>
                <h3>{item.value}</h3>
                <p className="bto-overview-hint">{item.helper}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="owner-metrics-section" className="merged-management-block merged-management-block--clean">
          <header className="merged-section-head">
            <h2>Overview & Analytics</h2>
            <p>Live performance indicators from reviews and check-ins.</p>
          </header>
          {analyticsState.error ? (
            <p className="error-text">{analyticsState.error}</p>
          ) : (
            <section className="analytics-summary-grid">
              {quickMetrics.map(item => (
                <article key={item.id} className="summary-card summary-card--compact">
                  <div className="summary-icon">{item.icon}</div>
                  <p className="summary-label">{item.label}</p>
                  <p className="summary-value">{item.value}</p>
                  <p className="summary-helper">{item.helper}</p>
                </article>
              ))}
            </section>
          )}
        </section>

        <section id="owner-feedback-section" className="merged-management-block merged-management-block--clean">
          <header className="merged-section-head">
            <h2>Recent Feedback</h2>
            <p>Reply quickly to improve guest trust and satisfaction.</p>
          </header>

          <div className="table-shell scrollable-table">
            <div className="table-head table-grid">
              <span>Guest</span>
              <span>Comment</span>
              <span>Rating</span>
              <span>Date</span>
              <span>Reply</span>
            </div>

            <ul className="table-body">
              {feedbackState.loading ? (
                <li className="table-row table-grid">
                  <div className="muted">Loading feedback...</div>
                </li>
              ) : feedbackState.error ? (
                <li className="table-row table-grid">
                  <div className="error-text">{feedbackState.error}</div>
                </li>
              ) : feedbackState.items.length === 0 ? (
                <li className="table-row table-grid">
                  <div className="muted">No reviews yet for this establishment.</div>
                </li>
              ) : (
                feedbackState.items.map(item => (
                  <li key={item.feedback_id || item.id} className="table-row table-grid owner-feedback-row">
                    <div className="account-cell">
                      <p className="account-name">{item.tourist_name ?? 'Verified traveler'}</p>
                      <p className="account-email">Profile ID: {item.tourist_profile_id ?? '--'}</p>
                    </div>
                    <div>
                      <p className="muted">{item.review_text ?? 'No written comment.'}</p>
                      {item.reply ? (
                        <p className="owner-reply-chip">
                          Your reply:{' '}
                          <span>
                            {item.reply} ({item.repliedAt ? new Date(item.repliedAt).toLocaleString() : ''})
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <span className="status-chip status-success">
                        {Number(item.rating ?? 0).toFixed(1)} stars
                      </span>
                    </div>
                    <div className="muted">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '--'}
                    </div>
                    <div className="owner-reply-cell">
                      <textarea
                        rows={3}
                        placeholder="Type a short response..."
                        value={replyDrafts[item.feedback_id] ?? ''}
                        onChange={event =>
                          setReplyDrafts(prev => ({ ...prev, [item.feedback_id]: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleReplySubmit(item.feedback_id)}
                        disabled={!replyDrafts[item.feedback_id]?.trim()}
                      >
                        Send reply
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <section
          id="owner-performance-section"
          className="merged-management-block merged-management-block--clean"
        >
          <header className="merged-section-head">
            <h2>Performance Analytics</h2>
            <p>Detailed charts for ratings, check-ins, categories, tags, and nationality mix.</p>
          </header>
          <OwnerAnalytics embedded />
        </section>
      </div>
    </OwnerLayout>
  );
}

export default OwnerDashboard;
