import { act, renderHook } from "@testing-library/react";
import i18next from "i18next";
import { useDateTimeFormatter } from "./useDateTimeFormatter";

it("reformats dates when the selected UI locale changes without changing the time zone", async () => {
  const timestamp = "2026-09-03T13:45:00Z";
  const { result } = renderHook(() => useDateTimeFormatter());
  expect(result.current(timestamp)).toBe(new Date(timestamp).toLocaleString("en"));
  await act(() => i18next.changeLanguage("tr"));
  expect(result.current(timestamp)).toBe(new Date(timestamp).toLocaleString("tr"));
});
