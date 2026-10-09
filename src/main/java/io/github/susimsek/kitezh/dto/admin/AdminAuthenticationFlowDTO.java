package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.domain.AuthenticationFlowType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminAuthenticationFlow", description = "A single-issuer authentication flow.")
public record AdminAuthenticationFlowDTO(
        @Schema(
                        description = "Internal flow identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Stable flow alias.",
                        example = "browser",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String alias,
        @Schema(
                        description = "Administrator-facing flow name.",
                        example = "Browser",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Optional administrator-facing flow description.",
                        example = "Single-issuer browser authentication flow.",
                        nullable = true)
                String description,
        @Schema(
                        description = "Flow implementation type.",
                        example = "BASIC",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowType flowType,
        @Schema(
                        description = "Whether this flow is a top-level application flow.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean topLevel,
        @Schema(
                        description = "Whether this is a protected bootstrap flow.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean builtIn,
        @Schema(
                        description = "Requirement when this flow is used as a sub-flow.",
                        example = "ALTERNATIVE",
                        nullable = true)
                AuthenticationFlowRequirement requirement,
        @Schema(
                        description = "Sibling order within the parent flow.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority) {}
