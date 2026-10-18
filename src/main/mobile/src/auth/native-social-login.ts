import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export function isNativeSocialProviderConfigured(provider: string): boolean {
  if (
    provider !== "google" ||
    !GOOGLE_WEB_CLIENT_ID ||
    (Platform.OS !== "android" && Platform.OS !== "ios")
  ) {
    return false;
  }
  return Platform.OS !== "ios" || Boolean(GOOGLE_IOS_CLIENT_ID);
}

/** Returns Google's signed ID token for server-side verification. */
export async function requestNativeGoogleIdToken(): Promise<string> {
  if (!isNativeSocialProviderConfigured("google")) {
    throw new Error("native-social-provider-not-configured");
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
  if (Platform.OS === "android") await GoogleSignin.hasPlayServices();

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("authorization-cancelled");
  const idToken = response.data.idToken;
  if (!idToken) throw new Error("native-social-id-token-missing");
  return idToken;
}
