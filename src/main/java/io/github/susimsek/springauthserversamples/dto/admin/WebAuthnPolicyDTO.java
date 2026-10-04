package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The WebAuthn ceremony policy exposed by the administration API. */
@Schema(name = "WebAuthnPolicy", description = "WebAuthn relying-party and authenticator policy.")
public record WebAuthnPolicyDTO(
        @Schema(description = "Human-readable relying-party entity name.", example = "Kitezh")
                @NotBlank
                @Size(max = 255)
                String rpName,
        @Schema(
                        description =
                                "Relying-party identifier. Leave blank to use the issuer host.",
                        example = "localhost")
                @Size(max = 253)
                String rpId,
        @Schema(
                        description =
                                "Comma-separated COSE signature algorithms in preference order.",
                        example = "ES256,RS256,EdDSA")
                @NotBlank
                @Size(max = 255)
                String signatureAlgorithms,
        @Schema(
                        description = "Attestation conveyance preference.",
                        allowableValues = {"none", "indirect", "direct", "enterprise"})
                @NotBlank
                String attestation,
        @Schema(
                        description = "Authenticator attachment preference.",
                        allowableValues = {"any", "platform", "cross-platform"})
                @NotBlank
                String authenticatorAttachment,
        @Schema(
                        description = "Discoverable credential requirement.",
                        allowableValues = {"discouraged", "preferred", "required"})
                @NotBlank
                String residentKey,
        @Schema(
                        description = "User-verification requirement.",
                        allowableValues = {"discouraged", "preferred", "required"})
                @NotBlank
                String userVerification,
        @Schema(
                        description = "WebAuthn ceremony timeout in seconds.",
                        minimum = "1",
                        maximum = "86400")
                @Min(1)
                @Max(86400)
                int timeoutSeconds,
        @Schema(description = "Exclude already registered credentials during registration.")
                boolean avoidSameAuthenticator,
        @Schema(
                        description =
                                "Comma-separated AAGUID UUIDs accepted during registration. Leave"
                                        + " blank to accept all.",
                        example = "00000000-0000-0000-0000-000000000000")
                @Size(max = 4000)
                String acceptableAaguids) {}
