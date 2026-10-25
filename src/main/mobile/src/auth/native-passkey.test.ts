import assert from "node:assert/strict";
import test from "node:test";

import {
  assertionCredentialJson,
  registrationCredentialJson,
} from "./native-passkey-contract.ts";

test("registration credential is normalized to the server WebAuthn JSON shape", () => {
  const credential = registrationCredentialJson({
    id: "credential-id",
    rawId: "credential-id",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      attestationObject: "attestation",
      clientDataJSON: "client-data",
      transports: [],
    },
  });

  assert.deepEqual(credential, {
    id: "credential-id",
    rawId: "credential-id",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      attestationObject: "attestation",
      clientDataJSON: "client-data",
      transports: [],
    },
  });
});

test("assertion credential preserves signed response data and nullable user handle", () => {
  const credential = assertionCredentialJson({
    id: "assertion-id",
    response: {
      authenticatorData: "authenticator-data",
      clientDataJSON: "client-data",
      signature: "signature",
    },
  });

  assert.deepEqual(credential, {
    id: "assertion-id",
    rawId: "assertion-id",
    type: "public-key",
    authenticatorAttachment: null,
    clientExtensionResults: {},
    response: {
      authenticatorData: "authenticator-data",
      clientDataJSON: "client-data",
      signature: "signature",
      userHandle: null,
    },
  });
});
