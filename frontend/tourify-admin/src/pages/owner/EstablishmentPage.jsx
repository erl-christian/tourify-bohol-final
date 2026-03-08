import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import OwnerLayout from '../../components/OwnerLayout';
import '../../styles/AdminDashboard.css';
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
} from '../../services/ownerAnalyticsApi';
import {
  fetchOwnerFeedback,
  ownerReplyToFeedback,
  fetchFeedbackDetails,
} from '../../services/feedbackApi';

const pieColors = ['#2f80ed', '#56ccf2', '#f2c94c', '#f2994a', '#eb5757'];

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

const resolveQrLink = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || '';
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
};

function OwnerEstablishmentPage() {
  const { estId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [establishment, setEstablishment] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [analytics, setAnalytics] = useState({
    ratingTrend: [],
    reviewCounts: [],
    checkins: [],
    categories: [],
  });

  const [feedbackSort, setFeedbackSort] = useState('newest');
  const [feedbackQuery, setFeedbackQuery] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('all');
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackState, setFeedbackState] = useState({
    loading: false,
    items: [],
    total: 0,
    pages: 1,
  });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySubmitting, setReplySubmitting] = useState('');

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [estRes, trendRes, reviewRes, checkinsRes, categoriesRes] = await Promise.all([
        fetchOwnerEstablishments({ limit: 200 }),
        fetchOwnerRatingTrend(estId),
        fetchOwnerReviewCounts(estId),
        fetchOwnerCheckins(estId),
        fetchOwnerFeedbackCategories(estId),
      ]);

      const list = Array.isArray(estRes?.data?.items) ? estRes.data.items : [];
      const selected = list.find((item) => {
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

      setAnalytics({
        ratingTrend: trendRes?.data?.trend || [],
        reviewCounts: reviewRes?.data?.monthly || [],
        checkins: checkinsRes?.data?.monthly || [],
        categories: categoriesRes?.data?.categories || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load establishment page.');
    } finally {
      setLoading(false);
    }
  }, [estId]);

  const loadFeedback = useCallback(async () => {
    if (!estId) return;
    setFeedbackState((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await fetchOwnerFeedback(estId, {
        page: feedbackPage,
        pageSize: 10,
        sort: feedbackSort,
        query: feedbackQuery || undefined,
        rating: feedbackRating === 'all' ? undefined : feedbackRating,
      });

      const list = Array.isArray(data?.items) ? data.items : [];
      const withReplies = await Promise.all(
        list.map(async (item) => {
          try {
            const detail = await fetchFeedbackDetails(item.feedback_id);
            return { ...item, replies: detail.data?.replies ?? [] };
          } catch {
            return { ...item, replies: [] };
          }
        }),
      );

      setFeedbackState({
        loading: false,
        items: withReplies,
        total: Number(data?.total ?? withReplies.length),
        pages: Number(data?.pages ?? 1),
      });
    } catch (err) {
      setFeedbackState({ loading: false, items: [], total: 0, pages: 1 });
      setError(err.response?.data?.message || 'Unable to load feedback for this establishment.');
    }
  }, [estId, feedbackPage, feedbackSort, feedbackQuery, feedbackRating]);

  useEffect(() => {
    if (!estId) return;
    loadBase();
  }, [estId, loadBase]);

  useEffect(() => {
    if (!estId) return;
    loadFeedback();
  }, [estId, loadFeedback]);

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

  const handleSave = async (event) => {
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
      setMessage('Establishment details updated successfully.');
      await loadBase();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update establishment details.');
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async (feedbackId) => {
    const text = replyDrafts[feedbackId]?.trim();
    if (!text) return;
    setReplySubmitting(feedbackId);
    try {
      await ownerReplyToFeedback(feedbackId, { response_text: text });
      setReplyDrafts((prev) => ({ ...prev, [feedbackId]: '' }));
      await loadFeedback();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send reply.');
    } finally {
      setReplySubmitting('');
    }
  };

  const handleRefreshQr = async () => {
    try {
      await regenerateQr(estId);
      setMessage('QR code refreshed.');
      await loadBase();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to refresh QR code.');
    }
  };

  return (
    <OwnerLayout
      title={establishment?.name || 'Establishment Page'}
      subtitle="Analytics and feedback are scoped to this specific establishment."
    >
      {loading ? <p className="muted">Loading establishment page...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      {!loading && !error && establishment ? (
        <>
          <section className="account-management">
            <div className="section-heading">
              <h2>Snapshot</h2>
              <p>This page only shows data for this establishment.</p>
            </div>
            <div className="detail-grid">
              <div className="detail-pair">
                <p className="detail-label">Official Name</p>
                <p className="detail-value strong">{establishment.name || '-'}</p>
              </div>
              <div className="detail-pair">
                <p className="detail-label">Status</p>
                <p className="detail-value">{establishment.status || '-'}</p>
              </div>
              <div className="detail-pair">
                <p className="detail-label">Average Rating</p>
                <p className="detail-value">{stats.latestRating}</p>
              </div>
              <div className="detail-pair">
                <p className="detail-label">Total Reviews</p>
                <p className="detail-value">{stats.totalReviews}</p>
              </div>
              <div className="detail-pair">
                <p className="detail-label">Visitor Check-ins</p>
                <p className="detail-value">{stats.totalVisits}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost-cta" onClick={handleRefreshQr}>
                Refresh QR
              </button>
              {establishment.qr_code ? (
                <a className="primary-cta" href={resolveQrLink(establishment.qr_code)} target="_blank" rel="noreferrer">
                  Open QR
                </a>
              ) : null}
            </div>
          </section>

          <section className="account-management">
            <div className="section-heading">
              <h2>Analytics (This Establishment)</h2>
              <p>Ratings, reviews, visits, and rating breakdown.</p>
            </div>
            <div className="analytics-lower-grid owner-analytics-grid">
              <article className="analytics-card span-2">
                <header><h3>Rating Trend</h3></header>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={analytics.ratingTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rating" stroke="#f2994a" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </article>
              <article className="analytics-card span-2">
                <header><h3>Review Count</h3></header>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analytics.reviewCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="reviews" fill="#56ccf2" />
                  </BarChart>
                </ResponsiveContainer>
              </article>
              <article className="analytics-card span-4">
                <header><h3>Check-ins</h3></header>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.checkins}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="qr" stackId="a" fill="#2f80ed" name="QR" />
                    <Bar dataKey="manual" stackId="a" fill="#f2c94c" name="Manual" />
                  </BarChart>
                </ResponsiveContainer>
              </article>
            </div>
            <div className="analytics-lower-grid owner-analytics-grid">
              <article className="analytics-card span-2">
                <header><h3>Rating Breakdown</h3></header>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={analytics.categories} dataKey="value" nameKey="name" outerRadius={90} label>
                      {analytics.categories.map((item, index) => (
                        <Cell key={`${item.name}-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </article>
            </div>
          </section>

          <section className="account-management">
            <div className="section-heading">
              <h2>Feedback (This Establishment)</h2>
              <p>Filter, review, and reply to this establishment's feedback only.</p>
            </div>
            <div className="est-filter-bar">
              <div className="est-filter-item est-filter-item--search">
                <span>Search</span>
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={feedbackQuery}
                  onChange={(e) => { setFeedbackQuery(e.target.value); setFeedbackPage(1); }}
                />
              </div>
              <div className="est-filter-item">
                <span>Rating</span>
                <select value={feedbackRating} onChange={(e) => { setFeedbackRating(e.target.value); setFeedbackPage(1); }}>
                  <option value="all">All ratings</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </div>
              <div className="est-filter-item">
                <span>Sort</span>
                <select value={feedbackSort} onChange={(e) => { setFeedbackSort(e.target.value); setFeedbackPage(1); }}>
                  <option value="newest">Most recent</option>
                  <option value="oldest">Oldest first</option>
                  <option value="rating_desc">Highest rating</option>
                  <option value="rating_asc">Lowest rating</option>
                </select>
              </div>
            </div>

            <div className="table-shell">
              <div className="table-head table-grid">
                <span>Traveler</span>
                <span>Review</span>
                <span>Rating</span>
                <span>Replies</span>
                <span>Actions</span>
              </div>
              <ul className="table-body">
                {feedbackState.loading ? (
                  <li className="table-row table-grid"><div className="muted">Loading feedback...</div></li>
                ) : feedbackState.items.length ? (
                  feedbackState.items.map((item) => (
                    <li key={item.feedback_id} className="table-row table-grid">
                      <div>{item.tourist_name || 'Verified traveler'}</div>
                      <div>{item.review_text || 'No written review provided.'}</div>
                      <div>{Number(item.rating || 0).toFixed(1)}</div>
                      <div>{item.replies?.length || 0}</div>
                      <div className="table-actions">
                        <textarea
                          value={replyDrafts[item.feedback_id] || ''}
                          placeholder="Reply..."
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [item.feedback_id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="primary-cta"
                          onClick={() => handleReply(item.feedback_id)}
                          disabled={!replyDrafts[item.feedback_id]?.trim() || replySubmitting === item.feedback_id}
                        >
                          {replySubmitting === item.feedback_id ? 'Sending...' : 'Send reply'}
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="table-row table-grid"><div className="muted">No feedback found.</div></li>
                )}
              </ul>
            </div>
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {feedbackState.items.length} of {feedbackState.total}
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => setFeedbackPage((p) => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1}
                >
                  Previous
                </button>
                <span className="pagination-page">Page {feedbackPage} of {feedbackState.pages}</span>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => setFeedbackPage((p) => Math.min(feedbackState.pages, p + 1))}
                  disabled={feedbackPage >= feedbackState.pages}
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <section className="account-management">
            <div className="section-heading">
              <h2>Account Management</h2>
              <p>Editable establishment fields.</p>
            </div>
            <form className="modal-form" onSubmit={handleSave}>
              <div className="form-row">
                <label className="form-label">Official name (locked)</label>
                <input type="text" value={establishment.name || ''} disabled />
              </div>
              <div className="form-row">
                <label className="form-label" htmlFor="est-page-type">Category</label>
                <input id="est-page-type" name="type" type="text" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label className="form-label" htmlFor="est-page-ownership">Ownership type</label>
                <select id="est-page-ownership" name="ownershipType" value={form.ownershipType} onChange={(e) => setForm((p) => ({ ...p, ownershipType: e.target.value }))}>
                  <option value="private">Private</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <div className="form-row">
                <label className="form-label" htmlFor="est-page-address">Address</label>
                <input id="est-page-address" name="address" type="text" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-row full">
                <label className="form-label" htmlFor="est-page-description">Description</label>
                <textarea id="est-page-description" name="description" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="primary-cta" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Establishment Details'}
                </button>
                <Link className="ghost-cta" to="/account/settings">
                  Open Account Settings
                </Link>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </OwnerLayout>
  );
}

export default OwnerEstablishmentPage;
