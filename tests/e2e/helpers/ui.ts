import { expect, type Locator, type Page } from "@playwright/test";

export async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 2;
  });
  expect(hasOverflow).toBe(false);
}

export function serviceCard(page: Page, serviceName: string) {
  return page.locator("article").filter({ hasText: serviceName }).first();
}

export function organizationCard(page: Page, serviceName: string) {
  return page.locator("article").filter({ hasText: serviceName }).first();
}

export async function expectEnabledAndClick(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.click();
}

export async function acceptNextDialog(page: Page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}
