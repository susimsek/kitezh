import { Platform } from "react-native";

const mockPasskey = {
  create: jest.fn(),
  get: jest.fn(),
  isSupported: jest.fn(),
};
const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(),
  signIn: jest.fn(),
};

jest.mock("react-native-passkey", () => ({ Passkey: mockPasskey }));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: mockGoogleSignin,
  isSuccessResponse: (response: { type?: string }) =>
    response.type === "success",
}));

const originalWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const originalIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const originalPlatform = Platform.OS;
let socialLoginModule: typeof import("@/auth/native-social-login") | null =
  null;

function loadPasskey() {
  return require("@/auth/native-passkey") as typeof import("@/auth/native-passkey");
}

function loadSocialLogin(
  webClientId: string,
  iosClientId = "",
  platform: "ios" | "android" | "web" = "android",
) {
  if (!socialLoginModule) {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webClientId;
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = iosClientId;
  }
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: platform,
  });
  socialLoginModule ??=
    require("@/auth/native-social-login") as typeof import("@/auth/native-social-login");
  return socialLoginModule;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPasskey.isSupported.mockReturnValue(true);
  mockPasskey.create.mockResolvedValue({
    id: "registration-id",
    response: { attestationObject: "attestation", clientDataJSON: "client" },
  });
  mockPasskey.get.mockResolvedValue({
    id: "assertion-id",
    response: {
      authenticatorData: "authenticator",
      clientDataJSON: "client",
      signature: "signature",
    },
  });
  mockGoogleSignin.hasPlayServices.mockResolvedValue(undefined);
  mockGoogleSignin.signIn.mockResolvedValue({
    type: "success",
    data: { idToken: "signed-id-token" },
  });
});

afterAll(() => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: originalPlatform,
  });
  if (originalWebClientId === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalWebClientId;
  }
  if (originalIosClientId === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = originalIosClientId;
  }
});

it("reports native passkey capability and normalizes create and get responses", async () => {
  const passkey = loadPasskey();

  expect(passkey.isNativePasskeySupported()).toBe(true);
  await expect(passkey.createNativePasskey({} as never)).resolves.toMatchObject(
    {
      id: "registration-id",
      response: { attestationObject: "attestation" },
    },
  );
  await expect(passkey.getNativePasskey({} as never)).resolves.toMatchObject({
    id: "assertion-id",
    response: { signature: "signature", userHandle: null },
  });
  expect(mockPasskey.create).toHaveBeenCalledTimes(1);
  expect(mockPasskey.get).toHaveBeenCalledTimes(1);
});

it("fails passkey requests closed when the native API is unavailable", async () => {
  const passkey = loadPasskey();
  mockPasskey.isSupported.mockReturnValue(false);

  expect(passkey.isNativePasskeySupported()).toBe(false);
  await expect(passkey.createNativePasskey({} as never)).rejects.toThrow(
    "native-passkey-not-supported",
  );
  await expect(passkey.getNativePasskey({} as never)).rejects.toThrow(
    "native-passkey-not-supported",
  );
  expect(mockPasskey.create).not.toHaveBeenCalled();
  expect(mockPasskey.get).not.toHaveBeenCalled();
});

it("limits native Google login to configured mobile platforms", () => {
  const social = loadSocialLogin("web-client");

  expect(social.isNativeSocialProviderConfigured("google")).toBe(true);
  expect(social.isNativeSocialProviderConfigured("github")).toBe(false);
  expect(
    loadSocialLogin("web-client", "", "web").isNativeSocialProviderConfigured(
      "google",
    ),
  ).toBe(false);
  expect(
    loadSocialLogin("web-client", "", "ios").isNativeSocialProviderConfigured(
      "google",
    ),
  ).toBe(false);
});

it("requests a signed Google token and checks Android Play Services", async () => {
  const social = loadSocialLogin("web-client", "ios-client");

  await expect(social.requestNativeGoogleIdToken()).resolves.toBe(
    "signed-id-token",
  );
  expect(mockGoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: "web-client",
  });
  expect(mockGoogleSignin.hasPlayServices).toHaveBeenCalledTimes(1);
});

it("reports Google cancellation and a missing ID token", async () => {
  const configured = loadSocialLogin("web-client");
  mockGoogleSignin.signIn.mockResolvedValueOnce({ type: "cancelled" });
  await expect(configured.requestNativeGoogleIdToken()).rejects.toThrow(
    "authorization-cancelled",
  );
  mockGoogleSignin.signIn.mockResolvedValueOnce({ type: "success", data: {} });
  await expect(configured.requestNativeGoogleIdToken()).rejects.toThrow(
    "native-social-id-token-missing",
  );
});
