package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowNodeType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminAuthenticationFlowNode",
        description = "An ordered flow execution or sub-flow.")
public record AdminAuthenticationFlowNodeDTO(
        @Schema(
                        description = "Node type.",
                        example = "EXECUTION",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowNodeType nodeType,
        @Schema(
                        description = "Node identifier.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Node display name.",
                        example = "Username Password Form",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Execution provider identifier; null for sub-flows.",
                        example = "username-password-form",
                        nullable = true)
                String providerId,
        @Schema(
                        description = "Execution or sub-flow requirement.",
                        example = "REQUIRED",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowRequirement requirement,
        @Schema(
                        description = "Node order within the parent flow.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority,
        @Schema(
                        description = "Whether the node belongs to a protected bootstrap flow.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean builtIn) {}
