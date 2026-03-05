import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoSearchOutline,
  IoFilterOutline,
  IoReloadOutline,
  IoChatbubbleEllipsesOutline,
} from 'react-icons/io5';
import LguLayout from '../../components/LguLayout';
import '../../styles/AdminDashboard.css';
import { fetchLguEstablishments } from '../../services/lguApi';
import {
  fetchLguFeedback,
  lguReplyToFeedback,
  fetchFeedbackDetails,
  fetchLatestFeedbackSummary,
  generateFeedbackSummary,
  fetchFeedbackStats,
  lguModerateFeedback,
} from '../../services/feedbackApi';
import { useActionStatus } from '../../context/ActionStatusContext';

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

function LguFeedback() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const [establishments, setEstablishments] = useState([]);
  const [selectedEst, setSelectedEst] = useState('');
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');

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
    stats: null,
    parsedSummary: null,
  });

  // const [replyDrafts, setReplyDrafts] = useState({});
  // const [replySubmitting, setReplySubmitting] = useState('');

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


  useEffect(() => {
    const loadEstablishments = async () => {
      try {
        setLoadingEstablishments(true);
        const { data } = await fetchLguEstablishments({ limit: 50 });
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
          ? data
          : [];
        setEstablishments(items);
        if (!items.length) {
          setError('No establishments are assigned to your municipality yet.');
        } else {
          setSelectedEst(items[0].businessEstablishment_id ?? items[0].business_establishment_id ?? '');
          setError('');
        }
      } catch (err) {
        console.error('Failed to load LGU establishments', err);
        setError('Unable to load establishments right now.');
      } finally {
        setLoadingEstablishments(false);
      }
    };
    loadEstablishments();
  }, []);

  const loadFeedback = useCallback(async () => {
    if (!selectedEst) return;
    setFeedbackState(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await fetchLguFeedback(selectedEst, { page, sort, pageSize: 10 });
      const list = Array.isArray(data?.items) ? data.items : [];
      const enriched = await Promise.all(
        list.map(async item => {
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
        items: enriched,
        summary: data?.summary ?? null,
        distribution: data?.distribution ?? {},
        total: data?.total ?? enriched.length,
        pages: data?.pages ?? 1,
      });
    } catch (err) {
      console.error('Failed to load municipal feedback', err);
      setFeedbackState(prev => ({ ...prev, loading: false }));
      setError('Unable to retrieve feedback for this establishment.');
    }
  }, [selectedEst, page, sort]);

  const loadSummary = useCallback(async () => {
    if (!selectedEst) return;
    try {
      setSummaryState(prev => ({ ...prev, loading: true }));
      const [latestRes, statsRes] = await Promise.all([
        fetchLatestFeedbackSummary(selectedEst).catch(() => null),
        fetchFeedbackStats(selectedEst).catch(() => null),
      ]);
      setSummaryState({
        loading: false,
        latest: latestRes?.data ?? null,
        stats: statsRes?.data ?? null,
        parsedSummary: parseAiSummary(latestRes?.data?.ai_summary),
      });
    } catch (err) {
      console.error('Failed to load feedback summary', err);
      setSummaryState(prev => ({ ...prev, loading: false }));
    }
  }, [selectedEst]);

  useEffect(() => {
    if (selectedEst) {
      loadFeedback();
      loadSummary();
    }
  }, [selectedEst, loadFeedback, loadSummary]);

  const openReplyModal = (item) =>
    setReplyModal({ open: true, target: item, text: '', loading: false, error: '' });

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyModal.target) return;
    setReplyModal((p) => ({ ...p, loading: true, error: '' }));
    try {
      await lguReplyToFeedback(replyModal.target.feedback_id, { response_text: replyModal.text });
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
      await lguModerateFeedback(moderateModal.target.feedback_id, {
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
      console.error('Failed to generate summary', err);
      showError('Unable to generate summary. Please try again later.');
      setSummaryState(prev => ({ ...prev, loading: false }));
    }
  };

  // const handleReplySubmit = async feedbackId => {
  //   const message = replyDrafts[feedbackId]?.trim();
  //   if (!message) return;
  //   try {
  //     setReplySubmitting(feedbackId);
  //     await lguReplyToFeedback(feedbackId, { response_text: message });
  //     setReplyDrafts(prev => ({ ...prev, [feedbackId]: '' }));
  //     await loadFeedback();
  //   } catch (err) {
  //     console.error('Failed to send LGU reply', err);
  //     alert('Unable to send reply. Please try again.');
  //   } finally {
  //     setReplySubmitting('');
  //   }
  // };

  const summaryCards = useMemo(() => {
    if (!feedbackState.summary) return [];
    return [
      {
        label: 'Average rating',
        value:
          feedbackState.summary.average_rating != null
            ? Number(feedbackState.summary.average_rating).toFixed(2)
            : '—',
        helper: `${feedbackState.summary.total_reviews ?? 0} reviews`,
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
  }, [feedbackState.summary]);

  const ratingDistribution = useMemo(() => {
    const base = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return { ...base, ...(feedbackState.distribution ?? {}) };
  }, [feedbackState.distribution]);

  const filteredItems = useMemo(() => {
    return feedbackState.items.filter(item =>
      search ? (item.review_text ?? '').toLowerCase().includes(search.toLowerCase()) : true
    );
  }, [feedbackState.items, search]);

  return (
    <LguLayout title="Municipal Feedback">
      <section className="lgu-feedback-page">
        <header className="lgu-feedback-hero">
          <div>
            <p className="eyebrow">Reviews</p>
            <h1>Municipal feedback</h1>
            <p className="muted">
              Track tourist sentiment across your establishments, respond formally, and surface issues.
            </p>
          </div>
          <div className="owner-hero-filters">
            <label>
              Establishment
              <select
                value={selectedEst}
                onChange={event => {
                  setSelectedEst(event.target.value);
                  setPage(1);
                }}
                disabled={loadingEstablishments}
              >
                {establishments.map(est => {
                  const id = est.businessEstablishment_id ?? est.business_establishment_id;
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
                value={sort}
                onChange={event => {
                  setSort(event.target.value);
                  setPage(1);
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

        {error ? (
          <p className="error-text">{error}</p>
        ) : (
          <>
            <section className="lgu-summary-grid">
                {summaryCards.map(card => (
                  <article key={card.label} className="lgu-summary-card">
                    <p className="summary-label">{card.label}</p>
                    <p className="summary-value">{card.value}</p>
                    <p className="summary-helper">{card.helper}</p>
                  </article>
                ))}

                <article className="lgu-summary-card wide">
                  <div className="owner-summary-header">
                    <p className="summary-label">Rating breakdown</p>
                    <button type="button" onClick={() => loadFeedback()}>
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
                  <p className="summary-label">Latest summary</p>
                      {summaryState.parsedSummary ? (
                        <>
                          <p className="summary-helper">
                            {new Date(summaryState.latest.time_range_start).toLocaleDateString()} –{' '}
                            {new Date(summaryState.latest.time_range_end).toLocaleDateString()}
                          </p>
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

                          {summaryState.parsedSummary.structured ? (
                            <pre className="lgu-summary-json">
                              {JSON.stringify(summaryState.parsedSummary.structured, null, 2)}
                            </pre>
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

            <section className="lgu-reviews-panel">
              <div className="lgu-reviews-header">
                <div>
                  <h2>Reviews</h2>
                  <p className="muted">
                    Showing {filteredItems.length} of {feedbackState.total} entries
                  </p>
                </div>
                <div className="lgu-reviews-controls">
                  <div className="filter-input">
                    <IoSearchOutline />
                    <input
                      placeholder="Search comment…"
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />
                  </div>
                  <button type="button" className="ghost-btn">
                    <IoFilterOutline /> Filter
                  </button>
                </div>
              </div>

              <div className="lgu-reviews-table">
                <div className="lgu-table-head">
                  <span>Review</span>
                  <span>Rating</span>
                  <span>Date</span>
                  <span>Replies</span>
                  <span>Action</span>
                </div>

                {feedbackState.loading && !feedbackState.items.length ? (
                  <div className="empty-card">Loading feedback…</div>
                ) : filteredItems.length ? (
                  filteredItems.map(item => (
                    <article key={item.feedback_id} className="lgu-table-row">
                      <div className="lgu-review-info">
                        <p className="review-text">
                          {item.review_text?.length ? item.review_text : 'No written review provided.'}
                        </p>
                        <p className="review-meta">
                          by {item.tourist_name ?? 'Verified traveler'} • Profile ID:{' '}
                          {item.tourist_profile_id ?? '—'}
                        </p>
                      </div>

                      <div className="lgu-review-rating">
                        <span className="status-chip status-success">
                          {Number(item.rating).toFixed(1)} ★
                        </span>
                        <p>{ratingLabels[item.rating] ?? ''}</p>
                      </div>

                      <div className="lgu-review-date">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </div>

                      <div className="lgu-review-replies">
                        {item.replies?.length ? (
                          <p>{item.replies.length} replies</p>
                        ) : (
                          <p className="muted">Awaiting response</p>
                        )}
                      </div>

                      <div className="lgu-review-actions">
                        <div className="action-buttons">
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
                      </div>

                    </article>
                  ))
                ) : (
                  <div className="empty-card">No feedback matches the current filters.</div>
                )}
              </div>

              <div className="feedback-pagination">
                <button
                  type="button"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {feedbackState.pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(prev => Math.min(feedbackState.pages, prev + 1))}
                  disabled={page >= feedbackState.pages}
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
                <p>Respond as LGU.</p>
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
                  <label className="form-label" htmlFor="lgu-reply-text">Message</label>
                  <textarea
                    id="lgu-reply-text"
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
                <label className="form-label" htmlFor="lgu-mod-reason">Reason (optional)</label>
                <textarea
                  id="lgu-mod-reason"
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
        <div className="modal-content"><div className="muted">Loading thread…</div></div>
      ) : threadModal.error ? (
        <div className="modal-content"><div className="modal-error">{threadModal.error}</div></div>
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

    </LguLayout>
  );
}

export default LguFeedback;

