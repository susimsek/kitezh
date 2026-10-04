package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;
import org.springframework.data.domain.Page;

@Schema(name = "AdminClientRoleDetail", description = "Client role details and user mappings.")
public record AdminClientRoleDetailDTO(
        @Schema(description = "Client role.", requiredMode = Schema.RequiredMode.REQUIRED)
                AdminClientRoleDTO role,
        @Schema(
                        description = "Paged users assigned to the role.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Page<AdminRoleUserDTO> users,
        @Schema(
                        description = "Paged groups assigned to the role.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Page<AdminClientRoleGroupDTO> groups,
        @Schema(
                        description = "Number of users assigned directly to the role.",
                        example = "3",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long userCount,
        @Schema(
                        description = "Number of groups assigned to the role.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long groupCount,
        @Schema(
                        description = "Direct child roles included by this composite role.",
                        example = "[\"invoice.read\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<AdminClientRoleDTO> compositeRoles,
        @Schema(
                        description = "Direct realm roles included by this composite role.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<AdminRoleDTO> compositeRealmRoles) {

    public AdminClientRoleDetailDTO(
            AdminClientRoleDTO role,
            Page<AdminRoleUserDTO> users,
            Page<AdminClientRoleGroupDTO> groups,
            long userCount,
            long groupCount) {
        this(role, users, groups, userCount, groupCount, Set.of(), Set.of());
    }
}
