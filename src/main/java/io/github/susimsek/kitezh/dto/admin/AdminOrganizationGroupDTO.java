package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(name = "AdminOrganizationGroup", description = "A group scoped to one organization.")
public record AdminOrganizationGroupDTO(
        @Schema(
                        description = "Group identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Organization identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long organizationId,
        @Schema(
                        description = "Group name.",
                        example = "billing-admins",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Optional group description.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description,
        @Schema(
                        description = "Whether the group contributes claims.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean enabled,
        @Schema(
                        description = "Organization-scoped roles assigned by this group.",
                        example = "[\"billing.read\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> roles) {}
