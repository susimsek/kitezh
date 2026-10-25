import { redirectSystemPath } from "@/app/+native-intent";

test.each([
  ["kitezh://oauth/callback?code=abc", "/oauth/callback"],
  ["kitezh://admin/oauth/callback", "/admin/oauth/callback"],
  ["kitezh://logout/callback", "/logout/callback"],
  ["kitezh://admin/logout/callback", "/admin/logout/callback"],
  [
    `kitezh://verify-email/?token=${"a".repeat(43)}`,
    `/verify-email?token=${"a".repeat(43)}`,
  ],
  [
    `kitezh://reset-password/?token=${"b".repeat(43)}`,
    `/reset-password?token=${"b".repeat(43)}`,
  ],
])("redirects supported native intent %s", (path, expected) => {
  expect(redirectSystemPath({ path })).toBe(expected);
});

test("preserves unsupported native paths", () => {
  expect(redirectSystemPath({ path: "https://example.com/elsewhere" })).toBe(
    "https://example.com/elsewhere",
  );
});
