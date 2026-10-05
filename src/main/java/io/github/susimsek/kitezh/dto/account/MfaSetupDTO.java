package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MfaSetup", description = "TOTP authenticator enrollment details.")
public record MfaSetupDTO(
        @Schema(
                        description = "Base32 secret for manual authenticator entry.",
                        example = "JBSWY3DPEHPK3PXP",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String secret,
        @Schema(
                        description = "Backend-generated QR code data URI for authenticator setup.",
                        example = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String qrCode,
        @Schema(
                        description = "Configured TOTP algorithm.",
                        example = "SHA1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String algorithm,
        @Schema(
                        description = "Configured code length.",
                        example = "6",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int digits,
        @Schema(
                        description = "Configured code period in seconds.",
                        example = "30",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int periodSeconds) {}
