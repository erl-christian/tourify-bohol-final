import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  aggregateVisitorTrends,
  aggregateTopDestinations,
  aggregateHeatmapPoints,
  resolveMunicipalityForLgu,
  aggregateFeedbackDistribution,
} from './analyticsControllers.js';

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

    // Municipal arrivals
    const trendSheet = workbook.addWorksheet('Municipal arrivals');
    const trends = await aggregateVisitorTrends('municipality', municipalityId);
    addTable(
      trendSheet,
      ['Month', 'Trips', 'Tourists'],
      trends.map(row => [row.month, row.trips, row.touristCount])
    );

    // Feedback summary
    const feedbackSheet = workbook.addWorksheet('Feedback summary');
    const feedback = await aggregateFeedbackDistribution(municipalityId);
    addTable(
      feedbackSheet,
      ['Rating', 'Count'],
      feedback.map(row => [row.label ?? '—', row.count ?? 0])
    );

    // Top destinations
    const destSheet = workbook.addWorksheet('Top destinations');
    const dests = await aggregateTopDestinations({
      scope: 'municipality',
      municipalityId,
      limit: 20,
    });
    addTable(
      destSheet,
      ['Establishment', 'Reviews'],
      dests.map(row => [row.name ?? '—', row.rating_count ?? 0])
    );

    // Heatmap points
    const heatSheet = workbook.addWorksheet('Heatmap points');
    const heatmap = await aggregateHeatmapPoints(municipalityId);
    addTable(
      heatSheet,
      ['Latitude', 'Longitude', 'Weight'],
      heatmap.map(point => [point.lat ?? '—', point.lng ?? '—', point.weight ?? 0])
    );

    res.setHeader('Content-Disposition', 'attachment; filename=lgu-analytics.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
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
    doc.text('Top Destinations', 14, 20);
    const dests = await aggregateTopDestinations({
      scope: 'municipality',
      municipalityId,
      limit: 20,
    });
    autoTable(doc, {
      startY: 26,
      head: [['Establishment', 'Reviews']],
      body: dests.map(row => [row.name ?? '—', row.rating_count ?? 0]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Feedback summary (ratings)', 14, 20);
    const feedback = await aggregateFeedbackDistribution(municipalityId);
    autoTable(doc, {
      startY: 26,
      head: [['Rating', 'Count']],
      body: feedback.map(row => [row.label ?? '—', row.count ?? 0]),
    });

    doc.addPage();
    const heatmap = await aggregateHeatmapPoints(municipalityId);
    autoTable(doc, {
      startY: 20,
      head: [['Latitude', 'Longitude', 'Weight']],
      body: heatmap.map(point => [point.lat ?? '—', point.lng ?? '—', point.weight ?? 0]),
    });

    const pdf = doc.output();
    res.setHeader('Content-Disposition', 'attachment; filename=lgu-analytics.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdf, 'binary'));
  } catch (err) {
    next(err);
  }
};


