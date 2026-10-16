import type { NativeApiRequest, NativeApiResponse } from "@kitezh/shared";
import type { IpcMainInvokeEvent } from "electron";

type ConsoleName = "account" | "admin";

type IpcMainLike = {
  handle: (
    channel: string,
    listener: (event: IpcMainInvokeEvent, request: unknown) => unknown,
  ) => void;
};

type AssertConsole = (value: unknown) => asserts value is ConsoleName;

type NativeApiIpcOptions = {
  ipcMain: IpcMainLike;
  assertTrustedSender: (event: IpcMainInvokeEvent) => void;
  assertConsole: AssertConsole;
  request: (request: NativeApiRequest) => Promise<NativeApiResponse>;
};

export function registerNativeApiIpc({
  ipcMain,
  assertTrustedSender,
  assertConsole,
  request,
}: NativeApiIpcOptions) {
  const validateConsole: AssertConsole = assertConsole;
  ipcMain.handle("desktop:api-request", async (event, rawRequest) => {
    assertTrustedSender(event);
    if (!rawRequest || typeof rawRequest !== "object") {
      throw new Error("Invalid native API request");
    }

    const value = rawRequest as Partial<NativeApiRequest>;
    validateConsole(value.console);
    if (
      typeof value.path !== "string" ||
      !value.path.startsWith("/") ||
      value.path.includes("//") ||
      value.path.includes("..")
    ) {
      throw new Error("Invalid native API path");
    }

    return request({
      console: value.console,
      locale: value.locale === "tr" ? "tr" : "en",
      method: value.method,
      path: value.path,
      body: value.body,
    });
  });
}
