package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Enabled social provider and its account link status.")
public record SocialLinkDTO(
        @Schema(
                        description = "Social provider alias used by account-linking endpoints.",
                        example = "github",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String provider,
        @Schema(
                        description = "Human-readable social provider name.",
                        example = "GitHub",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Allowlisted icon key used by the account UI.",
                        example = "github",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String iconKey,
        @Schema(
                        description =
                                "Whether this provider is linked to the authenticated account.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean linked,
        @Schema(
                        description =
                                "Whether the provider has usable Client ID and Secret settings.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean configured,
        @Schema(
                        description = "Whether this provider is enabled by the administrator.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled) {}
