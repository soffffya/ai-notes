import { expect, test } from '@playwright/test';

test.describe('AI Notes smoke flow', () => {
  test('registers user, creates note, deletes it and restores with undo', async ({ page }) => {
    const email = `sofi+${Date.now()}@example.com`;
    const password = 'password123';
    const title = `Smoke note ${Date.now()}`;
    const content = 'This is a stable smoke-test note that should remain a plain note.';

    await page.addInitScript(() => {
      window.localStorage.setItem('i18nextLng', 'en');
    });

    await page.goto('/auth');

    await page.getByRole('tab', { name: 'Register' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.getByRole('button', { name: /New/i }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Note text').fill(content);
    await page.getByRole('button', { name: 'Create note' }).click();

    await expect(page.getByText('Note created')).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Note will be deleted')).toBeVisible();

    await page.getByRole('button', { name: /Undo/ }).click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('button', { name: /All notes/i })).toBeVisible();
  });
});
