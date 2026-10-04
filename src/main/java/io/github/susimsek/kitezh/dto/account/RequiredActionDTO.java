package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RequiredAction", description = "An action that must be completed before access.")
public record RequiredActionDTO(
        @Schema(
                        description = "Stable action key.",
                        example = "UPDATE_PROFILE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String key,
        @Schema(
                        description = "Localized display name.",
                        example = "Complete your profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Localized action description.",
                        example = "The account must provide a complete profile.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String description,
        @Schema(
                        description = "Required action version.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long version) {}
