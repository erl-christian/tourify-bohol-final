const MONTH_RE = /^\d{4}-\d{2}$/;

const getTodayMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getMonthBoundsFromTrend = (trendRows = []) => {
  const months = (Array.isArray(trendRows) ? trendRows : [])
    .map((row) => row?.month)
    .filter((month) => MONTH_RE.test(month))
    .sort();

  if (!months.length) return null;

  const minMonth = months[0];
  const latestDataMonth = months[months.length - 1];
  const todayMonth = getTodayMonth();
  const maxMonth = latestDataMonth < todayMonth ? latestDataMonth : todayMonth;

  if (minMonth > maxMonth) return null;
  return { minMonth, maxMonth };
};

export const clampMonth = (value, bounds) => {
  if (!value || !bounds) return value;
  if (value < bounds.minMonth) return bounds.minMonth;
  if (value > bounds.maxMonth) return bounds.maxMonth;
  return value;
};

export const normalizeMonthRange = (range, bounds) => {
  if (!bounds) {
    return { error: 'No analytics data available yet for report export.' };
  }

  const from = range?.from || bounds.minMonth;
  const to = range?.to || bounds.maxMonth;

  if (from < bounds.minMonth || to > bounds.maxMonth) {
    return {
      error: `Select a month range between ${bounds.minMonth} and ${bounds.maxMonth}.`,
    };
  }

  if (from > to) {
    return { error: 'From month cannot be later than To month.' };
  }

  return { from, to };
};

export const monthToDateStart = (month) => `${month}-01`;

export const monthToDateEnd = (month) => {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
};
