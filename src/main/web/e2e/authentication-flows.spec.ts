import { test, type Page } from "@playwright/test";

import { apiRequest, expect, visitConsole } from "./fixtures";

type Flow = { id: number; alias: string };
type FlowPage = { content: Flow[] };
type FlowDetail = { subFlows: Flow[] };

const expectSavedNotification = (page: Page) =>
  expect(
    page
      .getByRole("status")
      .filter({ hasText: /^Authentication flow saved\.$/ })
      .last(),
  ).toBeVisible();

test.describe("authentication flows", () => {
  test("creates a flow, sub-flow, and execution from the administration console", async ({
    page,
    request,
  }) => {
    const suffix = Date.now();
    const alias = `e2e-${suffix}`;
    const flowName = `E2E flow ${suffix}`;
    let flowId: number | undefined;

    try {
      await visitConsole(page, "admin", "/authentication/flows");
      await expect(page.getByRole("heading", { name: /Authentication flows/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Browser.*Built-in browser/i })).toBeVisible();

      await page
        .getByRole("button", { name: /^Create flow$/i })
        .first()
        .click();
      await page.getByLabel("Alias").fill(alias);
      await page.getByLabel("Name").fill(flowName);
      await page.getByLabel("Description").fill("Created by the browser E2E test");
      await page.getByLabel("Order").first().fill("10");
      await page
        .getByRole("button", { name: /^Create flow$/i })
        .last()
        .click();
      await expectSavedNotification(page);

      await page.getByRole("button", { name: new RegExp(flowName) }).click();
      await expect(page.getByRole("heading", { name: /Flow graph/i })).toBeVisible();

      await page.getByRole("button", { name: /Add sub-flow/i }).click();
      await page.locator("#authentication-flow-alias").last().fill(`${alias}-sub`);
      await page.locator("#authentication-flow-name").last().fill("E2E sub-flow");
      await page.locator("#authentication-flow-requirement").last().selectOption("REQUIRED");
      await page.locator("#authentication-flow-priority").last().fill("20");
      await page
        .getByRole("button", { name: /Add sub-flow/i })
        .last()
        .click();
      await expectSavedNotification(page);
      await expect(page.getByText("E2E sub-flow", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: /^Executions$/i }).click();
      await page.getByRole("button", { name: /Add execution/i }).click();
      await page.getByLabel("Name").last().fill("E2E password execution");
      await page.getByLabel("Order").last().fill("30");
      await page
        .getByRole("button", { name: /Add execution/i })
        .last()
        .click();
      await expect(page.getByText("E2E password execution", { exact: true })).toBeVisible();
      await expectSavedNotification(page);

      const response = await apiRequest<FlowPage>(
        request,
        page,
        "/api/admin/authentication/flows?size=100&sort=name,asc",
      );
      flowId = response.ok()
        ? (await response.json()).content.find((flow) => flow.alias === alias)?.id
        : undefined;
    } finally {
      if (flowId !== undefined) {
        const detailResponse = await apiRequest<FlowDetail>(
          request,
          page,
          `/api/admin/authentication/flows/${flowId}`,
        );
        if (detailResponse.ok()) {
          const detail = await detailResponse.json();
          for (const subFlow of detail.subFlows) {
            await apiRequest(request, page, `/api/admin/authentication/flows/${subFlow.id}`, {
              method: "DELETE",
            });
          }
        }
        await apiRequest(request, page, `/api/admin/authentication/flows/${flowId}`, {
          method: "DELETE",
        });
      }
    }
  });
});
