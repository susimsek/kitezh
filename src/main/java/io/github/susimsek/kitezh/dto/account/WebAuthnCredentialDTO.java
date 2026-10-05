package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Set;

@Schema(name = "WebAuthnCredential", description = "Registered passkey credential metadata.")
public record WebAuthnCredentialDTO(
        @Schema(
                        description = "Opaque credential identifier used to manage this passkey.",
                        example = "6D3m0fYpYc5YJ4h1QwXqvA",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String credentialId,
        @Schema(
                        description = "User-provided passkey label.",
                        example = "Windows Hello",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String label,
        @Schema(
                        description = "When the passkey was registered.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "When the passkey was last used.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant lastUsedAt,
        @Schema(
                        description = "Authenticator transports.",
                        example = "[\"internal\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> transports,
        @Schema(
                        description = "Whether the credential can be backed up.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean backupEligible,
        @Schema(
                        description = "Whether the credential is currently backed up.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean backupState,
        @Schema(
                        description = "WebAuthn credential type.",
                        example = "public-key",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String credentialType,
        @Schema(
                        description = "Authenticator signature counter.",
                        example = "4",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long signatureCount,
        @Schema(
                        description = "Whether user verification was initialized.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean uvInitialized,
        @Schema(
                        description = "Whether attestation data is available.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean attestationPresent) {}
