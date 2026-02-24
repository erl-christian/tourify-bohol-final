import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import FeedbackSummary from '../../models/Media/FeedbackSummary.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import {
  aggregateVisitorTrends,
  aggregateTopDestinations,
  aggregateHeatmapPoints,
  resolveMunicipalityForLgu,
  aggregateFeedbackDistribution,
  aggregateNationalityBreakdownByMunicipality,
  aggregateSequentialPatterns,
} from './analyticsControllers.js';

const formatDate = value => (value ? new Date(value).toISOString().slice(0, 10) : '-');

const truncate = (text, max = 180) => {
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const loadFeedbackSummariesForMunicipality = async municipalityId => {
  const summaries = await FeedbackSummary.aggregate([
    { $sort: { generated_at: -1, createdAt: -1 } },
    { $group: { _id: '$business_establishment_id', summary: { $first: '$$ROOT' } } },
  ]);
  const summaryMap = new Map(summaries.map(row => [row._id, row.summary]));

  const establishments = await BusinessEstablishment.find({ municipality_id: municipalityId })
    .select('businessEstablishment_id name municipality_id')
    .lean();

  return establishments.map(est => {
    const key = est.businessEstablishment_id ?? est.id;
    const summary = summaryMap.get(key);
    return {
      establishment: est.name ?? key ?? '-',
      municipality: est.municipality_id ?? '-',
      from: formatDate(summary?.time_range_start),
      to: formatDate(summary?.time_range_end),
      average: summary?.average_rating ?? '-',
      count: summary?.count ?? 0,
      summary: summary?.ai_summary ?? 'No summary yet.',
    };
  });
};

const buildSpmConclusion = flows => {
  if (!flows?.length) {
    return { sequence: '-', conclusion: 'No movement sequences available.' };
  }

  let best = null;
  for (const a of flows) {
    for (const b of flows) {
      if (a?.to?.id && b?.from?.id && a.to.id === b.from.id) {
        const score = (a.visits ?? 0) + (b.visits ?? 0);
        if (!best || score > best.score) best = { a, b, score };
      }
    }
  }

  if (best) {
    const from = best.a.from?.name ?? best.a.from?.id ?? 'Spot A';
    const mid = best.a.to?.name ?? best.a.to?.id ?? 'Spot B';
    const to = best.b.to?.name ?? best.b.to?.id ?? 'Spot C';
    return {
      sequence: `${from} > ${mid} > ${to}`,
      conclusion: `Tourists most often proceed to ${mid} next, then continue to ${to}.`,
    };
  }

  const top = flows[0];
  const from = top.from?.name ?? top.from?.id ?? 'Spot A';
  const to = top.to?.name ?? top.to?.id ?? 'Spot B';
  return {
    sequence: `${from} > ${to}`,
    conclusion: `Tourists most often go next to ${to} after ${from}.`,
  };
};


export const exportLguAnalyticsExcel = async (req, res, next) => {
  try {
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      req.query.municipalityId,
    );
    if (!municipalityId) {
      res.status(400);
      throw new Error('Municipality not resolved');
    }

    const workbook = new ExcelJS.Workbook();

    const addTable = (sheet, headers, rows) => {
      sheet.addRow(headers);
      rows.forEach(r => sheet.addRow(r));
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C5CE7' } };
      headerRow.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };
      const widths = headers.map((h, idx) =>
        Math.max(
          (h ?? '').toString().length,
          ...rows.map(r => (r?.[idx] ?? '').toString().length),
          10
        ) + 2
      );
      sheet.columns = widths.map(w => ({ width: Math.min(w, 30) }));
    };

    // Arrivals (municipality scope)
    const trendSheet = workbook.addWorksheet('Municipal arrivals');
    const trends = await aggregateVisitorTrends('municipality', municipalityId);
    addTable(trendSheet, ['Month', 'Trips', 'Tourists'], trends.map(r => [r.month, r.trips, r.touristCount]));

    // Visitor nationalities (municipality scope)
    const nationalitySheet = workbook.addWorksheet('Visitor nationalities');
    const nationalities = await aggregateNationalityBreakdownByMunicipality({ municipalityId, limit: 12 });
    addTable(
      nationalitySheet,
      ['Nationality', 'Tourists (unique)'],
      nationalities.map(row => [row.nationality ?? '-', row.count ?? 0])
    );

    // Feedback summary per establishment (municipality scope)
    const feedbackSheet = workbook.addWorksheet('Establishment feedback');
    const feedbackRows = await loadFeedbackSummariesForMunicipality(municipalityId);
    addTable(
      feedbackSheet,
      ['Establishment', 'Municipality', 'From', 'To', 'Avg rating', 'Reviews', 'Summary'],
      feedbackRows.map(row => [
        row.establishment,
        row.municipality,
        row.from,
        row.to,
        row.average,
        row.count,
        row.summary,
      ])
    );

    // SPM movements + conclusion (municipality scope)
    const spmSheet = workbook.addWorksheet('SPM movements');
    const spmFlows = await aggregateSequentialPatterns({ limit: 20, municipalityId });
    const spmConclusion = buildSpmConclusion(spmFlows);
    const spmRows = spmFlows.map(flow => [
      flow.from?.name ?? flow.from?.id ?? '-',
      flow.to?.name ?? flow.to?.id ?? '-',
      flow.visits ?? 0,
      flow.confidence ?? '-',
      flow.lift ?? '-',
    ]);
    spmRows.push([], ['Conclusion', spmConclusion.sequence, spmConclusion.conclusion, '', '']);
    addTable(spmSheet, ['From', 'To', 'Visits', 'Confidence', 'Lift'], spmRows);

    res.setHeader('Content-Disposition', 'attachment; filename=lgu-analytics.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};


export const exportLguAnalyticsPdf = async (req, res, next) => {
  try {
    const municipalityId = await resolveMunicipalityForLgu(
      req.user?.account_id,
      req.user?.role,
      req.query.municipalityId,
    );
    if (!municipalityId) {
      res.status(400);
      throw new Error('Municipality not resolved');
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`LGU Analytics Summary (${municipalityId})`, 14, 20);

    const trends = await aggregateVisitorTrends('municipality', municipalityId);
    autoTable(doc, {
      startY: 26,
      head: [['Month', 'Trips', 'Tourists']],
      body: trends.map(row => [row.month, row.trips, row.touristCount]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Visitor nationalities', 14, 20);
    const nationalities = await aggregateNationalityBreakdownByMunicipality({ municipalityId, limit: 12 });
    autoTable(doc, {
      startY: 30,
      head: [['Nationality', 'Tourists (unique)']],
      body: nationalities.map(row => [row.nationality ?? '-', row.count ?? 0]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Feedback summary per establishment', 14, 20);
    const feedbackRows = await loadFeedbackSummariesForMunicipality(municipalityId);
    autoTable(doc, {
      startY: 30,
      head: [['Establishment', 'Municipality', 'From', 'To', 'Avg rating', 'Reviews', 'Summary']],
      body: feedbackRows.map(row => [
        row.establishment,
        row.municipality,
        row.from,
        row.to,
        row.average,
        row.count,
        truncate(row.summary),
      ]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('SPM movements', 14, 20);
    const spmFlows = await aggregateSequentialPatterns({ limit: 20, municipalityId });
    autoTable(doc, {
      startY: 30,
      head: [['From', 'To', 'Visits', 'Confidence', 'Lift']],
      body: spmFlows.map(flow => [
        flow.from?.name ?? flow.from?.id ?? '-',
        flow.to?.name ?? flow.to?.id ?? '-',
        flow.visits ?? 0,
        flow.confidence ?? '-',
        flow.lift ?? '-',
      ]),
    });
    const lastY = doc.lastAutoTable?.finalY ?? 40;
    const { sequence, conclusion } = buildSpmConclusion(spmFlows);
    doc.text(`Sequence: ${sequence}`, 14, lastY + 10);
    doc.text(`Conclusion: ${conclusion}`, 14, lastY + 20);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Disposition', 'attachment; filename=lgu-analytics.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};



