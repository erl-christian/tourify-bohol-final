import { useCallback, useEffect, useMemo, useState } from 'react';
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

function OwnerDashboard() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const [businessName, setBusinessName] = useState('Your Establishment');
  const [establishmentId, setEstablishmentId] = useState('');
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
    error: '',
  });

  const [replyDrafts, setReplyDrafts] = useState({});

  // grab the owner’s establishment once after login
  useEffect(() => {
    const loadEstablishments = async () => {
      try {
        const { data } = await fetchOwnerEstablishments({ limit: 1 });
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!list.length) {
          setAnalyticsState(prev => ({
            ...prev,
            loading: false,
            error: 'No establishments found for this owner.',
          }));
          setFeedbackState(prev => ({
            ...prev,
            loading: false,
            error: 'No establishments found for this owner.',
          }));
          return;
        }
        const first = list[0];
        const estId = first.businessEstablishment_id ?? first.id ?? '';
        setBusinessName(first.name ?? first.establishment_name ?? 'Your Establishment');
        setEstablishmentId(estId);
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
          error: 'Unable to load establishment info.',
        }));
      }
    };

    loadEstablishments();
  }, []);

  // load analytics once we know the establishment id
  useEffect(() => {
    if (!establishmentId) return;

    const loadAnalytics = async () => {
      try {
        setAnalyticsState(prev => ({ ...prev, loading: true, error: '' }));
        const [trendRes, reviewsRes, checkinsRes] = await Promise.all([
          fetchOwnerRatingTrend(establishmentId),
          fetchOwnerReviewCounts(establishmentId),
          fetchOwnerCheckins(establishmentId),
        ]);

        setAnalyticsState({
          loading: false,
          ratingTrend: trendRes.data?.trend ?? [],
          reviewCounts: reviewsRes.data?.monthly ?? [],
          checkins: checkinsRes.data?.monthly ?? [],
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
  }, [establishmentId]);

  // fetch the latest feedback (limit 3) for quick replies
  const loadFeedback = useCallback(async () => {
    if (!establishmentId) return;
    try {
      setFeedbackState(prev => ({ ...prev, loading: true, error: '' }));
      const { data } = await fetchOwnerFeedback(establishmentId, {
        page: 1,
        pageSize: 3,
        sort: 'newest',
      });
      setFeedbackState({
        loading: false,
        items: data?.feedback ?? data?.items ?? [],
        error: '',
      });
    } catch (err) {
      console.error('[OwnerDashboard] feedback fetch failed', err);
      setFeedbackState({
        loading: false,
        items: [],
        error: 'Unable to load feedback right now.',
      });
    }
  }, [establishmentId]);

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
    const latestRating = analyticsState.ratingTrend.at(-1)?.rating ?? '—';
    const ratingCount = analyticsState.reviewCounts.reduce((acc, item) => acc + (item.reviews ?? 0), 0);
    const checkins30d = analyticsState.checkins.reduce(
      (acc, item) => acc + (item.qr ?? 0) + (item.manual ?? 0),
      0,
    );

    return [
      {
        id: 'avg-rating',
        label: 'Average rating',
        value: typeof latestRating === 'number' ? `${latestRating.toFixed(2)} ★` : '—',
        change: `${ratingCount} reviews in range`,
        tone: 'success',
      },
      {
        id: 'checkins',
        label: 'Visitor check-ins (period)',
        value: checkins30d ? checkins30d.toLocaleString() : '—',
        change: 'QR + manual captures',
        tone: 'success',
      },
    ];
  }, [analyticsState.ratingTrend, analyticsState.reviewCounts, analyticsState.checkins]);

  return (
    <OwnerLayout
      title={`${businessName} overview`}
      subtitle="Glance at key metrics, respond to fresh feedback, and keep guests happy."
      searchPlaceholder="Search insights or reports..."
    >
      <section className="account-management">
        <div className="section-heading">
          <h2>Quick metrics</h2>
          <p>
            Live signals from your establishment analytics. These update as reviews and check-ins are
            recorded.
          </p>
        </div>

        {analyticsState.error ? (
          <p className="error-text">{analyticsState.error}</p>
        ) : (
          <div className="stat-summary">
            {quickMetrics.map(metric => (
              <article key={metric.id} className="stat-card">
                <div className="stat-icon" />
                <div className="stat-details">
                  <p className="stat-label">{metric.label}</p>
                  <p className="stat-value">{metric.value}</p>
                  <p className={`stat-trend trend-${metric.tone}`}>{metric.change}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="account-management">
        <div className="section-heading">
          <h2>Recent feedback</h2>
          <p>Replying quickly improves your provincial rating and boosts guest trust.</p>
        </div>

        <div className="table-shell">
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
                <div className="muted">Loading feedback…</div>
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
                    <p className="account-email">Profile ID: {item.tourist_profile_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="muted">{item.review_text ?? 'No written comment.'}</p>
                    {item.reply ? (
                      <p className="owner-reply-chip">
                        Your reply:{' '}
                        <span>
                          {item.reply} ({item.repliedAt ? new Date(item.repliedAt).toLocaleString() : ''}
                          )
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <span className="status-chip status-success">
                      {Number(item.rating ?? 0).toFixed(1)} ★
                    </span>
                  </div>
                  <div className="muted">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                  </div>
                  <div className="owner-reply-cell">
                    <textarea
                      rows={3}
                      placeholder="Type a short response…"
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
    </OwnerLayout>
  );
}

export default OwnerDashboard;

