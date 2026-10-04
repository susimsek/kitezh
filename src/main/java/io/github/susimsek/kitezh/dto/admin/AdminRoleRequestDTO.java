package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminRoleRequest", description = "Realm role to create or update.")
public record AdminRoleRequestDTO(
        @NotBlank(message = "{app.api.problem.violation.required}")
                @Pattern(
                        regexp = "ROLE_[A-Z0-9_]+",
                        message = "{app.api.problem.violation.role_format}")
                @Size(max = 50, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Role name; must match `ROLE_[A-Z0-9_]+`.",
                        example = "ROLE_AUDITOR",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Size(max = 500, message = "{app.api.problem.violation.max_length}")
                @Schema(
                        description = "Human-readable role description.",
                        example = "Allows viewing user accounts.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description) {

    public AdminRoleRequestDTO(String name) {
        this(name, null);
    }
}
