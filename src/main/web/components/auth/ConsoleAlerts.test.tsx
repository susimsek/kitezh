import { act, fireEvent, render, screen } from "@testing-library/react";

import dictionary from "@/locales/en/common.json";

import { ConsoleAlertsProvider, useConsoleAlerts } from "./ConsoleAlerts";

jest.mock("@/i18n/client", () => ({
  useDictionary: () => dictionary,
}));

function AlertActions() {
  const { addAlert, addError } = useConsoleAlerts();
  return (
    <>
      <button onClick={() => addAlert("Saved")}>saved</button>
      <button onClick={() => addAlert("Warning", "warning")}>warning</button>
      <button onClick={() => addError("Failed")}>failed</button>
    </>
  );
}

describe("ConsoleAlerts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds alerts, exposes variants, supports dismissal, and expires alerts", () => {
    render(
      <ConsoleAlertsProvider>
        <AlertActions />
      </ConsoleAlertsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "saved" }));
    fireEvent.click(screen.getByRole("button", { name: "warning" }));
    fireEvent.click(screen.getByRole("button", { name: "failed" }));

    expect(screen.getByText("Saved").parentElement).toHaveClass("alert-success");
    expect(screen.getByText("Warning").parentElement).toHaveClass("alert-warning");
    expect(screen.getByText("Failed").parentElement).toHaveClass("alert-danger");

    fireEvent.click(screen.getAllByRole("button", { name: dictionary.admin.common.close })[0]);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(4500));
    expect(screen.queryByText("Warning")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("returns a safe no-op API outside the provider", () => {
    expect(() => {
      render(<AlertActions />);
      fireEvent.click(screen.getByRole("button", { name: "saved" }));
      fireEvent.click(screen.getByRole("button", { name: "failed" }));
    }).not.toThrow();
  });
});
