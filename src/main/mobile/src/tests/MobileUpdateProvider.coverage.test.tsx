import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Alert, AppState, Platform } from "react-native";

import { getLatestReleaseMetadata } from "@/api/public-api";
import {
  MobileUpdateProvider,
  useMobileUpdates,
} from "@/updates/MobileUpdateProvider";
import { downloadAndOpenAndroidUpdate } from "@/updates/install-update";

jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.2.0" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@/api/public-api", () => ({ getLatestReleaseMetadata: jest.fn() }));
jest.mock("@/updates/install-update", () => ({
  downloadAndOpenAndroidUpdate: jest.fn(),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({
    dictionary: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));

Object.defineProperty(globalThis, "__DEV__", {
  configurable: true,
  value: true,
});

function UpdateProbe() {
  const updates = useMobileUpdates();
  return (
    <div>
      <output data-testid="state">
        {JSON.stringify({
          version: updates.release?.version,
          checked: updates.checked,
          checking: updates.checking,
          installing: updates.installing,
          progress: updates.downloadPercent,
          error: updates.error,
          permissionRequired: updates.permissionRequired,
        })}
      </output>
      <button onClick={() => void updates.checkForUpdates()}>check</button>
      <button onClick={() => void updates.installOrOpenUpdate()}>
        install
      </button>
    </div>
  );
}

function renderUpdates() {
  return render(
    <MobileUpdateProvider>
      <UpdateProbe />
    </MobileUpdateProvider>,
  );
}

function state() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}") as {
    version?: string;
    checked: boolean;
    checking: boolean;
    installing: boolean;
    progress: number | null;
    error: "check" | "download" | null;
    permissionRequired: boolean;
  };
}

const release = {
  version: "1.3.0",
  tag: "v1.3.0",
  releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v1.3.0",
  assets: {
    androidApk:
      "https://github.com/susimsek/kitezh/releases/download/v1.3.0/kitezh.apk",
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis, "__DEV__", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
});

it("checks for a release and installs its Android asset", async () => {
  jest.mocked(getLatestReleaseMetadata).mockResolvedValue(release);
  jest
    .mocked(downloadAndOpenAndroidUpdate)
    .mockImplementation(async (_asset, onProgress) => {
      onProgress(42);
      return "installer-opened";
    });

  renderUpdates();
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ checked: true, version: "1.3.0" }),
  );

  fireEvent.click(screen.getByRole("button", { name: "install" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ installing: false, progress: 100 }),
  );
  expect(downloadAndOpenAndroidUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ name: "kitezh-1.3.0-android.apk" }),
    expect.any(Function),
  );
});

it("checks on app activation in production and prompts only once per version", async () => {
  const { router } = jest.requireMock("expo-router");
  let onAppStateChange: ((state: string) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _event,
    listener,
  ) => {
    onAppStateChange = listener as (state: string) => void;
    return { remove: jest.fn() };
  }) as never);
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  let now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  Object.defineProperty(globalThis, "__DEV__", {
    configurable: true,
    value: false,
  });
  jest.mocked(getLatestReleaseMetadata).mockResolvedValue(release);

  renderUpdates();
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
  const actions = alert.mock.calls[0]?.[2];
  actions?.find((action) => action.text === "updateView")?.onPress?.();
  expect(router.push).toHaveBeenCalledWith("/settings");

  await act(async () => {
    now += 6 * 60 * 60 * 1000;
    onAppStateChange?.("active");
  });
  await waitFor(() =>
    expect(getLatestReleaseMetadata).toHaveBeenCalledTimes(2),
  );
  expect(alert).toHaveBeenCalledTimes(1);
});

it("reports check and download failures and exposes installer permission state", async () => {
  jest
    .mocked(getLatestReleaseMetadata)
    .mockRejectedValueOnce(new Error("offline"));
  const view = renderUpdates();
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ checked: true, error: "check" }),
  );

  jest.mocked(getLatestReleaseMetadata).mockResolvedValue(release);
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ version: "1.3.0", error: null }),
  );

  jest
    .mocked(downloadAndOpenAndroidUpdate)
    .mockResolvedValueOnce("permission-required")
    .mockRejectedValueOnce(new Error("download failed"));
  fireEvent.click(screen.getByRole("button", { name: "install" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ permissionRequired: true }),
  );

  fireEvent.click(screen.getByRole("button", { name: "install" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ error: "download", progress: null }),
  );
  view.unmount();
});

it("opens the release page on iOS and handles link errors", async () => {
  const linking = jest.requireMock("expo-linking") as {
    openURL: jest.Mock;
  };
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  jest.mocked(getLatestReleaseMetadata).mockResolvedValue(release);
  const view = renderUpdates();
  fireEvent.click(screen.getByRole("button", { name: "check" }));
  await waitFor(() => expect(state()).toMatchObject({ version: "1.3.0" }));

  linking.openURL.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole("button", { name: "install" }));
  await waitFor(() =>
    expect(linking.openURL).toHaveBeenCalledWith(release.releaseUrl),
  );
  await waitFor(() => expect(state().installing).toBe(false));

  linking.openURL.mockRejectedValueOnce(new Error("no browser"));
  fireEvent.click(screen.getByRole("button", { name: "install" }));
  await waitFor(() =>
    expect(state()).toMatchObject({ installing: false, error: "download" }),
  );
  view.unmount();
});
