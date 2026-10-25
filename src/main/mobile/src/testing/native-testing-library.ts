import {
  act,
  fireEvent as nativeFireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

export { act, render, screen, waitFor };

export const fireEvent = {
  press(element: ReactTestInstance) {
    nativeFireEvent.press(element);
  },
  changeText(
    element: ReactTestInstance,
    valueOrEvent: string | { target: { value: string } },
  ) {
    const value =
      typeof valueOrEvent === "string"
        ? valueOrEvent
        : valueOrEvent.target.value;
    nativeFireEvent.changeText(element, value);
  },
  valueChange(element: ReactTestInstance, value: boolean) {
    nativeFireEvent(element, "valueChange", value);
  },
};
