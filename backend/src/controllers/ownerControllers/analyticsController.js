import Feedback from '../../models/feedback/Feedback.js';
import TravelHistory from '../../models/tourist/TravelHistory.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import BusinessEstablishmentProfile from '../../models/businessEstablishmentModels/BusinessEstablishmentProfile.js';

/**
 * Guard: ensure the logged-in owner actually owns the establishment.
 */
async function assertOwnerAccess(estId, accountId) {
  const ownerProfile = await BusinessEstablishmentProfile.findOne({ account_id: accountId })
    .select('business_establishment_profile_id')
    .lean();

  if (!ownerProfile) {
    const err = new Error('Owner profile not found');
    err.statusCode = 403;
    throw err;
  }

  const establishment = await BusinessEstablishment.findOne({
    businessEstablishment_id: estId,
    business_establishment_profile_id: ownerProfile.business_establishment_profile_id,
  }).select('businessEstablishment_id');

  if (!establishment) {
    const err = new Error('Establishment not found or not owned by you');
    err.statusCode = 404;
    throw err;
  }
}

export const getRatingTrend = async (req, res, next) => {
  try {
    const { estId } = req.params;
    await assertOwnerAccess(estId, req.user?.account_id);

    const rows = await Feedback.aggregate([
      { $match: { business_establishment_id: estId } },
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          rating: 1,
        },
      },
      {
        $group: {
          _id: '$month',
          rating: { $avg: '$rating' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      trend: rows.map(item => ({ month: item._id, rating: Number(item.rating.toFixed(2)) })),
    });
  } catch (err) {
    next(err);
  }
};

export const getReviewCounts = async (req, res, next) => {
  try {
    const { estId } = req.params;
    await assertOwnerAccess(estId, req.user?.account_id);

    const rows = await Feedback.aggregate([
      { $match: { business_establishment_id: estId } },
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        },
      },
      {
        $group: {
          _id: '$month',
          reviews: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      monthly: rows.map(item => ({ month: item._id, reviews: item.reviews })),
    });
  } catch (err) {
    next(err);
  }
};

export const getCheckins = async (req, res, next) => {
  try {
    const { estId } = req.params;
    await assertOwnerAccess(estId, req.user?.account_id);

    const rows = await TravelHistory.aggregate([
      {
        $match: {
          business_establishment_id: estId,
          status: 'visited',
        },
      },
      {
        $project: {
          month: { $dateToString: { format: '%Y-%m', date: '$date_visited' } },
          capture: { $ifNull: ['$capture_method', 'manual'] },
        },
      },
      {
        $group: {
          _id: { month: '$month', capture: '$capture' },
          visits: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.month',
          buckets: {
            $push: {
              capture: '$_id.capture',
              visits: '$visits',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      monthly: rows.map(row => {
        const summary = { qr: 0, manual: 0 };
        row.buckets.forEach(bucket => {
          const capture = bucket.capture.toLowerCase();
          if (capture === 'qr' || capture === 'qr_scan') summary.qr += bucket.visits;
          else summary.manual += bucket.visits;
        });
        summary.month = row._id;
        return summary;
      }),
    });
  } catch (err) {
    next(err);
  }
};

export const getTagPerformanceSummary = async (req, res, next) => {
  try {
    const { estId } = req.params;
    await assertOwnerAccess(estId, req.user?.account_id);

    const rows = await TravelHistory.aggregate([
      {
        $match: {
          business_establishment_id: estId,
          status: 'visited',
        },
      },
      {
        $lookup: {
          from: 'establishmenttags',
          localField: 'business_establishment_id',
          foreignField: 'business_establishment_id',
          as: 'estTags',
        },
      },
      { $unwind: '$estTags' },
      {
        $lookup: {
          from: 'tags',
          localField: 'estTags.tag_id',
          foreignField: 'tag_id',
          as: 'tagDoc',
        },
      },
      { $unwind: '$tagDoc' },
      {
        $group: {
          _id: '$tagDoc.tag_name',
          visits: { $sum: 1 },
        },
      },
      { $sort: { visits: -1 } },
      { $limit: 5 },
    ]);

    // If there are zero check-ins, we still want to list the establishment’s tags.
    let tags = rows;
    if (!rows.length) {
      const fallback = await TravelHistory.aggregate([
        {
          $match: { business_establishment_id: estId },
        },
        {
          $lookup: {
            from: 'establishmenttags',
            localField: 'business_establishment_id',
            foreignField: 'business_establishment_id',
            as: 'estTags',
          },
        },
        { $unwind: '$estTags' },
        {
          $lookup: {
            from: 'tags',
            localField: 'estTags.tag_id',
            foreignField: 'tag_id',
            as: 'tagDoc',
          },
        },
        { $unwind: '$tagDoc' },
        {
          $group: {
            _id: '$tagDoc.tag_name',
            visits: { $sum: 0 },
          },
        },
        { $limit: 5 },
      ]);
      tags = fallback;
    }

    const maxVisits = tags.reduce((max, row) => Math.max(max, row.visits), 0) || 1;

    res.json({
      tags: tags.map(row => ({
        tag: row._id,
        visits: row.visits,
        score: Number(((row.visits / maxVisits) * 100).toFixed(1)),
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getFeedbackCategoryBreakdown = async (req, res, next) => {
  try {
    const { estId } = req.params;
    await assertOwnerAccess(estId, req.user?.account_id);

    const buckets = await Feedback.aggregate([
      { $match: { business_establishment_id: estId } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const distribution = [1, 2, 3, 4, 5].map(star => ({
      name: `${star}★`,
      value: buckets.find(b => b._id === star)?.count ?? 0,
    }));

    res.json({ categories: distribution });
  } catch (err) {
    next(err);
  }
};



