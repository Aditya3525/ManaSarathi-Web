import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/user-login');
  await page.waitForTimeout(5000);
  const html = await page.evaluate(() => document.getElementById('root')?.innerHTML);
  fs.writeFileSync('debug-html.txt', html || '');
  await browser.close();
})();
