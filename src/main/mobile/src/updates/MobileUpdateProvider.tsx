import * as Application from "expo-application";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert, AppState, Platform } from "react-native";

import { getLatestReleaseMetadata } from "@/api/public-api";
import { useLocale } from "@/i18n/LocaleProvider";
import { downloadAndOpenAndroidUpdate } from "@/updates/install-update";
import {
  parseLatestRelease,
  type MobileRelease,
} from "@/updates/release-check";

const CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const FALLBACK_APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "0.1.0";

type MobileUpdateContextValue = {
  installedVersion: string;
  release: MobileRelease | null;
  checking: boolean;
  installing: boolean;
  downloadPercent: number | null;
  error: "check" | "download" | null;
  permissionRequired: boolean;
  checked: boolean;
  checkForUpdates: () => Promise<void>;
  installOrOpenUpdate: () => Promise<void>;
};

const MobileUpdateContext = createContext<MobileUpdateContextValue | null>(
  null,
);

function currentVersion() {
  return Application.nativeApplicationVersion ?? FALLBACK_APP_VERSION;
}

export function MobileUpdateProvider({ children }: PropsWithChildren) {
  const { dictionary } = useLocale();
  const installedVersion = currentVersion();
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const [release, setRelease] = useState<MobileRelease | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [error, setError] = useState<"check" | "download" | null>(null);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [checked, setChecked] = useState(false);
  const checkingRef = useRef(false);
  const lastCheckAt = useRef(0);
  const promptedVersion = useRef<string | null>(null);

  const checkForUpdates = useCallback(
    async (prompt = false) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      setChecking(true);
      setError(null);
      try {
        const metadata = await getLatestReleaseMetadata();
        const latest = parseLatestRelease(metadata, installedVersion, platform);
        setRelease(latest);
        lastCheckAt.current = Date.now();
        setChecked(true);
        if (prompt && latest && promptedVersion.current !== latest.version) {
          promptedVersion.current = latest.version;
          Alert.alert(
            dictionary.updates,
            dictionary.updateAvailable.replace("{version}", latest.version),
            [
              { style: "cancel", text: dictionary.updateLater },
              {
                onPress: () => router.push("/settings"),
                text: dictionary.updateView,
              },
            ],
          );
        }
      } catch {
        setError("check");
        setChecked(true);
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    },
    [dictionary, installedVersion, platform],
  );

  useEffect(() => {
    if (__DEV__) return;
    const checkIfDue = () => {
      if (
        AppState.currentState === "active" &&
        Date.now() - lastCheckAt.current >= CHECK_COOLDOWN_MS
      ) {
        void checkForUpdates(true);
      }
    };
    checkIfDue();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkIfDue();
    });
    return () => subscription.remove();
  }, [checkForUpdates]);

  const installOrOpenUpdate = useCallback(async () => {
    if (installing || !release) return;
    setError(null);
    setPermissionRequired(false);
    setInstalling(true);
    if (platform === "ios" || !release.asset) {
      try {
        await Linking.openURL(release.pageUrl);
      } catch {
        setError("download");
      } finally {
        setInstalling(false);
      }
      return;
    }

    setDownloadPercent(0);
    try {
      const result = await downloadAndOpenAndroidUpdate(
        release.asset,
        setDownloadPercent,
      );
      if (result === "permission-required") setPermissionRequired(true);
      else setDownloadPercent(100);
    } catch {
      setError("download");
      setDownloadPercent(null);
    } finally {
      setInstalling(false);
    }
  }, [installing, platform, release]);

  const value = useMemo<MobileUpdateContextValue>(
    () => ({
      installedVersion,
      release,
      checking,
      installing,
      downloadPercent,
      error,
      permissionRequired,
      checked,
      checkForUpdates: () => checkForUpdates(false),
      installOrOpenUpdate,
    }),
    [
      installedVersion,
      release,
      checking,
      installing,
      downloadPercent,
      error,
      permissionRequired,
      checked,
      checkForUpdates,
      installOrOpenUpdate,
    ],
  );

  return (
    <MobileUpdateContext.Provider value={value}>
      {children}
    </MobileUpdateContext.Provider>
  );
}

export function useMobileUpdates() {
  const context = useContext(MobileUpdateContext);
  if (!context) {
    throw new Error(
      "useMobileUpdates must be used inside MobileUpdateProvider",
    );
  }
  return context;
}
