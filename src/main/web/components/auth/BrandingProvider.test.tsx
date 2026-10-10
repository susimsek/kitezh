import { act, render, screen, waitFor } from "@testing-library/react";
import { BrandingProvider, useBranding } from "./BrandingProvider";

const validBranding = {
  applicationName: "Kitezh",
  logoPath: "/brand/custom.svg",
  faviconPath: "/brand/custom.ico",
  appleTouchIconPath: "/brand/custom-touch.png",
  primaryColor: "#112233",
  accentColor: "#445566",
  backgroundColor: "#778899",
};

function BrandingName() {
  const branding = useBranding();
  return <span>{branding.applicationName || "default"}</span>;
}

function renderBranding() {
  return render(
    <BrandingProvider>
      <BrandingName />
    </BrandingProvider>,
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-bs-theme");
  document.documentElement.style.cssText = "";
  document.head.innerHTML = "";
});

it("loads valid branding, applies theme variables, and follows dark-mode changes", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => validBranding,
  }) as never;
  const view = renderBranding();

  expect(await screen.findByText("Kitezh")).toBeVisible();
  expect(document.documentElement.style.getPropertyValue("--console-brand-primary")).toBe(
    "#112233",
  );
  const favicon = document.querySelector<HTMLLinkElement>("link[data-branding-favicon]");
  expect(favicon?.href).toContain("/brand/favicon-light.png");

  act(() => document.documentElement.setAttribute("data-bs-theme", "dark"));
  await waitFor(() => expect(favicon?.href).toContain("/brand/favicon-dark.png"));

  view.unmount();
  global.fetch = originalFetch;
});

it("ignores invalid branding and reloads when branding is updated", async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...validBranding, primaryColor: "red" }),
    })
    .mockResolvedValueOnce({ ok: false, json: async () => validBranding })
    .mockResolvedValueOnce({ ok: true, json: async () => validBranding });
  global.fetch = fetchMock as never;
  const view = renderBranding();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.getByText("default")).toBeVisible();
  expect(document.documentElement.style.getPropertyValue("--console-brand-primary")).toBe(
    "#0d6efd",
  );
  act(() => window.dispatchEvent(new Event("branding-updated")));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  act(() => window.dispatchEvent(new Event("branding-updated")));
  expect(await screen.findByText("Kitezh")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(3);

  view.unmount();
  global.fetch = originalFetch;
});
it("keeps default branding if the request rejects", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as never;
  renderBranding();

  expect(await screen.findByText("default")).toBeVisible();
  global.fetch = originalFetch;
});
