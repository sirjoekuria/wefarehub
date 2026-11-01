import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

// Run only against the explicitly labeled local demo, never a real association.
test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  test.skip(!(await page.getByText('Demo workspace', { exact: true }).isVisible()), 'These mutation tests require the local demo.');
});
async function navigate(page: import('@playwright/test').Page, name: string | RegExp) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name }).click();
}
const NairobiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

test('dashboard, chart, responsive navigation and payment guide', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByText('Total contributions', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent payments' })).toBeVisible();
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  await expect(page.getByText('in the last 30 days', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '14 days', exact: true }).click();
  await expect(page.getByText('in the last 14 days', { exact: true })).toBeVisible();
  await page.waitForTimeout(850);
  await expect(page.getByText('KES 0', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/stanriders-dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Payment guide', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stanriders-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigate(page, 'Members');
  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('pickup point creation, editing, deactivation and reactivation', async ({ page }) => {
  const code = `QT${Date.now().toString().slice(-6)}`;
  await navigate(page, 'Pickup Points');
  await page.getByRole('button', { name: 'Add pickup point', exact: true }).click();
  await page.locator('input[name="code"]').fill(code);
  await page.locator('input[name="name"]').fill(`QA Pickup ${code}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Add pickup point' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Search name or pickup code…').fill(code);
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${code}`, exact: true }).click();
  await page.locator('input[name="name"]').fill(`QA Updated ${code}`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: `Deactivate ${code}`, exact: true }).click();
  await page.getByRole('button', { name: 'Deactivate point', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Inactive', exact: true }).click();
  await expect(page.getByText(`QA Updated ${code}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${code}`, exact: true }).click();
  await page.locator('select[name="is_active"]').selectOption('on');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('member creation and CSV validation, import and duplicate preview', async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);
  await navigate(page, 'Members');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.locator('input[name="full_name"]').fill(`QA Rider ${stamp}`);
  const pickup = page.locator('select[name="pickup_point_id"]');
  await pickup.selectOption(await pickup.locator('option').nth(1).getAttribute('value') || '');
  await page.locator('input[name="phone"]').fill('+254712345678');
  await page.locator('input[name="qr_number"]').fill(`8${stamp}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Search name, phone or QR number…').fill(`QA Rider ${stamp}`);
  await expect(page.getByRole('cell', { name: `QA Rider ${stamp}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  const invalid = Buffer.from('full_name,phone,qr_number,pickup_code\nBad Phone,123,001,KM001\nUnknown Point,0712345678,990,NOPOINT\n');
  await page.locator('input[type="file"]').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: invalid });
  await expect(page.getByText('Invalid Kenyan phone', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('QR already exists at this pickup point', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Unknown pickup code', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 2 members', exact: true })).toBeDisabled();
  const valid = Buffer.from(`full_name,phone,qr_number,pickup_code\nQA CSV One ${stamp},0712345678,6${stamp},KM001\nQA CSV Two ${stamp},0112345678,7${stamp},KM001\n`);
  await page.locator('input[type="file"]').setInputFiles({ name: 'valid.csv', mimeType: 'text/csv', buffer: valid });
  await expect(page.getByText('Ready to import').first()).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 members', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByPlaceholder('Search name, phone or QR number…').fill(`QA CSV One ${stamp}`);
  await expect(page.getByRole('cell', { name: `QA CSV One ${stamp}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'duplicate.csv', mimeType: 'text/csv', buffer: valid });
  await expect(page.getByText('2 with errors', { exact: true })).toBeVisible();
});

test('unmatched payment assignment and visible filters', async ({ page }) => {
  await navigate(page, /^Payments/);
  await page.getByRole('tab', { name: /^Unmatched/ }).click();
  await expect(page.getByText('A payment without a match isn’t a lost payment.')).toBeVisible();
  await page.getByRole('button', { name: 'Assign member' }).first().click();
  await page.getByPlaceholder('Search member name, phone or QR number…').fill('John');
  await expect(page.getByRole('dialog').getByText('John', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('radio').first()).toBeEnabled();
  await page.getByRole('dialog').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Confirm assignment' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/assigned to John/)).toBeVisible();
  await page.getByRole('tab', { name: 'All payments' }).click();
  await page.getByLabel('Payments from date').fill(NairobiToday());
  await page.getByLabel('Payments to date').fill(NairobiToday());
  await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByLabel('Payments from date')).toHaveValue('');
});

test('A4 PDF and all-pickup-points ZIP downloads', async ({ page }) => {
  await navigate(page, 'Reports');
  await expect(page.getByRole('heading', { name: 'Contribution report', exact: true })).toBeVisible();
  const pdfEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const pdf = await pdfEvent; await pdf.saveAs('/tmp/stanriders-report.pdf');
  expect((await readFile('/tmp/stanriders-report.pdf')).subarray(0, 4).toString()).toBe('%PDF');
  await page.getByRole('button', { name: 'Download all pickup points' }).click();
  const zipEvent = page.waitForEvent('download', { timeout: 120000 });
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).click();
  const download = await zipEvent; await download.saveAs('/tmp/stanriders-reports.zip');
  const zip = await JSZip.loadAsync(await readFile('/tmp/stanriders-reports.zip'));
  expect(Object.keys(zip.files).filter(name => name.endsWith('.pdf')).length).toBeGreaterThanOrEqual(108);
  await page.screenshot({ path: 'test-results/stanriders-reports.png', fullPage: true });
});

test('demo opens directly without login, even with an old logout cookie', async ({ page, context }) => {
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Demo access — no login required')).toBeVisible();
  await context.addCookies([{ name: 'rw_logged_out', value: '1', url: new URL(page.url()).origin }]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toHaveCount(0);
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
});
