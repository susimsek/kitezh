import { render } from "@testing-library/react";

import { AdminPostLoginRedirect } from "./AdminPostLoginRedirect";

const replace = jest.fn();

jest.mock("@/routing/navigation", () => ({
  useParams: () => ({ lang: "en" }),
  useRouter: () => ({ replace }),
}));

describe("AdminPostLoginRedirect", () => {
  beforeEach(() => {
    sessionStorage.clear();
    replace.mockReset();
  });

  it("redirects to a stored internal location without reloading the document", () => {
    sessionStorage.setItem("AUTH_ADMIN_RETURN_TO", "/admin/clients");
    render(<AdminPostLoginRedirect />);

    expect(replace).toHaveBeenCalledWith("/admin/clients");
    expect(sessionStorage.getItem("AUTH_ADMIN_RETURN_TO")).toBeNull();
  });

  it.each([null, "https://example.com/admin"])(
    "does not redirect to an absent or external location",
    (returnTo) => {
      if (returnTo) sessionStorage.setItem("AUTH_ADMIN_RETURN_TO", returnTo);
      render(<AdminPostLoginRedirect />);

      expect(replace).not.toHaveBeenCalled();
      expect(sessionStorage.getItem("AUTH_ADMIN_RETURN_TO")).toBe(returnTo);
    },
  );
});
