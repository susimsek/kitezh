package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationGroup", description = "A group scoped to an organization.")
public record AdminOrganizationGroupDTO(
        @Schema(description = "Group identifier.", example = "1") Long id,
        @Schema(description = "Group name.", example = "engineering") String name,
        @Schema(description = "Parent group identifier.", example = "2", nullable = true)
                Long parentId,
        @Schema(description = "Number of members.", example = "4") long memberCount) {}
