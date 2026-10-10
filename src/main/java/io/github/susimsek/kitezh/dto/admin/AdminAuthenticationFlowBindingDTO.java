package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminAuthenticationFlowBinding",
        description = "Application-wide authentication entry-point binding.")
public record AdminAuthenticationFlowBindingDTO(
        @Schema(
                        description = "Authentication entry point.",
                        example = "BROWSER",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                AuthenticationFlowBindingType bindingType,
        @Schema(description = "Bound top-level flow identifier.", example = "1", nullable = true)
                Long flowId,
        @Schema(description = "Bound flow alias.", example = "browser", nullable = true)
                String flowAlias,
        @Schema(description = "Bound flow name.", example = "Browser", nullable = true)
                String flowName) {}
