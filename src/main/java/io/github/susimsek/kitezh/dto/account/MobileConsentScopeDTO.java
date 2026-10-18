package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MobileConsentScope", description = "A requested OAuth scope shown for consent.")
public record MobileConsentScopeDTO(
        @Schema(
                        description = "OAuth scope identifier.",
                        example = "profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Human-readable scope label.",
                        example = "Profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Scope purpose shown to the user.",
                        example = "Read your profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String description) {}
