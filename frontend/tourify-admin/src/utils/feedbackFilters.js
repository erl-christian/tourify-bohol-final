export const filterFeedbackItems = (items = [], filters = {}) => {
  const {
    query = '',
    rating = 'all',
    reply = 'all',
    text = 'all',
    status = 'all',
    dateFrom = '',
    dateTo = '',
  } = filters;

  const q = String(query).trim().toLowerCase();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

  return items.filter(item => {
    const reviewText = String(item.review_text ?? '');
    const reviewTextLower = reviewText.toLowerCase();
    const touristName = String(item.tourist_name ?? '').toLowerCase();
    const touristProfileId = String(item.tourist_profile_id ?? '').toLowerCase();
    const hasText = reviewText.trim().length > 0;
    const ratingValue = Number(item.rating ?? 0);
    const repliesCount = Array.isArray(item.replies)
      ? item.replies.length
      : Number(item.replies_count ?? 0);
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;

    if (
      q &&
      !reviewTextLower.includes(q) &&
      !touristName.includes(q) &&
      !touristProfileId.includes(q)
    ) {
      return false;
    }

    if (rating !== 'all' && ratingValue !== Number(rating)) return false;
    if (reply === 'replied' && repliesCount === 0) return false;
    if (reply === 'awaiting' && repliesCount > 0) return false;
    if (text === 'with_text' && !hasText) return false;
    if (text === 'rating_only' && hasText) return false;
    if (status === 'active' && (item.is_hidden || item.is_flagged || item.deleted_at)) return false;
    if (status === 'hidden' && !item.is_hidden) return false;
    if (status === 'flagged' && !item.is_flagged) return false;
    if (status === 'deleted' && !item.deleted_at) return false;
    if (from && (!createdAt || createdAt < from)) return false;
    if (to && (!createdAt || createdAt > to)) return false;

    return true;
  });
};
