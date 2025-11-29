import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  aggregateVisitorTrends,
  aggregateMunicipalityArrivals,
  aggregateTopDestinations,
  aggregateHeatmapPoints,
  aggregateFeedbackDistribution,
} from './analyticsControllers.js';

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
    doc.text('Municipality Arrivals', 14, 20);
    const muni = await aggregateMunicipalityArrivals(20);
    autoTable(doc, {
      startY: 30,
      head: [['Municipality', 'Total arrivals']],
      body: muni.map(row => [row.municipality ?? row.municipality_id, row.total]),
    });

    doc.addPage();
    autoTable(doc, {
      startY: 30,
      head: [['Municipality', 'Date', 'Source', 'Visits']],
      body: muni
        .flatMap(row =>
          (row.records ?? []).map(record => [
            row.municipality ?? row.municipality_id,
            record.date,
            record.source,
            record.visits,
          ])
        )
        .slice(0, 500),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Top Destinations', 14, 20);
    const dests = await aggregateTopDestinations({ limit: 20 });
    autoTable(doc, {
      startY: 30,
      head: [['Establishment', 'Municipality', 'Reviews']],
      body: dests.map(row => [row.name ?? '—', row.municipality_id ?? 'Province-wide', row.rating_count ?? 0]),
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text('Feedback summary (ratings)', 14, 20);
    const feedback = await aggregateFeedbackDistribution();
    autoTable(doc, {
      startY: 30,
      head: [['Rating', 'Count']],
      body: feedback.map(row => [row.label ?? '—', row.count ?? 0]),
    });


    doc.addPage();
    doc.setFontSize(12);
    doc.text('Heatmap Points', 14, 20);
    const heatmap = await aggregateHeatmapPoints();
    autoTable(doc, {
      startY: 30,
      head: [['Latitude', 'Longitude', 'Weight', 'Municipality']],
      body: heatmap.map(point => [
        point.lat ?? '—',
        point.lng ?? '—',
        point.weight ?? 0,
        point.municipality ?? '—',
      ]),
    });

    const pdf = doc.output();
    res.setHeader('Content-Disposition', 'attachment; filename=bto-analytics.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdf, 'binary'));
  } catch (err) {
    next(err);
  }
};

