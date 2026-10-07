package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.OrganizationPermissionLevel;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationPermission")
public record AdminOrganizationPermissionDTO(
        @Schema(
                        description = "Permission identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Granted user identifier.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Granted username.",
                        example = "org-manager",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Permission level.",
                        example = "MANAGE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                OrganizationPermissionLevel permissionLevel) {}
