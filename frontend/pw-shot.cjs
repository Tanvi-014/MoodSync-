const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  // Pre-set localStorage before page load
  await ctx.addInitScript(() => {
    localStorage.setItem('sp_denied', '1');
  });
  
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/tmp/ob-welcome.png' });
  console.log('welcome done');
  
  await page.click('.ms-welcome-cta');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/tmp/ob-mood.png' });
  console.log('mood done');
  
  // click "Stressed" (3rd pill)
  await page.click('.ms-onboard-pill:nth-child(3)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/tmp/ob-mood-sel.png' });
  console.log('mood-sel done');
  
  await page.click('.ms-onboard-cta');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/tmp/ob-setup.png' });
  console.log('setup done');
  
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
