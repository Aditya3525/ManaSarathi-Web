import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'test-id', email: 'test@example.com', name: 'Test User' } }) });
  });
  await page.route('**/api/dashboard/unified*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { summary: { user: { id: 'test-id', name: 'Test' }, weeklyProgress: { currentStreak: 5 } }, history: [], recommendations: [] } }) });
  });
  await page.route('**/api/habits', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/practices/recommended*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/users/admin/check', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: false }) });
  });
  
  await context.addInitScript(() => {
    window.localStorage.setItem('token', 'fake-token');
  });
  await page.goto('http://localhost:3001/dashboard');
  await page.waitForTimeout(5000);
  const html = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync('dashboard-render.html', html || '');
  await page.screenshot({ path: 'dashboard-render.png' });
  await browser.close();
})();
