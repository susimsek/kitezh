package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminRequiredAction", description = "Required action policy configuration.")
public record AdminRequiredActionDTO(
        @Schema(
                        description = "Stable required-action key.",
                        example = "UPDATE_PROFILE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String key,
        @Schema(
                        description = "Localized display name.",
                        example = "Complete your profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Localized description of the required action.",
                        example = "The account must provide a complete profile.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String description,
        @Schema(
                        description = "Whether the required action is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Whether the action applies as a global account policy.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean globalPolicy,
        @Schema(
                        description = "Current policy version.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long version,
        @Schema(
                        description = "Evaluation priority; lower values run first.",
                        example = "100",
                        format = "int32",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority,
        @Schema(
                        description = "Optional action-specific JSON configuration.",
                        example = "{\"fields\":[\"firstName\",\"lastName\",\"email\"]}",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String configuration) {}
