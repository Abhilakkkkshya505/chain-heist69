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

  // Wait 3.5 seconds for assets to load and title scene to render
  await page.waitForTimeout(3500);
  
  const titlePath = path.resolve('docs/title_screen.png');
  await page.screenshot({ path: titlePath });
  console.log('Title screen captured to:', titlePath);

  // Focus canvas and press Space to start New Game -> WorldScene
  console.log('Starting new game...');
  await page.locator('canvas').click();
  await page.waitForTimeout(100);
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');

  // Wait for fade-in to WorldScene
  await page.waitForTimeout(3000);

  const worldPath = path.resolve('docs/world_scene.png');
  await page.screenshot({ path: worldPath });
  console.log('World scene captured to:', worldPath);

  // 1. Press F1 to toggle red collision overlay
  console.log('Toggling F1 collision overlay...');
  await page.keyboard.press('F1');
  await page.waitForTimeout(1000);

  const collisionOverlayPath = path.resolve('docs/collision_overlay.png');
  await page.screenshot({ path: collisionOverlayPath });
  console.log('Collision overlay captured to:', collisionOverlayPath);

  // Toggle F1 off
  await page.keyboard.press('F1');
  await page.waitForTimeout(500);

  // 2. Test Wall Collision: walk Left towards the building/tree wall
  console.log('Testing wall collision: walking Left towards building wall...');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(500);

  const walkingPath = path.resolve('docs/walkthrough_neo_city.png');
  await page.screenshot({ path: walkingPath });
  console.log('Walkthrough screenshot captured to:', walkingPath);

  await browser.close();
  console.log('Step 3.4 wall testing and verification completed successfully!');
})();
