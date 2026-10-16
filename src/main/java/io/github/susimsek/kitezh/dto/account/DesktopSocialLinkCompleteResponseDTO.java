package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Completed native desktop social-link result.")
public record DesktopSocialLinkCompleteResponseDTO(
        @Schema(
                        description = "Linked provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String provider,
        @Schema(
                        description = "Whether the provider link is now active.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean linked) {}
