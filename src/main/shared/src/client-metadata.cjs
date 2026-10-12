/** Builds product metadata headers used by Kitezh API clients. */
exports.createClientMetadataHeaders = function createClientMetadataHeaders(
  metadata,
) {
  const version = metadata.appVersion.trim().replace(/^v/i, "");
  if (!version) throw new Error("An application version is required");

  const headers = {
    "App-Name": "Kitezh",
    "App-Version": `v${version}`,
    "Client-Platform": metadata.clientPlatform,
  };
  const os = metadata.os?.trim();
  if (os) headers.OS = os;
  return headers;
};
