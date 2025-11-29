import puppeteer from 'puppeteer';

const defaultAdminSelectors = [
  '#province-arrivals-card',
  '#municipal-arrivals-card',
  '#top-destinations-card',
  '#sankey-card',
  '#heatmap-card',
];

export async function captureAnalyticsScreenshots({
  url,
  token,
  selectors = defaultAdminSelectors,
  role = 'bto_admin',
  waitForSelector,
}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument((accessToken, sessionRole) => {
    if (accessToken) window.sessionStorage.setItem('accessToken', accessToken);
    if (sessionRole) window.sessionStorage.setItem('mockRole', sessionRole);
  }, token, role);

  await page.goto(url, { waitUntil: 'networkidle0' });

  const selectorToWait = waitForSelector || selectors[0];
  if (selectorToWait) {
    await page.waitForSelector(selectorToWait, { timeout: 15000 });
  }

  const screenshots = [];
  for (const selector of selectors) {
    if (!selector) continue;
    const element = await page.$(selector);
    if (!element) continue;
    const buffer = await element.screenshot({ type: 'png' });
    screenshots.push({ selector, buffer });
  }

  await browser.close();
  return screenshots;
}
