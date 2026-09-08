import { expect, type Page } from "@playwright/test";

import {
  ADMIN_EMAIL,
  EMPLOYEE_EMAIL,
  EMPLOYEE_PHONE,
  OTHER_EMPLOYEE_EMAIL,
  E2E_PASSWORD,
} from "./db";

async function fillLogin(page: Page, identifier: string) {
  await page.goto("/login");

  const identifierInput = page
    .locator('input[name="identifier"], input[name="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first();

  await expect(identifierInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await identifierInput.fill(identifier);
  await passwordInput.fill(E2E_PASSWORD);

  const button = page
    .getByRole("button", {
      name: /connexion|se connecter|connecter|login/i,
    })
    .first();

  await expect(button).toBeVisible();
  await button.click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, {
    timeout: 15_000,
  });
}

export function loginAsAdmin(page: Page) {
  return fillLogin(page, ADMIN_EMAIL);
}

export function loginAsEmployee(page: Page) {
  return fillLogin(page, EMPLOYEE_EMAIL);
}

export function loginAsEmployeeByPhone(page: Page) {
  return fillLogin(page, EMPLOYEE_PHONE);
}

export function loginAsSara(page: Page) {
  return fillLogin(page, OTHER_EMPLOYEE_EMAIL);
}
