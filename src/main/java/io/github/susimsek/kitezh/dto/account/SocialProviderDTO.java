package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SocialProvider", description = "Social login provider availability.")
public record SocialProviderDTO(
        @Schema(
                        description = "Social provider alias used by the authorization endpoint.",
                        example = "microsoft",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String provider,
        @Schema(
                        description = "Built-in provider type used for display and icon selection.",
                        example = "microsoft",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerType,
        @Schema(
                        description = "Allowlisted icon key used by the login UI.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String iconKey,
        @Schema(
                        description =
                                "Whether the provider has a usable Client ID and Client Secret.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean configured) {}
