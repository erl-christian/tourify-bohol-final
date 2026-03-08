import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EstablishmentLayout from '../../components/EstablishmentLayout';
import '../../styles/AdminDashboard.css';
import {
  fetchOwnerFeedback,
  ownerReplyToFeedback,
  fetchFeedbackDetails,
} from '../../services/feedbackApi';

function EstablishmentFeedback() {
  const { estId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    items: [],
    total: 0,
    pages: 1,
  });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySubmitting, setReplySubmitting] = useState('');

  const loadFeedback = useCallback(async () => {
    if (!estId) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await fetchOwnerFeedback(estId, {
        page,
        pageSize: 10,
        sort,
        query: query || undefined,
        rating: rating === 'all' ? undefined : rating,
      });

      const list = Array.isArray(data?.items) ? data.items : [];
      const withReplies = await Promise.all(
        list.map(async item => {
          try {
            const detail = await fetchFeedbackDetails(item.feedback_id);
            return { ...item, replies: detail.data?.replies ?? [] };
          } catch {
            return { ...item, replies: [] };
          }
        }),
      );

      setState({
        items: withReplies,
        total: Number(data?.total ?? withReplies.length),
        pages: Number(data?.pages ?? 1),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load establishment feedback.');
      setState({ items: [], total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [estId, page, sort, query, rating]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const submitReply = async feedbackId => {
    const text = replyDrafts[feedbackId]?.trim();
    if (!text) return;
    setReplySubmitting(feedbackId);
    try {
      await ownerReplyToFeedback(feedbackId, { response_text: text });
      setReplyDrafts(prev => ({ ...prev, [feedbackId]: '' }));
      await loadFeedback();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send reply.');
    } finally {
      setReplySubmitting('');
    }
  };

  return (
    <EstablishmentLayout
      title="Establishment Feedback"
      subtitle="Review and respond to tourist feedback for this establishment."
    >
      {error ? <p className="error-text">{error}</p> : null}

      <section className="account-management">
        <div className="section-heading">
          <h2>Feedback List</h2>
          <p>Simple filters and direct replies.</p>
        </div>

        <div className="est-filter-bar">
          <div className="est-filter-item est-filter-item--search">
            <span>Search</span>
            <input
              type="text"
              placeholder="Search reviews..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="est-filter-item">
            <span>Rating</span>
            <select
              value={rating}
              onChange={e => {
                setRating(e.target.value);
                setPage(1);
              }}
            >
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
            <select
              value={sort}
              onChange={e => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
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
            {loading ? (
              <li className="table-row table-grid">
                <div className="muted">Loading feedback...</div>
              </li>
            ) : state.items.length === 0 ? (
              <li className="table-row table-grid">
                <div className="muted">No feedback found.</div>
              </li>
            ) : (
              state.items.map(item => (
                <li key={item.feedback_id} className="table-row table-grid">
                  <div>{item.tourist_name || 'Verified traveler'}</div>
                  <div>{item.review_text || 'No written review provided.'}</div>
                  <div>{Number(item.rating || 0).toFixed(1)}</div>
                  <div>{item.replies?.length || 0}</div>
                  <div className="table-actions">
                    <textarea
                      value={replyDrafts[item.feedback_id] || ''}
                      placeholder="Reply..."
                      onChange={e =>
                        setReplyDrafts(prev => ({ ...prev, [item.feedback_id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="primary-cta"
                      onClick={() => submitReply(item.feedback_id)}
                      disabled={!replyDrafts[item.feedback_id]?.trim() || replySubmitting === item.feedback_id}
                    >
                      {replySubmitting === item.feedback_id ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="pagination-bar">
          <div className="pagination-info">
            Showing {state.items.length} of {state.total}
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="pagination-page">Page {page} of {state.pages}</span>
            <button
              type="button"
              className="pagination-button"
              onClick={() => setPage(p => Math.min(state.pages, p + 1))}
              disabled={page >= state.pages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </EstablishmentLayout>
  );
}

export default EstablishmentFeedback;
