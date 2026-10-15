package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Permission that protects a resource operation.")
public record AdminAuthorizationPermissionDTO(
        @Schema(
                        description = "Permission identifier.",
                        example = "6c6651a4-8b51-4aa9-8ddc-54694db9dafe",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Resource identifier.",
                        example = "b1ad2245-9f58-42f7-bdea-e5a2d63c7240",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String resourceId,
        @Schema(
                        description = "Permission name.",
                        example = "Read orders",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(description = "Bound scope name.", example = "view", nullable = true)
                String scopeName,
        @Schema(
                        description = "Policy decision strategy.",
                        example = "AFFIRMATIVE",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String decisionStrategy,
        @Schema(description = "Linked policies.", requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> policyIds) {}
