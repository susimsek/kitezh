import i18next from "i18next";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "@/routing/navigation";

import { AdminAuthorizationCallback } from "./AdminAuthorizationCallback";
import { useAdminAuth } from "./AdminAuthProvider";

jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: jest.fn(),
}));
jest.mock("./AdminAuthProvider", () => ({ useAdminAuth: jest.fn() }));

const mockRouter = useRouter as jest.Mock;
const mockUseAdminAuth = useAdminAuth as jest.Mock;

describe("AdminAuthorizationCallback", () => {
  const replace = jest.fn();
  const completeAuthorization = jest.fn();

  beforeEach(() => {
    replace.mockReset();
    completeAuthorization.mockReset();
    window.history.replaceState({}, "", "/admin/callback");
    mockRouter.mockReturnValue({ replace });
    mockUseAdminAuth.mockReturnValue({ completeAuthorization });
  });

  it("shows an error for an incomplete response instead of starting another transaction", async () => {
    render(<AdminAuthorizationCallback />);

    expect(
      await screen.findByText("The administration session could not be established."),
    ).toBeVisible();
    expect(completeAuthorization).not.toHaveBeenCalled();
  });

  it("shows an error when the provider returns access_denied", async () => {
    window.history.replaceState({}, "", "/admin/callback#error=access_denied&state=state");
    render(<AdminAuthorizationCallback />);

    expect(
      await screen.findByText("The administration session could not be established."),
    ).toBeVisible();
    expect(completeAuthorization).not.toHaveBeenCalled();
  });

  it("completes a valid response and redirects to the saved location", async () => {
    window.history.replaceState({}, "", "/admin/callback#code=code&state=state");
    completeAuthorization.mockResolvedValue("/admin/clients");
    render(<AdminAuthorizationCallback />);

    await waitFor(() => expect(completeAuthorization).toHaveBeenCalledWith("code", "state"));
    expect(replace).toHaveBeenCalledWith("/admin/clients");
  });

  it("shows an error when the token exchange fails", async () => {
    window.history.replaceState({}, "", "/admin/callback#code=code&state=state");
    completeAuthorization.mockRejectedValue(new Error("invalid token"));
    await i18next.changeLanguage("tr");
    render(<AdminAuthorizationCallback />);

    expect(await screen.findByText("Yönetim oturumu oluşturulamadı.")).toBeVisible();
  });
});
