package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
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
                long groupCount) {}
