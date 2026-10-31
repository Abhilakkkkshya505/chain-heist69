import { chromium } from 'playwright';
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to game on http://localhost:5174 ...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
  
  // Clear localStorage to ensure fresh start on neo-city
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Wait 4 seconds for assets to load and title scene to render
  await page.waitForTimeout(4000);
  
  const titlePath = path.resolve('docs/title_screen.png');
  await page.screenshot({ path: titlePath });
  console.log('Title screen captured to:', titlePath);

  // Press SPACE to start new game -> WorldScene
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const worldPath = path.resolve('docs/world_scene.png');
  await page.screenshot({ path: worldPath });
  console.log('World scene captured to:', worldPath);

  // Test F1 to toggle collision overlay
  console.log('Pressing F1 to toggle red collision overlay...');
  await page.keyboard.press('F1');
  await page.waitForTimeout(1000);

  const collisionOverlayPath = path.resolve('docs/collision_overlay.png');
  await page.screenshot({ path: collisionOverlayPath });
  console.log('Collision overlay captured to:', collisionOverlayPath);

  // Toggle collision overlay off
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);

  // Walk around the map with arrow keys
  console.log('Walking around Neo-City...');
  // Walk Left
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(350);
  }
  // Walk Down
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(350);
  }
  // Walk Right
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(350);
  }
  // Walk Up
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(350);
  }

  await page.waitForTimeout(1000);
  const walkingPath = path.resolve('docs/walkthrough_neo_city.png');
  await page.screenshot({ path: walkingPath });
  console.log('Walking screenshot captured to:', walkingPath);

  await browser.close();
  console.log('Playwright verification completed successfully!');
})();
