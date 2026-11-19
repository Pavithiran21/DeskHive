const { test, expect } = require('@playwright/test');
const { book, json, loginAs, newOffice } = require('../../helpers/api');
const { waitForMail } = require('../../helpers/mail');
const { claimEmployee } = require('../../helpers/pool');

async function logIn(page, email, password = process.env.E2E_PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('Log in is the start page; an Employee lands on Find a space', async ({ page }) => {
  await logIn(page, claimEmployee());
  await expect(page.getByRole('heading', { name: 'Find a space' })).toBeAttached();
});

test('an Employee sees their booking in My bookings and opens it', async ({ page, request }) => {
  const { desks } = await newOffice(request, { desks: 1 });
  const email = claimEmployee();
  const booking = await json(await book(await loginAs(request, email), desks[0].id), 201);

  await logIn(page, email);
  await page.goto('/bookings');
  await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  await page.goto(`/bookings/${booking.id}`);
  await expect(page.getByText(booking.space.office).first()).toBeVisible();
});

test('an Employee is shown "This page is for admins" on the admin pages', async ({ page }) => {
  await logIn(page, claimEmployee());
  await page.goto('/admin/spaces');
  await expect(page.getByRole('heading', { name: 'This page is for admins' })).toBeVisible();
});

test('the demo page logs in as the Admin, who reaches Spaces and seats', async ({ page }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Try DeskHive' })).toBeVisible();
  await page.getByRole('button', { name: /Log in as Admin/ }).click();
  await expect(page).not.toHaveURL(/\/demo$/);
  await page.goto('/admin/spaces');
  await expect(page.getByRole('heading', { name: 'Spaces and seats' })).toBeVisible();
});

test('forgot password: the emailed link sets a new password that then logs in', async ({ page }) => {
  test.setTimeout(90_000);
  const email = claimEmployee();
  await page.goto('/forgot-password');
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();

  const mail = await waitForMail({ to: email, subject: /Reset your DeskHive password/ });
  const link = mail.html.match(/href="([^"]*\/reset-password\?token=[^"]+)"/)?.[1];
  expect(link, 'reset link in the email').toBeTruthy();
  const { pathname, search } = new URL(link.replace(/&amp;/g, '&'));
  await page.goto(pathname + search);

  const newPassword = 'Fresh-password-42';
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(newPassword);
  await page.getByRole('textbox', { name: 'Confirm new password' }).fill(newPassword);
  await page.getByRole('button', { name: 'Save password' }).click();
  // Wait for the success toast, not for the button to vanish: while the request is in flight
  // the button reads "Saving…", so it would vanish before the new password is stored.
  await expect(page.getByText('Password saved. Log in with your new password.')).toBeVisible();

  await logIn(page, email, newPassword);
});
