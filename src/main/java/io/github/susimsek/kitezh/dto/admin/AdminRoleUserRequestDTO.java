package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "AdminRoleUserRequest", description = "User membership to assign to a role.")
public record AdminRoleUserRequestDTO(
        @Schema(
                        description = "Internal user identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Long userId) {}
