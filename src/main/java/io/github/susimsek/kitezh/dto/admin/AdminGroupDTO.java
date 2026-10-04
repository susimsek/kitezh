package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Schema(name = "AdminGroup", description = "A group and its direct and effective role mappings.")
public record AdminGroupDTO(
        @Schema(
                        description = "Internal group identifier.",
                        example = "1",
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
                String path,
        @Schema(
                        description = "Parent group identifier, if nested.",
                        example = "2",
                        format = "int64",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Long parentId,
        @Schema(
                        description = "Realm roles assigned directly to the group.",
                        example = "[\"ROLE_USER_VIEWER\", \"ROLE_CLIENT_VIEWER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> roles,
        @Schema(
                        description = "All roles effective for the group, including parent groups.",
                        example = "[\"ROLE_USER_VIEWER\", \"ROLE_CLIENT_VIEWER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> effectiveRoles,
        @Schema(
                        description = "Multi-valued group attributes.",
                        example = "{\"department\":[\"finance\"],\"costCenter\":[\"42\"]}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, List<String>> attributes,
        @Schema(
                        description = "Whether new users are automatically added to this group.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean defaultGroup,
        @Schema(
                        description = "Number of users in the group.",
                        example = "3",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long userCount) {

    public AdminGroupDTO(
            Long id, String name, String path, Long parentId, Set<String> roles, long userCount) {
        this(id, name, path, parentId, roles, roles, Map.of(), false, userCount);
    }

    public AdminGroupDTO(
            Long id,
            String name,
            String path,
            Long parentId,
            Set<String> roles,
            Set<String> effectiveRoles,
            long userCount) {
        this(id, name, path, parentId, roles, effectiveRoles, Map.of(), false, userCount);
    }
}
