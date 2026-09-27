package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminClientRoleGroup", description = "A group assigned to a client role.")
public record AdminClientRoleGroupDTO(
        @Schema(
                        description = "Internal group identifier.",
                        example = "7",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Group name.",
                        example = "finance-operators",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Full hierarchical group path.",
                        example = "Finance / finance-operators",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String path) {}
