package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(
        name = "AdminUserGroupRole",
        description = "Roles inherited from one user group membership.")
public record AdminUserGroupRoleDTO(
        @Schema(
                        description = "Group identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long groupId,
        @Schema(
                        description = "Full group path.",
                        example = "/finance/operations",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String groupPath,
        @Schema(
                        description = "Roles inherited from this group and its parent groups.",
                        example = "[\"ROLE_ADMIN\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> roles) {}
