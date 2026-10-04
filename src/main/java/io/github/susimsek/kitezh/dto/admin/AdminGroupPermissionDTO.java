package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminGroupPermission", description = "A group-scoped administrator permission.")
public record AdminGroupPermissionDTO(
        @Schema(
                        description = "User identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Administrator username.",
                        example = "group-manager",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Permission name.",
                        example = "MANAGE_MEMBERS",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String permission) {}
