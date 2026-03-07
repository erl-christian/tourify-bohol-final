import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoSearchOutline, IoFilterOutline, IoReloadOutline } from 'react-icons/io5';
import AdminLayout from '../../components/AdminLayout';
import '../../styles/AdminDashboard.css';
import { fetchAllEstablishments } from '../../services/btoApi';
import {
  fetchBtoFeedback,
  fetchFeedbackDetails,
  fetchLatestFeedbackSummary,
  generateFeedbackSummary,
  btoModerateFeedback,
  btoReplyToFeedback,
} from '../../services/feedbackApi';
import { useActionStatus } from '../../context/ActionStatusContext';
import { filterFeedbackItems } from '../../utils/feedbackFilters.js';

const stripMarkdown = text => text?.replace(/\*\*(.*?)\*\*/g, '$1').trim();

const parseAiSummary = text => {
  if (!text) return null;

  const summaryMatch = text.match(/Summary:\s*([\s\S]*?)(?:\n\s*Actions:|$)/i);
  const actionsMatch = text.match(/Actions:\s*([\s\S]*?)(?:\n\s*JSON:|$)/i);
  const jsonMatch = text.match(/JSON:\s*([\s\S]*)$/i);

  const summary = stripMarkdown(summaryMatch?.[1] ?? text);

  const actions = actionsMatch
    ? actionsMatch[1]
        .split('\n')
        .map(line => line.replace(/^-/, '').trim())
        .filter(Boolean)
        .map(line => {
          const clean = stripMarkdown(line);
          const tokens = clean.split(/\s+/);
          const actor = tokens.shift() ?? '';
          return { actor, text: tokens.join(' ') };
        })
    : [];

  let structured = null;
  if (jsonMatch?.[1]) {
    try {
      structured = JSON.parse(jsonMatch[1]);
    } catch {
      structured = null;
    }
  }

  return { summary, actions, structured };
};

const sortOptions = [
  { value: 'newest', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating_desc', label: 'Highest rating' },
  { value: 'rating_asc', label: 'Lowest rating' },
];

const ratingLabels = {
  1: '1 star',
  2: '2 stars',
  3: '3 stars',
  4: '4 stars',
  5: '5 stars',
};

const getEstablishmentId = est =>
  est?.businessEstablishment_id ??
  est?.business_establishment_id ??
  est?.business_establishmentId ??
  est?.id ??
  '';

function BtoFeedback() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const [establishments, setEstablishments] = useState([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [estError, setEstError] = useState('');
  const [selectedEst, setSelectedEst] = useState('');

  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackSort, setFeedbackSort] = useState('newest');
  const [feedbackSearch, setFeedbackSearch] = useState('');

  const [ratingFilter, setRatingFilter] = useState('all');
  const [replyFilter, setReplyFilter] = useState('all');
  const [commentFilter, setCommentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [feedbackState, setFeedbackState] = useState({
    loading: false,
    items: [],
    summary: null,
    distribution: {},
    total: 0,
    pages: 1,
  });

  const [summaryState, setSummaryState] = useState({
    loading: false,
    latest: null,
    parsedSummary: null,
  });

  const [replyModal, setReplyModal] = useState({
    open: false,
    target: null,
    text: '',
    loading: false,
    error: '',
  });

  const [moderateModal, setModerateModal] = useState({
    open: false,
    target: null,
    action: 'hide',
    reason: '',
    loading: false,
    error: '',
  });

  const [threadModal, setThreadModal] = useState({
    open: false,
    loading: false,
    error: '',
    thread: null,
  });

  const loadEstablishments = useCallback(async () => {
    try {
      setLoadingEstablishments(true);
      const { data } = await fetchAllEstablishments({ limit: 200 });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setEstablishments(items);
      if (!items.length) {
        setEstError('No establishments registered yet.');
      } else {
        const first = getEstablishmentId(items[0]);
        if (first) setSelectedEst(first);
        setEstError('');
      }
    } catch (err) {
      console.error('[BTO Feedback] load establishments failed', err);
      setEstError('Unable to load establishments right now.');
    } finally {
      setLoadingEstablishments(false);
    }
  }, []);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  useEffect(() => {
    if (!selectedEst && establishments.length) {
      const first = getEstablishmentId(establishments[0]);
      if (first) setSelectedEst(first);
    }
  }, [establishments, selectedEst]);

  const loadFeedback = useCallback(async () => {
    if (!selectedEst) return;
    setFeedbackState(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await fetchBtoFeedback(selectedEst, {
        page: feedbackPage,
        sort: feedbackSort,
        pageSize: 10,
      });
      const baseItems = Array.isArray(data?.items) ? data.items : [];
      const itemsWithReplies = await Promise.all(
        baseItems.map(async item => {
          try {
            const detail = await fetchFeedbackDetails(item.feedback_id);
            return { ...item, replies: detail.data?.replies ?? [] };
          } catch {
            return { ...item, replies: [] };
          }
        })
      );
      setFeedbackState({
        loading: false,
        items: itemsWithReplies,
        summary: data?.summary ?? null,
        distribution: data?.distribution ?? {},
        total: data?.total ?? itemsWithReplies.length,
        pages: data?.pages ?? 1,
      });
    } catch (err) {
      console.error('[BTO Feedback] load feedback failed', err);
      setFeedbackState(prev => ({ ...prev, loading: false }));
    }
  }, [selectedEst, feedbackPage, feedbackSort]);

  const loadSummary = useCallback(async () => {
    if (!selectedEst) return;
    try {
      setSummaryState(prev => ({ ...prev, loading: true }));
      const latest = await fetchLatestFeedbackSummary(selectedEst).catch(() => null);
      setSummaryState({
        loading: false,
        latest: latest?.data ?? null,
        parsedSummary: parseAiSummary(latest?.data?.ai_summary),
      });
    } catch (err) {
      console.error('[BTO Feedback] load summary failed', err);
      setSummaryState(prev => ({ ...prev, loading: false }));
    }
  }, [selectedEst]);

  useEffect(() => {
    if (selectedEst) {
      loadFeedback();
      loadSummary();
    }
  }, [selectedEst, loadFeedback, loadSummary]);

  const handleGenerateSummary = async () => {
    if (!selectedEst) return;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    try {
      setSummaryState(prev => ({ ...prev, loading: true }));
      showLoading('Generating AI summary...');
      await generateFeedbackSummary(selectedEst, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      await loadSummary();
      showSuccess('AI summary generated successfully.');
    } catch (err) {
      console.error('[BTO Feedback] summary generation failed', err);
      showError('Unable to generate summary. Please try again later.');
      setSummaryState(prev => ({ ...prev, loading: false }));
    }
  };

  const feedbackSummaryCards = useMemo(() => {
    if (!feedbackState.summary) return [];
    return [
      {
        label: 'Average rating',
        value:
          feedbackState.summary.average_rating != null
            ? Number(feedbackState.summary.average_rating).toFixed(2)
            : '—',
        helper: `${feedbackState.summary.total_reviews ?? feedbackState.total ?? 0} reviews`,
      },
      {
        label: 'Written reviews',
        value: feedbackState.summary.with_text ?? 0,
        helper: 'With comments',
      },
      {
        label: 'No-comment ratings',
        value: feedbackState.summary.no_text ?? 0,
        helper: 'Quick ratings',
      },
    ];
  }, [feedbackState.summary, feedbackState.total]);

  const ratingDistribution = useMemo(
    () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...(feedbackState.distribution ?? {}) }),
    [feedbackState.distribution]
  );

  const filteredItems = useMemo(
    () =>
      filterFeedbackItems(feedbackState.items, {
        query: feedbackSearch,
        rating: ratingFilter,
        reply: replyFilter,
        text: commentFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
      }),
    [
      feedbackState.items,
      feedbackSearch,
      ratingFilter,
      replyFilter,
      commentFilter,
      statusFilter,
      dateFrom,
      dateTo,
    ],
  );

  const clearFilters = () => {
    setFeedbackSearch('');
    setRatingFilter('all');
    setReplyFilter('all');
    setCommentFilter('all');
    setStatusFilter('active');
    setDateFrom('');
    setDateTo('');
    setFeedbackPage(1);
  };


  const openReplyModal = (item) =>
    setReplyModal({ open: true, target: item, text: '', loading: false, error: '' });

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyModal.target) return;
    setReplyModal((p) => ({ ...p, loading: true, error: '' }));
    try {
      await btoReplyToFeedback(replyModal.target.feedback_id, { response_text: replyModal.text });
      await loadFeedback();
      setReplyModal({ open: false, target: null, text: '', loading: false, error: '' });
    } catch (err) {
      setReplyModal((p) => ({
        ...p,
        loading: false,
        error: err.response?.data?.message || 'Unable to post reply.',
      }));
    }
  };

  const openModerateModal = (item, action) =>
    setModerateModal({ open: true, target: item, action, reason: '', loading: false, error: '' });

  const submitModeration = async (e) => {
    e.preventDefault();
    if (!moderateModal.target) return;
    setModerateModal((p) => ({ ...p, loading: true, error: '' }));
    try {
      await btoModerateFeedback(moderateModal.target.feedback_id, {
        action: moderateModal.action,
        reason: moderateModal.reason,
      });
      await loadFeedback();
      setModerateModal({ open: false, target: null, action: 'hide', reason: '', loading: false, error: '' });
    } catch (err) {
      setModerateModal((p) => ({
        ...p,
        loading: false,
        error: err.response?.data?.message || 'Unable to update feedback.',
      }));
    }
  };

  const openThreadModal = async (feedbackId) => {
  setThreadModal({ open: true, loading: true, error: '', thread: null });
  try {
    const { data } = await fetchFeedbackDetails(feedbackId);
    setThreadModal({ open: true, loading: false, error: '', thread: data });
  } catch (err) {
    setThreadModal({
      open: true,
      loading: false,
      error: err.response?.data?.message || 'Unable to load thread.',
      thread: null,
    });
  }
};

const closeThreadModal = () =>
  setThreadModal({ open: false, loading: false, error: '', thread: null });


  return (
    <AdminLayout
      title="Feedback Oversight"
      subtitle="Inspect province-wide reviews and ensure LGUs stay responsive."
    >
      <section className="lgu-feedback-page feedback-studio">
        <header className="lgu-feedback-hero">
          <div>
            <p className="eyebrow">Moderation</p>
            <h1>Feedback library</h1>
            <p className="muted">
              Browse any establishment’s review history, read LGU/owner responses, and coordinate
              follow-ups. BTO remains read-only for formal replies.
            </p>
          </div>
          <div className="owner-hero-filters">
            <label>
              Establishment
              <select
                value={selectedEst}
                onChange={event => {
                  setSelectedEst(event.target.value);
                  setFeedbackPage(1);
                }}
                disabled={loadingEstablishments || !establishments.length}
              >
                {establishments.map(est => {
                  const id = getEstablishmentId(est);
                  return (
                    <option key={id} value={id}>
                      {est.name ?? est.establishment_name ?? id}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Sort
              <select
                value={feedbackSort}
                onChange={event => {
                  setFeedbackSort(event.target.value);
                  setFeedbackPage(1);
                }}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {estError ? (
          <p className="error-text">{estError}</p>
        ) : (
          <>
            <section className="lgu-summary-grid">
              {feedbackSummaryCards.map(card => (
                <article key={card.label} className="lgu-summary-card">
                  <p className="summary-label">{card.label}</p>
                  <p className="summary-value">{card.value}</p>
                  <p className="summary-helper">{card.helper}</p>
                </article>
              ))}

              <article className="lgu-summary-card wide">
                <div className="owner-summary-header">
                  <p className="summary-label">Rating breakdown</p>
                  <button type="button" onClick={loadFeedback} disabled={feedbackState.loading}>
                    <IoReloadOutline /> Refresh
                  </button>
                </div>
                <div className="distribution-list">
                  {[5, 4, 3, 2, 1].map(star => (
                    <div key={star} className="distribution-row">
                      <span>{star}★</span>
                      <div className="distribution-bar">
                        <div
                          style={{
                            width: feedbackState.total
                              ? `${(ratingDistribution[star] / feedbackState.total) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span>{ratingDistribution[star]}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="lgu-summary-card wide">
                <p className="summary-label">Latest AI summary</p>
                {summaryState.parsedSummary ? (
                  <>
                    {summaryState.latest ? (
                      <p className="summary-helper">
                        {new Date(summaryState.latest.time_range_start).toLocaleDateString()} –{' '}
                        {new Date(summaryState.latest.time_range_end).toLocaleDateString()}
                      </p>
                    ) : null}
                    <p className="lgu-summary-text">{summaryState.parsedSummary.summary}</p>
                    {summaryState.parsedSummary.actions.length ? (
                      <ul className="lgu-summary-actions">
                        {summaryState.parsedSummary.actions.map(action => (
                          <li key={`${action.actor}-${action.text}`}>
                            <strong>{action.actor}</strong> {action.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="summary-helper">No generated summary yet.</p>
                )}
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleGenerateSummary}
                  disabled={summaryState.loading}
                >
                  {summaryState.loading ? 'Generating…' : 'Generate last 30 days'}
                </button>
              </article>
            </section>

            <section className="feedbackx-shell">
              <div className="feedbackx-top">
                <div className="feedbackx-title">
                  <h2>Reviews</h2>
                  <p className="feedbackx-count">
                    Showing {filteredItems.length} of {feedbackState.total} entries
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={loadFeedback} disabled={feedbackState.loading}>
                  <IoReloadOutline /> Refresh
                </button>
              </div>

              <div className="feedbackx-filters">
                <div className="feedbackx-field feedbackx-field--search">
                  <IoSearchOutline />
                  <input
                    placeholder="Search comment, tourist, or profile ID"
                    value={feedbackSearch}
                    onChange={e => setFeedbackSearch(e.target.value)}
                  />
                </div>

                <div className="feedbackx-field">
                  <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
                    <option value="all">All ratings</option>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                </div>

                <div className="feedbackx-field">
                  <select value={replyFilter} onChange={e => setReplyFilter(e.target.value)}>
                    <option value="all">All reply states</option>
                    <option value="awaiting">Awaiting reply</option>
                    <option value="replied">With replies</option>
                  </select>
                </div>

                <div className="feedbackx-field">
                  <select value={commentFilter} onChange={e => setCommentFilter(e.target.value)}>
                    <option value="all">All comment types</option>
                    <option value="with_text">With comment</option>
                    <option value="rating_only">Rating only</option>
                  </select>
                </div>

                <div className="feedbackx-field">
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="all">All statuses</option>
                    <option value="flagged">Flagged</option>
                    <option value="hidden">Hidden</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>

                <div className="feedbackx-field feedbackx-field--date">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>

                <div className="feedbackx-field feedbackx-field--date">
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>

                <button type="button" className="feedbackx-clear" onClick={clearFilters}>
                  <IoFilterOutline /> Clear
                </button>
              </div>

              {feedbackState.loading && !feedbackState.items.length ? (
                <div className="feedbackx-empty">Loading feedback...</div>
              ) : filteredItems.length ? (
                <div className="feedbackx-table">
                  <div className="feedbackx-table-head">
                    <span>Review</span>
                    <span>Rating</span>
                    <span>Verified Traveler</span>
                    <span>Actions</span>
                  </div>
                  <div className="feedbackx-grid">
                    {filteredItems.map(item => (
                      <article key={item.feedback_id} className="feedbackx-row">
                        <div className="feedbackx-cell feedbackx-cell--review">
                          <p className="feedbackx-text">
                            {item.review_text?.length ? item.review_text : 'No written review provided.'}
                          </p>
                          <div className="feedbackx-tags">
                            <span className="feedbackx-tag feedbackx-tag--neutral">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                            </span>
                            <span className="feedbackx-tag feedbackx-tag--neutral">
                              Replies: {item.replies?.length ?? 0}
                            </span>
                            {item.is_hidden ? <span className="feedbackx-tag feedbackx-tag--warn">Hidden</span> : null}
                            {item.is_flagged ? <span className="feedbackx-tag feedbackx-tag--danger">Flagged</span> : null}
                            {item.deleted_at ? <span className="feedbackx-tag feedbackx-tag--danger">Deleted</span> : null}
                          </div>
                        </div>

                        <div className="feedbackx-cell feedbackx-cell--rating">
                          <span className="feedbackx-rating">{Number(item.rating ?? 0).toFixed(1)} *</span>
                          <small>{ratingLabels[item.rating] ?? ''}</small>
                        </div>

                        <div className="feedbackx-cell feedbackx-cell--traveler">
                          <p className="feedbackx-traveler-name">{item.tourist_name ?? 'Verified traveler'}</p>
                          <p className="feedbackx-traveler-meta">Profile ID: {item.tourist_profile_id ?? '-'}</p>
                        </div>

                        <div className="feedbackx-actions">
                          <button type="button" className="btn-primary" onClick={() => openReplyModal(item)}>
                            Reply
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => openModerateModal(item, item.is_hidden ? 'unhide' : 'hide')}
                          >
                            {item.is_hidden ? 'Unhide' : 'Hide'}
                          </button>
                          <button type="button" className="btn-danger" onClick={() => openModerateModal(item, 'delete')}>
                            Delete
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => openThreadModal(item.feedback_id)}>
                            View thread
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="feedbackx-empty">No feedback matches the current filters.</div>
              )}

              <div className="feedbackx-pagination">
                <button
                  type="button"
                  onClick={() => setFeedbackPage(prev => Math.max(1, prev - 1))}
                  disabled={feedbackPage === 1}
                >
                  Previous
                </button>
                <span>
                  Page {feedbackPage} of {feedbackState.pages}
                </span>
                <button
                  type="button"
                  onClick={() => setFeedbackPage(prev => Math.min(feedbackState.pages, prev + 1))}
                  disabled={feedbackPage >= feedbackState.pages}
                >
                  Next
                </button>
              </div>
            </section>
          </>
        )}
      </section>
            {replyModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Reply to feedback</h3>
                <p>Respond as BTO moderator.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setReplyModal({ open: false, target: null, text: '', loading: false, error: '' })}
                disabled={replyModal.loading}
              >
                ×
              </button>
            </header>
            {replyModal.error && <div className="modal-error">{replyModal.error}</div>}
            <div className="modal-content">
              <form className="modal-form" onSubmit={submitReply}>
                <div className="form-row">
                  <label className="form-label" htmlFor="reply-text">Message</label>
                  <textarea
                    id="reply-text"
                    rows={4}
                    required
                    value={replyModal.text}
                    onChange={(e) => setReplyModal((p) => ({ ...p, text: e.target.value }))}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="ghost-cta" onClick={() => setReplyModal({ open: false, target: null, text: '', loading: false, error: '' })} disabled={replyModal.loading}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-cta" disabled={replyModal.loading}>
                    {replyModal.loading ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
            {moderateModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Moderate feedback</h3>
                <p>Action: {moderateModal.action}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setModerateModal({ open: false, target: null, action: 'hide', reason: '', loading: false, error: '' })}
                disabled={moderateModal.loading}
              >
                ×
              </button>
            </header>
            {moderateModal.error && <div className="modal-error">{moderateModal.error}</div>}
            <div className="modal-content">
              <form className="modal-form" onSubmit={submitModeration}>
                <div className="form-row">
                  <label className="form-label" htmlFor="mod-reason">Reason (optional)</label>
                  <textarea
                    id="mod-reason"
                    rows={3}
                    value={moderateModal.reason}
                    onChange={(e) => setModerateModal((p) => ({ ...p, reason: e.target.value }))}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={() => setModerateModal({ open: false, target: null, action: 'hide', reason: '', loading: false, error: '' })}
                    disabled={moderateModal.loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={
                      moderateModal.action === 'delete'
                        ? 'danger-cta'
                        : moderateModal.action === 'flag'
                        ? 'review-cta'
                        : 'primary-cta'
                    }
                    disabled={moderateModal.loading}
                  >
                    {moderateModal.loading ? 'Applying…' : `Confirm ${moderateModal.action}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {threadModal.open && (
  <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-card">
      <header className="modal-header">
        <div>
          <h3>Feedback thread</h3>
          <p>Full conversation history.</p>
        </div>
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={closeThreadModal}
          disabled={threadModal.loading}
        >
          ×
        </button>
      </header>

      {threadModal.loading ? (
          <div className="modal-content">
            <div className="muted">Loading thread…</div>
          </div>
        ) : threadModal.error ? (
          <div className="modal-content">
            <div className="modal-error">{threadModal.error}</div>
          </div>
        ) : (
          <div className="modal-content">
            <div className="detail-block">
              <p className="detail-label">Original review</p>
              <p className="detail-value">{threadModal.thread?.review_text || 'No comment provided.'}</p>
            </div>

            <div className="detail-block">
              <p className="detail-label">Replies</p>
              {threadModal.thread?.replies?.length ? (
                threadModal.thread.replies.map((reply) => (
                  <article key={reply._id ?? reply.feedback_response_id ?? reply.response_id} className="detail-reply">
                    <header>
                      <strong>
                        {reply.bto_account_id
                          ? 'BTO response'
                          : reply.tourist_profile_id
                          ? 'Tourist response'
                          : reply.business_establishment_profile_id
                          ? 'Owner response'
                          : reply.admin_staff_profile_id
                          ? 'LGU response'
                          : 'Response'}
                      </strong>
                      <span>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                    </header>
                    <p>{reply.response_text}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No replies recorded yet.</p>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="primary-cta" onClick={closeThreadModal}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}

    </AdminLayout>
  );
}

export default BtoFeedback;


