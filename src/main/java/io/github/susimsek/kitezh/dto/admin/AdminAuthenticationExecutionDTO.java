package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminAuthenticationExecution",
        description = "An authenticator execution in a flow.")
public record AdminAuthenticationExecutionDTO(
        @Schema(
                        description = "Internal execution identifier.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Owning flow identifier.",
                        example = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long flowId,
        @Schema(
                        description = "Supported authenticator provider identifier.",
                        example = "username-password-form",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String providerId,
        @Schema(
                        description = "Administrator-facing execution name.",
                        example = "Username Password Form",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String displayName,
        @Schema(
                        description = "Keycloak-style execution requirement.",
                        example = "REQUIRED",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowRequirement requirement,
        @Schema(
                        description = "Execution order within its flow.",
                        example = "10",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int priority,
        @Schema(description = "Optional AMR reference value.", example = "pwd", nullable = true)
                String authenticatorReference,
        @Schema(
                        description = "Optional provider configuration JSON.",
                        example = "{\"timeoutSeconds\":60}",
                        nullable = true,
                        format = "json")
                String configuration) {}
