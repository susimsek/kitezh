import { clearSession, readSession, writeSession } from "../auth/storage";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);

beforeEach(() => {
  jest.clearAllMocks();
});

test("native storage reads a namespaced session and clears it when absent", async () => {
  secureStore.getItemAsync.mockResolvedValue(
    JSON.stringify({
      accessToken: "access",
      refreshToken: null,
      expiresAt: 123,
    }),
  );

  await expect(readSession("admin")).resolves.toEqual({
    accessToken: "access",
    refreshToken: null,
    idToken: null,
    expiresAt: 123,
  });
  await clearSession("admin");

  expect(secureStore.getItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.admin.session",
  );
  expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.admin.session",
  );
});

test("native storage writes the serialized session in the requested namespace", async () => {
  const session = {
    accessToken: "access",
    refreshToken: "refresh",
    idToken: "id",
    expiresAt: 456,
  };

  await writeSession(session, "account");

  expect(secureStore.setItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.account.session",
    JSON.stringify(session),
  );
});
