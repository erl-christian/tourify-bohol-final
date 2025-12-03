import Feedback from "../../models/feedback/Feedback.js";
import FeedbackResponse from "../../models/feedback/FeedbackResponse.js";
import MediaFeedback from "../../models/Media/MediaFeedback.js";
import Media from "../../models/Media/Media.js";

export const listFeedbackForEstablishment = async (req, res, next) => {
  try {
    const { estId } = req.params;
    const {
      page = 1,
      pageSize = 10,
      min_rating,         // 1..5
      has_text,           // "true" => only with review_text
      sort = "newest"     // newest | oldest | rating_desc | rating_asc
    } = req.query;

    const role = req.user?.role;
    const isBto = role === 'bto_admin';

    const baseMatch = { business_establishment_id: estId };
    if (!isBto) {
      baseMatch.deleted_at = { $in: [null, undefined] };
      baseMatch.is_hidden = { $ne: true };
    }
    if (min_rating) baseMatch.rating = { $gte: Number(min_rating) };
    if (has_text === "true") baseMatch.review_text = { $exists: true, $ne: "" };

    const sortMap = {
      newest:      { createdAt: -1 },
      oldest:      { createdAt:  1 },
      rating_desc: { rating: -1, createdAt: -1 },
      rating_asc:  { rating:  1, createdAt: -1 },
    };
    const sortSpec = sortMap[sort] || sortMap.newest;

    const skip = (Math.max(1, +page) - 1) * Math.max(1, +pageSize);
    const limit = Math.max(1, +pageSize);

    const [items, total, summaryAgg, buckets] = await Promise.all([
      Feedback.find(baseMatch).sort(sortSpec).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(baseMatch),
      Feedback.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            avg: { $avg: '$rating' },
            count: { $sum: 1 },
            withText: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$review_text', false] },
                      { $ne: ['$review_text', ''] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      // optional: star distribution 1..5
      Feedback.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$rating", count: { $sum: 1 } } }
      ])
    ]);

    const feedbackIds = items.map(item => item.feedback_id).filter(Boolean);
    let mediaByFeedback = {};
    if (feedbackIds.length) {
      const links = await MediaFeedback.find({ feedback_id: { $in: feedbackIds } })
        .select('feedback_id media_id')
        .lean();

      const mediaIds = links.map(link => link.media_id);
      if (mediaIds.length) {
        const mediaDocs = await Media.find({ media_id: { $in: mediaIds } })
          .select('media_id file_url file_type caption createdAt')
          .lean();

        const mediaMap = mediaDocs.reduce((acc, doc) => {
          acc[doc.media_id] = {
            media_id: doc.media_id,
            file_url: doc.file_url,
            file_type: doc.file_type,
            caption: doc.caption ?? null,
            createdAt: doc.createdAt,
          };
          return acc;
        }, {});

        mediaByFeedback = links.reduce((acc, link) => {
          if (!acc[link.feedback_id]) acc[link.feedback_id] = [];
          const doc = mediaMap[link.media_id];
          if (doc) acc[link.feedback_id].push(doc);
          return acc;
        }, {});
      }
    }

    const itemsWithMedia = items.map(item => ({
      ...item,
      media: mediaByFeedback[item.feedback_id] ?? [],
    }));

    const summaryDoc = summaryAgg[0];
    const summary = summaryAgg.length
      ? {
          average_rating: +summaryDoc.avg.toFixed(2),
          count: summaryDoc.count,
          total_reviews: summaryDoc.count,
          with_text: summaryDoc.withText ?? 0,
          no_text: summaryDoc.count - (summaryDoc.withText ?? 0),
        }
      : { average_rating: 0, count: 0, total_reviews: 0, with_text: 0, no_text: 0 };

    // normalize buckets to {1: n, 2: n, ...}
    const dist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    for (const b of buckets) dist[b._id] = b.count;

    res.json({
      page: +page,
      pageSize: limit,
      total,
      pages: Math.ceil(total / limit),
      summary,
      distribution: dist,
      items: itemsWithMedia
    });
  } catch (e) { next(e); }
};

export const getFeedbackDetails = async (req, res, next) => {
  try {
    const { feedbackId } = req.params;
    const role = req.user?.role;
    const isBto = role === 'bto_admin';

    const fb = await Feedback.findOne({ feedback_id: feedbackId }).lean();
    if (!fb) return res.status(404).json({ message: "Feedback not found" });

    if (!isBto && (fb.deleted_at || fb.is_hidden)) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // include replies (LGU, Owner, BTO)
    const replies = await FeedbackResponse.find({ feedback_id: feedbackId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ ...fb, replies });
  } catch (e) { next(e); }
};
