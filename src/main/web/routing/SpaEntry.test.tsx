import { render, screen } from "@testing-library/react";

import { SpaEntry } from "./SpaEntry";

jest.mock("next/dynamic", () => {
  const dynamicMock = () => {
    function DeferredSpaApplication() {
      return <div>deferred spa application</div>;
    }
    return DeferredSpaApplication;
  };
  return dynamicMock;
});

it("renders the client-only SPA application", () => {
  render(<SpaEntry />);

  expect(screen.getByText("deferred spa application")).toBeVisible();
});
