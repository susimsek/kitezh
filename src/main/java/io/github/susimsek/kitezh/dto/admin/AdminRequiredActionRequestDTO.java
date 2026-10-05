package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminRequiredActionRequest", description = "Required action policy update.")
public record AdminRequiredActionRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Size(max = 200, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Localized display name for the required action.",
                        example = "Complete your profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Size(max = 1000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional localized description of the required action.",
                        example = "The account must provide a complete profile.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
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
        @Min(1)
                @Schema(
                        description = "Current policy version; must be at least 1.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long version,
        @Min(0)
                @Schema(
                        description = "Evaluation priority; lower values run first.",
                        example = "100",
                        format = "int32",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority,
        @Size(max = 4000, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Optional action-specific JSON configuration.",
                        example = "{\"fields\":[\"firstName\",\"lastName\",\"email\"]}",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String configuration) {}
