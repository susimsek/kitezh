package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminGroupPermissionRequest", description = "A group-scoped permission assignment.")
public record AdminGroupPermissionRequestDTO(
        @NotNull
                @Schema(
                        description = "User identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @NotBlank
                @Size(max = 50, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Permission name.",
                        example = "MANAGE_MEMBERS",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String permission) {}
