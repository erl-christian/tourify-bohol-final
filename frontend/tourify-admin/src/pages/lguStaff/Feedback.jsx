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
  fetchFeedbackStats,
  fetchLatestFeedbackSummary,
  generateFeedbackSummary,
} from '../../services/feedbackApi';
import { useActionStatus } from '../../context/ActionStatusContext';

import { filterFeedbackItems } from '../../utils/feedbackFilters';


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

const toDateInputValue = date => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

const clampDateValue = (value, min, max) => {
  if (!value) return '';
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
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

function LguStaffFeedback() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const todayInputDate = useMemo(() => toDateInputValue(new Date()), []);
  const [establishments, setEstablishments] = useState([]);
  const [selectedEst, setSelectedEst] = useState('');
  const [establishmentSearch, setEstablishmentSearch] = useState('');
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');

  const [ratingFilter, setRatingFilter] = useState('all');
  const [replyFilter, setReplyFilter] = useState('all');
  const [commentFilter, setCommentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summaryFrom, setSummaryFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
  });
  const [summaryTo, setSummaryTo] = useState(() => toDateInputValue(new Date()));
  const [summaryRangeError, setSummaryRangeError] = useState('');
  const [summaryDateBounds, setSummaryDateBounds] = useState({ min: '', max: '' });


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
          const first = getEstablishmentId(items[0]);
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
      setFeedbackState(prev => ({ ...prev, loading: true }));
      const { data } = await fetchLguFeedback(selectedEst, {
        page,
        sort,
        pageSize: 10,
      });

      const baseItems = Array.isArray(data?.items) ? data.items : [];
      const items = await Promise.all(
        baseItems.map(async item => {
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
        items,
        summary: data?.summary ?? null,
        distribution: data?.distribution ?? {},
        total: data?.total ?? items.length,
        pages: data?.pages ?? 1,
      });
    } catch (err) {
      console.error('[LGU Staff Feedback] load feedback failed', err);
      setFeedbackState(prev => ({ ...prev, loading: false }));
      setError('Unable to load feedback entries.');
    }
  }, [selectedEst, page, sort]);


  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedEst) return;
      try {
        setSummaryState((prev) => ({ ...prev, loading: true }));
        const [latestRes, statsRes] = await Promise.all([
          fetchLatestFeedbackSummary(selectedEst).catch(() => null),
          fetchFeedbackStats(selectedEst).catch(() => null),
        ]);
        const minDate = statsRes?.data?.date_bounds?.oldest_feedback_at
          ? toDateInputValue(new Date(statsRes.data.date_bounds.oldest_feedback_at))
          : '';
        const maxDate = statsRes?.data?.date_bounds?.latest_feedback_at
          ? toDateInputValue(new Date(statsRes.data.date_bounds.latest_feedback_at))
          : '';
        setSummaryDateBounds({ min: minDate, max: maxDate });
        setSummaryFrom(prev => {
          if (!minDate || !maxDate) return prev;
          const initial = prev || minDate;
          return clampDateValue(initial, minDate, maxDate);
        });
        setSummaryTo(prev => {
          if (!minDate || !maxDate) return prev;
          const initial = prev || maxDate;
          return clampDateValue(initial, minDate, maxDate);
        });
        const latestData = latestRes?.data ?? null;
        const parsedSummary = parseAiSummary(latestData?.ai_summary);
        setSummaryState({ loading: false, latest: latestData, parsedSummary });
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

  const filteredItems = useMemo(
    () =>
      filterFeedbackItems(feedbackState.items, {
        query: search,
        rating: ratingFilter,
        reply: replyFilter,
        text: commentFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
      }),
    [feedbackState.items, search, ratingFilter, replyFilter, commentFilter, statusFilter, dateFrom, dateTo],
  );

  const clearFilters = () => {
    setSearch('');
    setRatingFilter('all');
    setReplyFilter('all');
    setCommentFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const filteredEstablishments = useMemo(() => {
    const query = establishmentSearch.trim().toLowerCase();
    if (!query) return establishments;
    return establishments.filter(est => {
      const id = getEstablishmentId(est);
      const name = est?.name ?? est?.establishment_name ?? id;
      return `${name} ${id}`.toLowerCase().includes(query);
    });
  }, [establishments, establishmentSearch]);

  const establishmentOptions = useMemo(() => {
    if (!selectedEst) return filteredEstablishments;
    const hasSelected = filteredEstablishments.some(est => getEstablishmentId(est) === selectedEst);
    if (hasSelected) return filteredEstablishments;
    const selectedEntry = establishments.find(est => getEstablishmentId(est) === selectedEst);
    return selectedEntry ? [selectedEntry, ...filteredEstablishments] : filteredEstablishments;
  }, [filteredEstablishments, establishments, selectedEst]);

  useEffect(() => {
    const query = establishmentSearch.trim();
    if (!query || !filteredEstablishments.length) return;
    const timer = setTimeout(() => {
      const firstId = getEstablishmentId(filteredEstablishments[0]);
      if (firstId && firstId !== selectedEst) {
        setSelectedEst(firstId);
        setPage(1);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [establishmentSearch, filteredEstablishments, selectedEst]);


  const handleGenerateSummary = async () => {
    if (!selectedEst) return;
    if (!summaryFrom || !summaryTo) {
      const message = 'Select both summary range dates.';
      setSummaryRangeError(message);
      showError(message);
      return;
    }
    const from = new Date(`${summaryFrom}T00:00:00`);
    const to = new Date(`${summaryTo}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      const message = 'Summary date range is invalid.';
      setSummaryRangeError(message);
      showError(message);
      return;
    }
    if (summaryDateBounds.min && summaryFrom < summaryDateBounds.min) {
      const message = `Earliest allowed date is ${summaryDateBounds.min}.`;
      setSummaryRangeError(message);
      showError(message);
      return;
    }
    if (summaryDateBounds.max && summaryTo > summaryDateBounds.max) {
      const message = `Latest allowed date is ${summaryDateBounds.max}.`;
      setSummaryRangeError(message);
      showError(message);
      return;
    }

    try {
      setSummaryRangeError('');
      setSummaryState((prev) => ({ ...prev, loading: true }));
      showLoading('Generating AI summary...');
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
      showSuccess('AI summary generated successfully.');
    } catch (err) {
      console.error('Failed to generate summary', err);
      setSummaryState((prev) => ({ ...prev, loading: false }));
      showError('Unable to generate summary right now.');
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
      <section className="lgu-feedback-page feedback-studio">
        <header className="lgu-feedback-hero">
          <div>
            <p className="eyebrow">Reviews</p>
            <h1>Municipal feedback</h1>
            <p className="muted">
              Track tourist sentiment across your establishments, respond formally, and surface issues.
            </p>
          </div>
          <div className="owner-hero-filters">
            <label className="owner-hero-filters__search">
              Search establishment
              <input
                type="search"
                placeholder="Search by name or ID"
                value={establishmentSearch}
                onChange={event => setEstablishmentSearch(event.target.value)}
              />
            </label>
            <label>
              Establishment
              <select
                value={selectedEst}
                onChange={(event) => {
                  setSelectedEst(event.target.value);
                  setPage(1);
                }}
                disabled={loadingEstablishments || !establishmentOptions.length}
              >
                {!establishmentOptions.length ? (
                  <option value="">No matching establishments</option>
                ) : null}
                {establishmentOptions.map((est) => {
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
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={summaryState.loading || !summaryDateBounds.min || !summaryDateBounds.max}
                  >
                    <IoChatbubbleEllipsesOutline /> Generate
                  </button>
                </div>
                <div className="summary-range-fields">
                  <label className="summary-range-field">
                    <span>From</span>
                    <input
                      type="date"
                      value={summaryFrom}
                      min={summaryDateBounds.min || undefined}
                      max={summaryTo || summaryDateBounds.max || todayInputDate}
                      onChange={event => setSummaryFrom(event.target.value)}
                      disabled={summaryState.loading}
                    />
                  </label>
                  <label className="summary-range-field">
                    <span>To</span>
                    <input
                      type="date"
                      value={summaryTo}
                      min={summaryFrom || summaryDateBounds.min || undefined}
                      max={summaryDateBounds.max || todayInputDate}
                      onChange={event => setSummaryTo(event.target.value)}
                      disabled={summaryState.loading}
                    />
                  </label>
                </div>
                {summaryDateBounds.min && summaryDateBounds.max ? (
                  <p className="summary-helper">
                    Available feedback range: {summaryDateBounds.min} to {summaryDateBounds.max}
                  </p>
                ) : (
                  <p className="summary-helper">No feedback yet. Generate summary is disabled.</p>
                )}
                {summaryRangeError ? <p className="summary-range-error">{summaryRangeError}</p> : null}
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

            <section className="feedbackx-shell">
              <div className="feedbackx-top">
                <div className="feedbackx-title">
                  <h2>Visitor comments</h2>
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
                    value={search}
                    onChange={e => setSearch(e.target.value)}
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
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="flagged">Flagged only</option>
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
                          <button type="button" className="btn-ghost" onClick={() => handleViewThread(item.feedback_id)}>
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
                <button type="button" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
                  Previous
                </button>
                <span>Page {page} of {feedbackState.pages}</span>
                <button type="button" disabled={page >= feedbackState.pages} onClick={() => setPage(prev => prev + 1)}>
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
                              : reply.tourist_profile_id
                              ? 'Tourist response'
                              : reply.business_establishment_profile_id
                              ? 'Owner response'
                              : reply.admin_staff_profile_id
                              ? 'LGU response'
                              : 'Response'}
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

