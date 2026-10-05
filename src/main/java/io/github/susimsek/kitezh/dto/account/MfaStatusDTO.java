package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MfaStatus", description = "Account TOTP MFA status.")
public record MfaStatusDTO(
        @Schema(
                        description = "Whether TOTP is enabled for the account.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Whether the realm allows TOTP enrollment.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean available,
        @Schema(
                        description = "Whether the realm requires TOTP after password login.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean required,
        @Schema(
                        description = "Configured TOTP issuer label.",
                        example = "Kitezh",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String issuer,
        @Schema(
                        description = "Configured TOTP algorithm.",
                        example = "SHA1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String algorithm,
        @Schema(
                        description = "Configured TOTP code length.",
                        example = "6",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int digits,
        @Schema(
                        description = "Configured TOTP period in seconds.",
                        example = "30",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int periodSeconds) {}
