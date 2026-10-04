package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminRole", description = "Realm role and its description.")
public record AdminRoleDTO(
        @Schema(
                        description = "Role name.",
                        example = "ROLE_USER_VIEWER",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Human-readable role description.",
                        example = "Allows viewing user accounts.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description) {

    public AdminRoleDTO(String name) {
        this(name, null);
    }
}
