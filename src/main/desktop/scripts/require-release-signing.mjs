const requirementsByPlatform = {
  linux: [
    "UPDATE_MANIFEST_SIGNING_KEY",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  ],
  macos: [
    "UPDATE_MANIFEST_SIGNING_KEY",
    "MAC_CSC_LINK",
    "MAC_CSC_KEY_PASSWORD",
    "APPLE_API_KEY_BASE64",
    "APPLE_API_KEY_ID",
    "APPLE_API_ISSUER",
  ],
  windows: [
    "UPDATE_MANIFEST_SIGNING_KEY",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
  ],
};

const platform = process.env.DESKTOP_RELEASE_PLATFORM;
const requiredVariables = requirementsByPlatform[platform];

if (!requiredVariables) {
  process.stderr.write("DESKTOP_RELEASE_PLATFORM is unsupported.\n");
  process.exitCode = 1;
} else {
  const missingVariables = requiredVariables.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingVariables.length) {
    process.stderr.write(
      `Missing required release signing variables: ${missingVariables.join(", ")}.\n`,
    );
    process.exitCode = 1;
  }
}
