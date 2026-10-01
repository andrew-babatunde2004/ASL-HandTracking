import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('camera starts, actual model loads, frames process, controls work, and stop releases tracks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tracking studio.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/studio-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('.engine-status')).toContainText('Tracking enabled', { timeout: 40000 });
  await expect(page.getByText('Camera live', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.metrics>div').nth(2).innerText()).not.toContain('—');
  await page.getByRole('button', { name: 'Mirror', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mirror', exact: true })).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button', { name: 'Landmarks', exact: true }).click();
  await expect(page.locator('canvas')).toHaveClass('overlay-hidden');
  await page.evaluate(() => { (window as any).__tracks = (document.querySelector('video')!.srcObject as MediaStream).getTracks(); });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__tracks.every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByText('Camera off', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('camera denial has actionable recovery and mobile layout does not overflow', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Camera permission was denied');
  await expect(page.getByRole('button', { name: 'Start camera', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/studio-mobile.png', fullPage: true });
});

test('actual model detects a hand, labeled samples persist and export, and deletion is explicit', async ({ page }) => {
  await page.goto('/');
  // Feed a static fixture through the real worker; no inference results are mocked.
  const imageBytes = readFileSync('tests/fixtures/hands.jpg').toString('base64');
  await page.evaluate(async base64 => {
    const blob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
    const stream = canvas.captureStream(15);
    (window as any).__fixture = canvas;
    navigator.mediaDevices.getUserMedia = async () => stream;
    setInterval(() => canvas.getContext('2d')!.fillRect(0,0,1,1), 65);
  }, imageBytes);
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('.engine-status')).toContainText('Tracking enabled', { timeout: 40000 });
  await expect(page.locator('.hand-slot.detected').first()).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Sample label', { exact: true }).fill('Club practice');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: /Save recording · 1\./ })).toBeVisible();
  await page.getByRole('button', { name: /Save recording/ }).click();
  await expect(page.getByRole('status')).toContainText('Saved “Club practice”');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /My library/ }).click();
  await expect(page.getByRole('button', { name: /Club practice.*frames/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Club practice' }).click();
  const artifact = await download;
  const file = await artifact.path();
  const recording = JSON.parse(readFileSync(file!, 'utf8'));
  expect(recording.frames.length).toBeGreaterThan(1);
  expect(recording.frames[0].hands[0].landmarks).toHaveLength(21);
  expect(recording.frames[0].hands[0].worldLandmarks).toHaveLength(21);
  expect(recording.source.mirrored).toBe(false);
  expect(recording.frames[0].timestampMs).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Delete Club practice' }).click();
  await expect(page.getByRole('button', { name: 'Delete sample', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete sample', exact: true }).click();
  await expect(page.getByText('Your first sample starts here.')).toBeVisible();
});
