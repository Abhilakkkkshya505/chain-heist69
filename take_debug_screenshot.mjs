import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Wait for TitleScene
  await page.waitForTimeout(3000);

  // Press D to open DebugAssetsScene
  console.log('Pressing D to open Debug Assets Gallery...');
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(1500);

  const debugPath = path.resolve('docs/debug_assets_scene.png');
  await page.screenshot({ path: debugPath });
  console.log('Debug assets scene captured to:', debugPath);

  await browser.close();
})();

