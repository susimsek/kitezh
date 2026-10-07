package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationPermissionLevel;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Schema(name = "AdminOrganizationPermissionRequest")
public record AdminOrganizationPermissionRequestDTO(
        @NotNull
                @Positive
                @Schema(
                        description = "User receiving the permission.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @NotNull
                @Schema(
                        description = "Permission level.",
                        example = "MANAGE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                OrganizationPermissionLevel permissionLevel) {}
