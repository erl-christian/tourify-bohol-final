import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import FeedbackSummary from '../../models/Media/FeedbackSummary.js';
import BusinessEstablishment from '../../models/businessEstablishmentModels/BusinessEstablishment.js';
import {
  aggregateVisitorTrends,
  aggregateMunicipalityArrivals,
  aggregateTopDestinations,
  aggregateHeatmapPoints,
  aggregateFeedbackDistribution,
  aggregateNationalityBreakdown,
  aggregateSequentialPatterns,
} from './analyticsControllers.js';

const formatDate = value => (value ? new Date(value).toISOString().slice(0, 10) : '—');

const truncate = (text, max = 180) => {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const loadFeedbackSummaries = async () => {
  const summaries = await FeedbackSummary.aggregate([
    { $sort: { generated_at: -1, createdAt: -1 } },
    { $group: { _id: '$business_establishment_id', summary: { $first: '$$ROOT' } } },
  ]);
  const summaryMap = new Map(summaries.map(row => [row._id, row.summary]));

  const establishments = await BusinessEstablishment.find({})
    .select('businessEstablishment_id name municipality_id')
    .lean();

  return establishments.map(est => {
    const key = est.businessEstablishment_id ?? est.id;
    const summary = summaryMap.get(key);
    return {
      establishment: est.name ?? key ?? '—',
      municipality: est.municipality_id ?? '—',
      from: formatDate(summary?.time_range_start),
      to: formatDate(summary?.time_range_end),
      average: summary?.average_rating ?? '—',
      count: summary?.count ?? 0,
      summary: summary?.ai_summary ?? 'No summary yet.',
    };
  });
};

const buildSpmConclusion = flows => {
  if (!flows?.length) {
    return { sequence: '—', conclusion: 'No movement sequences available.' };
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


export const exportAnalyticsExcel = async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const addTable = (sheet, headers, rows) => {
      // Add rows
      sheet.addRow(headers);
      rows.forEach(r => sheet.addRow(r));

      // Header styling
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C5CE7' } };
      headerRow.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      };

      // Column widths from content
      const widths = headers.map((h, idx) =>
        Math.max(
          (h ?? '').toString().length,
          ...rows.map(r => (r?.[idx] ?? '').toString().length),
          10
        ) + 2
      );
      sheet.columns = widths.map(w => ({ width: Math.min(w, 30) }));
    };

    // Visitor nationalities
    const nationalitySheet = workbook.addWorksheet('Visitor nationalities');
    const nationalities = await aggregateNationalityBreakdown(12);
    addTable(
      nationalitySheet,
      ['Nationality', 'Tourists (unique)'],
      nationalities.map(row => [row.nationality ?? '—', row.count ?? 0])
    );

    // Feedback summary per establishment
    const feedbackSummarySheet = workbook.addWorksheet('Establishment feedback');
    const feedbackRows = await loadFeedbackSummaries();
    addTable(
      feedbackSummarySheet,
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

    // SPM movements + conclusion
    const spmSheet = workbook.addWorksheet('SPM movements');
    const spmFlows = await aggregateSequentialPatterns({ limit: 20 });
    const spmConclusion = buildSpmConclusion(spmFlows);
    const spmRows = spmFlows.map(flow => [
      flow.from?.name ?? flow.from?.id ?? '—',
      flow.to?.name ?? flow.to?.id ?? '—',
      flow.visits ?? 0,
      flow.confidence ?? '—',
      flow.lift ?? '—',
    ]);
    spmRows.push([], ['Conclusion', spmConclusion.sequence, spmConclusion.conclusion, '', '']);
    addTable(spmSheet, ['From', 'To', 'Visits', 'Confidence', 'Lift'], spmRows);


    // Province arrivals
    const trendsSheet = workbook.addWorksheet('Province arrivals');
    const trends = await aggregateVisitorTrends('province');
    addTable(
      trendsSheet,
      ['Month', 'Trips', 'Tourists'],
      trends.map(row => [row.month, row.trips, row.touristCount])
    );

    // Municipal arrivals
    const muniSheet = workbook.addWorksheet('Municipal arrivals');
    const muni = await aggregateMunicipalityArrivals(20);
    const muniRows = [
      ...muni.map(row => [row.municipality ?? row.municipality_id, row.total]),
      [],
      ...muni.flatMap(row =>
        (row.records ?? []).map(record => [
          row.municipality ?? row.municipality_id,
          record.date,
          record.source,
          record.visits,
        ])
      ),
    ];
    addTable(muniSheet, ['Municipality', 'Total/Date', 'Source', 'Visits'], muniRows);

    // Feedback summary
    const feedbackSheet = workbook.addWorksheet('Feedback summary');
    const feedback = await aggregateFeedbackDistribution();
    addTable(
      feedbackSheet,
      ['Rating', 'Count'],
      feedback.map(row => [row.label ?? '—', row.count ?? 0])
    );

    // Top destinations
    const destSheet = workbook.addWorksheet('Top destinations');
    const dests = await aggregateTopDestinations({ limit: 20 });
    addTable(
      destSheet,
      ['Establishment', 'Municipality', 'Reviews'],
      dests.map(row => [row.name ?? '—', row.municipality_id ?? 'Province-wide', row.rating_count ?? 0])
    );

    // Heatmap points
    const heatSheet = workbook.addWorksheet('Heatmap points');
    const heatmap = await aggregateHeatmapPoints();
    addTable(
      heatSheet,
      ['Latitude', 'Longitude', 'Weight', 'Municipality'],
      heatmap.map(point => [
        point.lat ?? '—',
        point.lng ?? '—',
        point.weight ?? 0,
        point.municipality ?? '—',
      ])
    );

    res.setHeader('Content-Disposition', 'attachment; filename=bto-analytics.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};


export const exportAnalyticsPdf = async (req, res, next) => {
  try {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('BTO Analytics Summary', 14, 20);

    const trends = await aggregateVisitorTrends('province');
    autoTable(doc, {
      startY: 30,
      head: [['Month', 'Trips', 'Tourists']],
      body: trends.map(row => [row.month, row.trips, row.touristCount]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Visitor nationalities', 14, 20);
    const nationalities = await aggregateNationalityBreakdown(12);
    autoTable(doc, {
      startY: 30,
      head: [['Nationality', 'Tourists (unique)']],
      body: nationalities.map(row => [row.nationality ?? '—', row.count ?? 0]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Feedback summary per establishment', 14, 20);
    const feedbackRows = await loadFeedbackSummaries();
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
    const spmFlows = await aggregateSequentialPatterns({ limit: 20 });
    autoTable(doc, {
      startY: 30,
      head: [['From', 'To', 'Visits', 'Confidence', 'Lift']],
      body: spmFlows.map(flow => [
        flow.from?.name ?? flow.from?.id ?? '—',
        flow.to?.name ?? flow.to?.id ?? '—',
        flow.visits ?? 0,
        flow.confidence ?? '—',
        flow.lift ?? '—',
      ]),
    });
    const lastY = doc.lastAutoTable?.finalY ?? 40;
    const { sequence, conclusion } = buildSpmConclusion(spmFlows);
    doc.text(`Sequence: ${sequence}`, 14, lastY + 10);
    doc.text(`Conclusion: ${conclusion}`, 14, lastY + 20);

    // SEND PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Disposition', 'attachment; filename=bto-analytics.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


