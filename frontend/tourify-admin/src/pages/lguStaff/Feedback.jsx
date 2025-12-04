import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoSearchOutline,
  IoFilterOutline,
  IoReloadOutline,
  IoChatbubbleEllipsesOutline,
} from 'react-icons/io5';
import LguStaffLayout from '../../components/LguStaffLayout';
import '../../styles/AdminDashboard.css';
import { fetchLguEstablishments } from '../../services/lguApi';
import {
  fetchLguFeedback,
  lguReplyToFeedback,
  fetchFeedbackDetails,
  fetchLatestFeedbackSummary,
  generateFeedbackSummary,
} from '../../services/feedbackApi';

const stripMarkdown = (text) => text?.replace(/\*\*(.*?)\*\*/g, '$1').trim();

const parseAiSummary = (text) => {
  if (!text) return null;
  const summaryMatch = text.match(/Summary:\s*([\s\S]*?)(?:\n\s*Actions:|$)/i);
  const actionsMatch = text.match(/Actions:\s*([\s\S]*?)(?:\n\s*JSON:|$)/i);
  const summary = stripMarkdown(summaryMatch?.[1] ?? text);
  const actions = actionsMatch
    ? actionsMatch[1]
        .split('\n')
        .map((line) => line.replace(/^-/, '').trim())
        .filter(Boolean)
        .map((line) => {
          const clean = stripMarkdown(line);
          const tokens = clean.split(/\s+/);
          const actor = tokens.shift() ?? '';
          return { actor, text: tokens.join(' ') };
        })
    : [];
  return { summary, actions };
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

function LguStaffFeedback() {
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
    parsedSummary: null,
  });

  const [replyModal, setReplyModal] = useState({
    open: false,
    target: null,
    text: '',
    loading: false,
    error: '',
  });

  const [threadModal, setThreadModal] = useState({
    open: false,
    loading: false,
    data: null,
    error: '',
  });

  const handleViewThread = async (feedbackId) => {
    setThreadModal({ open: true, loading: true, data: null, error: '' });
    try {
      const { data } = await fetchFeedbackDetails(feedbackId);
      setThreadModal({ open: true, loading: false, data, error: '' });
    } catch (err) {
      console.error('Failed to load thread', err);
      setThreadModal({
        open: true,
        loading: false,
        data: null,
        error: 'Unable to load thread right now.',
      });
    }
  };

  const closeThreadModal = () =>
    setThreadModal({ open: false, loading: false, data: null, error: '' });

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
          const first =
            items[0].businessEstablishment_id ?? items[0].business_establishment_id ?? '';
          setSelectedEst(first);
          setError('');
        }
      } catch (err) {
        console.error('[LGU Staff Feedback] load establishments failed', err);
        setError('Unable to load establishments right now.');
      } finally {
        setLoadingEstablishments(false);
      }
    };
    loadEstablishments();
  }, []);

  const loadFeedback = useCallback(async () => {
    if (!selectedEst) return;
    try {
      setFeedbackState((prev) => ({ ...prev, loading: true }));
      const { data } = await fetchLguFeedback(selectedEst, {
        page,
        sort,
        search,
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setFeedbackState({
        loading: false,
        items,
        summary: data?.summary ?? null,
        distribution: data?.distribution ?? {},
        total: data?.total ?? items.length,
        pages: data?.pages ?? 1,
      });
    } catch (err) {
      console.error('[LGU Staff Feedback] load feedback failed', err);
      setFeedbackState((prev) => ({ ...prev, loading: false }));
      setError('Unable to load feedback entries.');
    }
  }, [selectedEst, page, sort, search]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedEst) return;
      try {
        setSummaryState((prev) => ({ ...prev, loading: true }));
        const { data } = await fetchLatestFeedbackSummary(selectedEst);
        const parsedSummary = parseAiSummary(data?.ai_summary);
        setSummaryState({ loading: false, latest: data, parsedSummary });
      } catch (err) {
        console.warn('[LGU Staff Feedback] latest summary missing', err);
        setSummaryState((prev) => ({ ...prev, loading: false, latest: null, parsedSummary: null }));
      }
    };
    loadSummary();
  }, [selectedEst]);

  const ratingDistribution = useMemo(() => {
    const distribution = feedbackState.distribution ?? {};
    return [1, 2, 3, 4, 5].reduce(
      (acc, star) => ({ ...acc, [star]: distribution[star] ?? 0 }),
      {},
    );
  }, [feedbackState.distribution]);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Average rating',
        value: feedbackState.summary?.average_rating != null
          ? Number(feedbackState.summary.average_rating).toFixed(2)
          : '—',
        helper: `${feedbackState.summary?.total_reviews ?? feedbackState.total ?? 0} reviews`,
      },
      {
        label: 'Written reviews',
        value: feedbackState.summary?.with_text ?? 0,
        helper: 'With comments',
      },
      {
        label: 'No-comment ratings',
        value: feedbackState.summary?.no_text ?? 0,
        helper: 'Quick ratings',
      },
    ],
    [feedbackState.summary, feedbackState.total],
  );

  const filteredItems = useMemo(() => {
    if (!search) return feedbackState.items;
    const query = search.toLowerCase();
    return feedbackState.items.filter((item) =>
      (item.review_text ?? '').toLowerCase().includes(query),
    );
  }, [feedbackState.items, search]);

  const handleGenerateSummary = async () => {
    if (!selectedEst) return;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);

    try {
      setSummaryState((prev) => ({ ...prev, loading: true }));
      await generateFeedbackSummary(selectedEst, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const { data } = await fetchLatestFeedbackSummary(selectedEst);
      setSummaryState({
        loading: false,
        latest: data,
        parsedSummary: parseAiSummary(data?.ai_summary),
      });
    } catch (err) {
      console.error('Failed to generate summary', err);
      setSummaryState((prev) => ({ ...prev, loading: false }));
      alert('Unable to generate summary right now.');
    }
  };

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

  return (
    <LguStaffLayout
      title="Feedback & Comments"
      subtitle="Monitor and respond to tourist sentiment for establishments in your municipality."
    >
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
                onChange={(event) => {
                  setSelectedEst(event.target.value);
                  setPage(1);
                }}
                disabled={loadingEstablishments}
              >
                {establishments.map((est) => {
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
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                {sortOptions.map((option) => (
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
              {summaryCards.map((card) => (
                <article key={card.label} className="lgu-summary-card">
                  <p className="summary-label">{card.label}</p>
                  <p className="summary-value">{card.value}</p>
                  <p className="summary-helper">{card.helper}</p>
                </article>
              ))}

              <article className="lgu-summary-card wide">
                <div className="owner-summary-header">
                  <p className="summary-label">Rating breakdown</p>
                  <button type="button" onClick={loadFeedback}>
                    <IoReloadOutline /> Refresh
                  </button>
                </div>
                <div className="distribution-list">
                  {[5, 4, 3, 2, 1].map((star) => (
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
                <div className="owner-summary-header">
                  <p className="summary-label">Latest AI summary</p>
                  <button type="button" onClick={handleGenerateSummary} disabled={summaryState.loading}>
                    <IoChatbubbleEllipsesOutline /> Summarize
                  </button>
                </div>
                {summaryState.parsedSummary ? (
                  <>
                    <p className="summary-helper">
                      {new Date(summaryState.latest.time_range_start).toLocaleDateString()} —{' '}
                      {new Date(summaryState.latest.time_range_end).toLocaleDateString()}
                    </p>
                    <p className="lgu-summary-text">{summaryState.parsedSummary.summary}</p>
                    {summaryState.parsedSummary.actions.length ? (
                      <ul className="lgu-summary-actions">
                        {summaryState.parsedSummary.actions.map((action) => (
                          <li key={`${action.actor}-${action.text}`}>
                            <strong>{action.actor}</strong> {action.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">No summary yet. Generate one to brief the municipal tourism head.</p>
                )}
              </article>
            </section>

            <section className="lgu-reviews-panel">
              <header className="lgu-reviews-header">
                <div>
                  <h2>Visitor comments</h2>
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
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <button type="button" className="ghost-btn">
                    <IoFilterOutline /> Filter
                  </button>
                </div>
              </header>

              <div className="lgu-reviews-table">
                <div className="lgu-table-head">
                  <span>Comment</span>
                  <span>Rating</span>
                  <span>Date</span>
                  <span>Actions</span>
                </div>

                {feedbackState.loading ? (
                  <p className="muted">Loading reviews…</p>
                ) : filteredItems.length === 0 ? (
                  <p className="muted">No feedback yet for this establishment.</p>
                ) : (
                  filteredItems.map((item) => (
                    <article key={item.feedback_id} className="lgu-table-row">
                      <div className="lgu-review-info">
                        <p className="review-text">
                          {item.review_text?.length ? item.review_text : 'No written review provided.'}
                        </p>
                        <p className="review-meta">
                          by {item.tourist_name ?? 'Verified traveler'} · Profile ID:{' '}
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
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                      </div>

                      <div className="lgu-review-actions">
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => openReplyModal(item)}
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => handleViewThread(item.feedback_id)}
                          >
                            View thread
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <footer className="lgu-reviews-footer">
                <div>
                  Page {page} / {feedbackState.pages}
                </div>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={page >= feedbackState.pages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </footer>
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
                <p>Respond as LGU staff.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() =>
                  setReplyModal({ open: false, target: null, text: '', loading: false, error: '' })
                }
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
                  <button
                    type="button"
                    className="ghost-cta"
                    onClick={() =>
                      setReplyModal({ open: false, target: null, text: '', loading: false, error: '' })
                    }
                    disabled={replyModal.loading}
                  >
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

      {threadModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <div>
                <h3>Feedback thread</h3>
                {threadModal.data?.createdAt && (
                  <p className="muted">
                    Submitted {new Date(threadModal.data.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button type="button" className="ghost-btn" onClick={closeThreadModal}>
                Close
              </button>
            </header>

            {threadModal.loading ? (
              <p className="muted">Loading thread…</p>
            ) : threadModal.error ? (
              <p className="error-text">{threadModal.error}</p>
            ) : (
              <>
                <article className="thread-message">
                  <h4>Original comment</h4>
                  <p>{threadModal.data?.review_text || 'No written comment.'}</p>
                  <p className="muted">
                    Rating: {threadModal.data?.rating ?? '—'} ★ · Tourist ID:{' '}
                    {threadModal.data?.tourist_profile_id ?? '—'}
                  </p>
                </article>

                <section className="thread-replies">
                  <h4>Replies</h4>
                  {threadModal.data?.replies?.length ? (
                    <ul>
                      {threadModal.data.replies.map((reply) => (
                        <li key={reply._id ?? reply.feedback_response_id ?? reply.response_id}>
                          <strong>
                            {reply.bto_account_id
                              ? 'BTO response'
                              : reply.business_establishment_profile_id
                              ? 'Owner response'
                              : 'LGU response'}
                          </strong>
                          <span>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                          <p>{reply.response_text || reply.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No replies yet.</p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </LguStaffLayout>
  );
}

export default LguStaffFeedback;
