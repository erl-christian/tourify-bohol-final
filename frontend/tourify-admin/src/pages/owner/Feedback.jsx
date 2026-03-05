import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IoSearchOutline,
  IoFilterOutline,
  IoStar,
  IoChatbubblesOutline,
  IoFlashOutline,
  IoReloadOutline,
  IoChatbubbleEllipsesOutline,
  IoCloseOutline,
} from 'react-icons/io5';
import OwnerLayout from '../../components/OwnerLayout';
import '../../styles/AdminDashboard.css';
import { fetchOwnerEstablishments } from '../../services/establishmentApi';
import {
  fetchOwnerFeedback,
  ownerReplyToFeedback,
  fetchFeedbackDetails,
} from '../../services/feedbackApi';
import { useActionStatus } from '../../context/ActionStatusContext';

const sortOptions = [
  { value: 'newest', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating_desc', label: 'Highest rating' },
  { value: 'rating_asc', label: 'Lowest rating' },
];

const ratingLabels = { 5: 'Excellent', 4: 'Great', 3: 'Average', 2: 'Fair', 1: 'Poor' };

const RatingStars = ({ value }) => (
  <div className="owner-rating-stars">
    {[1, 2, 3, 4, 5].map(idx => (
      <IoStar key={idx} size={16} color={idx <= value ? '#facc15' : '#d1d5db'} />
    ))}
  </div>
);

function OwnerFeedback() {
  const { showLoading, showSuccess, showError } = useActionStatus();
  const [establishments, setEstablishments] = useState([]);
  const [selectedEst, setSelectedEst] = useState('');
  const [loadingEstablishments, setLoadingEstablishments] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [filters, setFilters] = useState({ query: '', rating: 'all', reply: 'all' });

  const [feedbackState, setFeedbackState] = useState({
    loading: false,
    items: [],
    summary: null,
    distribution: {},
    total: 0,
    pages: 1,
  });

  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySubmitting, setReplySubmitting] = useState('');
  const [activeThread, setActiveThread] = useState(null);

  useEffect(() => {
    const loadEstablishments = async () => {
      try {
        setLoadingEstablishments(true);
        const { data } = await fetchOwnerEstablishments({ limit: 50 });
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setEstablishments(items);
        if (!items.length) {
          setError('You do not have any accredited establishments yet.');
        } else {
          setSelectedEst(items[0].businessEstablishment_id ?? items[0].business_establishment_id ?? '');
          setError('');
        }
      } catch (err) {
        console.error('Failed to load owner establishments', err);
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
      const { data } = await fetchOwnerFeedback(selectedEst, {
         page,
         sort,
         pageSize: 10,
         rating: filters.rating === 'all' ? undefined : filters.rating,
         hasReply:
           filters.reply === 'all'
             ? undefined
             : filters.reply === 'with'
             ? true
             : filters.reply === 'without'
             ? false
             : undefined,
         query: filters.query || undefined,
       });
      const list = Array.isArray(data?.items) ? data.items : [];
      const enriched = await Promise.all(
        list.map(async item => {
          try {
            const detail = await fetchFeedbackDetails(item.feedback_id);
            return { ...item, replies: detail.data?.replies ?? [] };
          } catch (err) {
            console.warn('Failed to fetch replies for feedback', item.feedback_id, err);
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
      console.error('Failed to load feedback', err);
      setFeedbackState(prev => ({ ...prev, loading: false }));
      setError('Unable to retrieve feedback for this establishment.');
    }
  }, [selectedEst, page, sort, filters]);

  useEffect(() => {
    if (selectedEst) loadFeedback();
  }, [selectedEst, loadFeedback, filters]);

  const handleReplySubmit = async feedbackId => {
    const message = replyDrafts[feedbackId]?.trim();
    if (!message) return;
    try {
      setReplySubmitting(feedbackId);
      showLoading('Sending reply...');
      await ownerReplyToFeedback(feedbackId, { response_text: message });
      setReplyDrafts(prev => ({ ...prev, [feedbackId]: '' }));
      await loadFeedback();
      showSuccess('Reply sent successfully.');
    } catch (err) {
      console.error('Failed to send reply', err);
      showError('Unable to send reply. Please try again.');
    } finally {
      setReplySubmitting('');
    }
  };

  const summaryCards = useMemo(() => {
    if (!feedbackState.summary) return [];
    return [
      {
        Icon: IoStar,
        label: 'Average rating',
        value:
          feedbackState.summary.average_rating != null
            ? Number(feedbackState.summary.average_rating).toFixed(1)
            : '—',
        helper: `${feedbackState.summary.total_reviews ?? 0} total reviews`,
      },
      {
        Icon: IoChatbubblesOutline,
        label: 'Written reviews',
        value: feedbackState.summary.with_text ?? 0,
        helper: 'Visitors left a comment',
      },
      {
        Icon: IoFlashOutline,
        label: 'Quick ratings',
        value: feedbackState.summary.no_text ?? 0,
        helper: 'No comment attached',
      },
    ];
  }, [feedbackState.summary]);

  const ratingDistribution = useMemo(() => {
    const base = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    return { ...base, ...(feedbackState.distribution ?? {}) };
  }, [feedbackState.distribution]);

  const filteredItems = useMemo(() => {
    return feedbackState.items
      .filter(item => {
        if (filters.rating === 'all') return true;
        return Number(item.rating) === Number(filters.rating);
      })
      .filter(item => {
        if (filters.reply === 'all') return true;
        if (filters.reply === 'with') return Array.isArray(item.replies) && item.replies.length > 0;
        return !item.replies || item.replies.length === 0;
      })
      .filter(item =>
        filters.query
          ? (item.review_text ?? '')
              .toLowerCase()
              .includes(filters.query.toLowerCase())
          : true
      );
  }, [feedbackState.items, filters]);

  const emptyState = feedbackState.loading
    ? 'Loading feedback…'
    : 'No feedback matches the current filters.';

  return (
    <OwnerLayout title="Traveler Feedback">
      <section className="owner-feedback-layout">
        <header className="owner-feedback-header">
          <div>
            <p className="eyebrow">Insights</p>
            <h1>Traveler feedback</h1>
            <p className="muted">
              Monitor sentiment across your establishments, reply to visitors, and spot trends.
            </p>
          </div>
          <div className="header-actions">
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
              Sort by
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
            <section className="owner-feedback-summary">
              {summaryCards.map(card => (
                <article key={card.label} className="summary-card">
                  <div className="summary-icon">
                    <card.Icon size={20} />
                  </div>
                  <p className="summary-label">{card.label}</p>
                  <p className="summary-value">{card.value}</p>
                  <p className="summary-helper">{card.helper}</p>
                </article>
              ))}

              <article className="summary-card distribution-card">
                <div className="summary-header">
                  <p className="summary-label">Rating breakdown</p>
                  <button type="button" onClick={() => loadFeedback()}>
                    <IoReloadOutline /> Refresh
                  </button>
                </div>
                {Object.entries(ratingDistribution)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([stars, count]) => (
                    <div key={stars} className="distribution-row">
                      <span className="distribution-label">
                        {stars} ★ <small>{ratingLabels[stars]}</small>
                      </span>
                      <div className="distribution-bar">
                        <div
                          style={{
                            width: feedbackState.total ? `${(count / feedbackState.total) * 100}%` : '0%',
                          }}
                        />
                      </div>
                      <span className="distribution-count">{count}</span>
                    </div>
                  ))}
              </article>
            </section>

            <section className="owner-feedback-body">
              <aside className="feedback-filters">
                <div className="filter-input">
                  <IoSearchOutline />
                  <input
                    placeholder="Search comment or visitor…"
                    value={filters.query}
                    onChange={event => {
                      setFilters(prev => ({ ...prev, query: event.target.value }));
                      setPage(1);
                    }}
                  />
                </div>

                <div className="filter-block">
                  <p className="filter-label">Rating</p>
                  <div className="chip-group">
                    {['all', 5, 4, 3, 2, 1].map(option => (
                      <button
                        key={option}
                        className={filters.rating === option ? 'chip active' : 'chip'}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, rating: option }));
                          setPage(1);
                        }}
                      >
                        {option === 'all' ? 'All' : `${option}★`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-block">
                  <p className="filter-label">Replies</p>
                  <div className="chip-group">
                    {[
                      { label: 'All', value: 'all' },
                      { label: 'With reply', value: 'with' },
                      { label: 'Awaiting reply', value: 'without' },
                    ].map(option => (
                      <button
                        key={option.value}
                        className={filters.reply === option.value ? 'chip active' : 'chip'}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, reply: option.value }));
                          setPage(1);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-block filter-note">
                  <IoFilterOutline />
                  <p>Use these filters to narrow down specific feedback types.</p>
                </div>
              </aside>

              <div className="feedback-list-container">
                <header className="list-header">
                  <div>
                    <h2>Feedback</h2>
                    <p className="muted">
                      Showing {filteredItems.length} of {feedbackState.total} reviews
                    </p>
                  </div>
                  <span className="badge">{feedbackState.loading ? 'Refreshing…' : `Page ${page}`}</span>
                </header>

                {feedbackState.loading && !feedbackState.items.length ? (
                  <p className="muted">{emptyState}</p>
                ) : filteredItems.length ? (
                  filteredItems.map(item => (
                    <article
                      key={item.feedback_id}
                      className={`feedback-card ${activeThread?.feedback_id === item.feedback_id ? 'selected' : ''}`}
                      onClick={() => setActiveThread(item)}
                    >
                      <div className="feedback-card-head">
                        <div>
                          <strong>{item.tourist_name ?? 'Verified traveler'}</strong>
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</span>
                        </div>
                        <div className="rating-pill">
                          <span>{Number(item.rating).toFixed(1)}</span>
                          <RatingStars value={item.rating} />
                        </div>
                      </div>

                      <p className="feedback-comment">
                        {item.review_text?.length ? item.review_text : 'No written review provided.'}
                      </p>

                      <div className="feedback-meta">
                        <span className="meta-chip">
                          Profile ID: {item.tourist_profile_id ?? '—'}
                        </span>
                        {item.replies?.length ? (
                          <span className="meta-chip success">{item.replies.length} reply</span>
                        ) : (
                          <span className="meta-chip warning">Awaiting reply</span>
                        )}
                      </div>

                      <div className="reply-box">
                        <textarea
                          value={replyDrafts[item.feedback_id] ?? ''}
                          placeholder="Write a response…"
                          onClick={event => event.stopPropagation()}
                          onChange={event =>
                            setReplyDrafts(prev => ({
                              ...prev,
                              [item.feedback_id]: event.target.value,
                            }))
                          }
                        />
                        <div className="reply-actions">
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={event => {
                              event.stopPropagation();
                              setReplyDrafts(prev => ({ ...prev, [item.feedback_id]: '' }));
                            }}
                            disabled={!replyDrafts[item.feedback_id]}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={event => {
                              event.stopPropagation();
                              handleReplySubmit(item.feedback_id);
                            }}
                            disabled={
                              !replyDrafts[item.feedback_id]?.trim() || replySubmitting === item.feedback_id
                            }
                          >
                            {replySubmitting === item.feedback_id ? 'Sending…' : 'Send reply'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-card">{emptyState}</div>
                )}

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
              </div>

              <aside className="feedback-detail">
                {activeThread ? (
                  <>
                    <header>
                      <div>
                        <p className="eyebrow">Selected review</p>
                        <h3>{activeThread.tourist_name ?? 'Verified traveler'}</h3>
                      </div>
                      <button type="button" className="ghost-btn" onClick={() => setActiveThread(null)}>
                        <IoCloseOutline size={18} />
                      </button>
                    </header>

                    <div className="detail-rating">
                      <RatingStars value={activeThread.rating} />
                      <span>{ratingLabels[activeThread.rating] ?? ''}</span>
                    </div>

                    <p className="detail-comment">{activeThread.review_text || 'No comment provided.'}</p>

                    <section className="detail-thread">
                      <p className="filter-label">Replies</p>
                      {activeThread.replies?.length ? (
                        activeThread.replies.map(reply => (
                          <article key={reply._id ?? reply.response_id} className="detail-reply">
                            <header>
                              <strong>
                                <IoChatbubbleEllipsesOutline />{' '}
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
                              </strong>
                              <span>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</span>
                            </header>
                            <p>{reply.response_text}</p>
                          </article>
                        ))
                      ) : (
                        <p className="muted">No replies recorded yet.</p>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="empty-card">Select a review to see full details and reply thread.</div>
                )}
              </aside>
            </section>
          </>
        )}
      </section>
    </OwnerLayout>
  );
}

export default OwnerFeedback;

