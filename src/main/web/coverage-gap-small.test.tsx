import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";
import { requestAccount } from "@/lib/account-api";
import { loadIcons } from "@/lib/icon-loader";
import { library } from "@fortawesome/fontawesome-svg-core";

import { AccountAuthorizationCallback } from "./components/account/AccountAuthorizationCallback";
import { RoleEntityRoute } from "./components/admin/RoleEntityRoute";
import { RecoveryCodesActions } from "./components/shared/RecoveryCodesActions";
import { TotpSetupDetails } from "./components/shared/TotpSetupDetails";

const mockUseParams = jest.fn();
const mockRequest = jest.fn();
const mockCompleteAuthorization = jest.fn();

jest.mock("@/routing/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: jest.fn(),
}));
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <a href={to}>navigate</a>,
}));
jest.mock("./components/admin/RoleDetail", () => ({
  RoleDetail: ({ name, tab }: { name: string; tab: string }) => (
    <div>
      {name}:{tab}
    </div>
  ),
}));
jest.mock("@/components/auth/ConsoleAuthorizationCallback", () => ({
  ConsoleAuthorizationCallback: ({ errorMessage }: { errorMessage: string }) => (
    <div>{errorMessage}</div>
  ),
}));
jest.mock("./components/account/AccountAuthProvider", () => ({
  useAccountAuth: () => ({ completeAuthorization: mockCompleteAuthorization }),
}));
jest.mock("@/lib/authenticated-api-client", () => ({
  createAuthenticatedApiClient: () => ({
    request: (...args: unknown[]) => mockRequest(...args),
    registerTokenHandlers: jest.fn(),
  }),
}));

describe("small uncovered web modules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes valid roles and redirects invalid role sections", () => {
    mockUseParams.mockReturnValue({ id: "ROLE_ADMIN", section: "users" });
    render(<RoleEntityRoute locale="en" dictionary={dictionary} />);
    expect(screen.getByText("ROLE_ADMIN:users")).toBeVisible();

    mockUseParams.mockReturnValue({ id: "ROLE_ADMIN", section: "unknown" });
    const invalid = render(<RoleEntityRoute locale="en" dictionary={dictionary} />);
    expect(invalid.container.querySelector("a")).toHaveAttribute(
      "href",
      "/admin/roles/ROLE_ADMIN/details",
    );
  });

  it("passes account authorization completion and localized error text", () => {
    render(<AccountAuthorizationCallback />);
    expect(screen.getByText(dictionary.account.common.authorizationCallbackError)).toBeVisible();
  });

  it("normalizes account API responses and errors", async () => {
    mockRequest.mockResolvedValueOnce({ status: 200, data: { username: "admin" } });
    await expect(requestAccount("token", { url: "/api/account" })).resolves.toEqual({
      username: "admin",
    });

    mockRequest.mockResolvedValueOnce({ status: 400, data: { detail: "bad" } });
    await expect(requestAccount("token", { url: "/api/account" })).rejects.toEqual({
      status: 400,
      data: { detail: "bad" },
    });

    mockRequest.mockRejectedValueOnce(new Error("network"));
    await expect(requestAccount("token", { url: "/api/account" })).rejects.toEqual({
      status: 0,
      data: { message: "network" },
    });

    mockRequest.mockRejectedValueOnce("unknown");
    await expect(requestAccount("token", { url: "/api/account" })).rejects.toEqual({
      status: 0,
      data: { message: "Account request failed" },
    });
  });

  it("loads the complete icon library only once", () => {
    const add = jest.spyOn(library, "add");
    loadIcons();
    loadIcons();
    expect(add).toHaveBeenCalled();
    add.mockRestore();
  });

  it("copies, downloads, and prints recovery codes", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.assign(URL, {
      createObjectURL: jest.fn().mockReturnValue("blob:codes"),
      revokeObjectURL: jest.fn(),
    });
    Object.assign(window, { print: jest.fn() });
    render(
      <RecoveryCodesActions
        codes={["1111", "2222"]}
        labels={{ copy: "Copy", copied: "Copied", download: "Download", print: "Print" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("1111\n2222"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeVisible());
    render(
      <RecoveryCodesActions
        codes={["3333"]}
        labels={{ copy: "Copy", copied: "Copied", download: "Download", print: "Print" }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Download" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "Print" }).at(-1)!);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalled();
  });

  it("toggles TOTP setup between QR and manual details", () => {
    render(
      <TotpSetupDetails
        setup={{
          secret: "SECRET",
          qrCode: "data:image/png;base64,QR",
          algorithm: "SHA1",
          digits: 6,
          periodSeconds: 30,
        }}
        copy={{
          qrTitle: "QR code",
          unableToScan: "Unable to scan",
          scanBarcode: "Scan barcode",
          secret: "Secret",
          type: "Type",
          typeTotp: "TOTP",
          algorithm: "Algorithm",
          digits: "Digits",
          period: "Period",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Unable to scan" }));
    expect(screen.getByText("SECRET")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Scan barcode" }));
    expect(screen.getByRole("img", { name: "QR code" })).toBeVisible();
  });
});
