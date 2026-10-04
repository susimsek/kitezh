package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Schema(
        name = "AdminClientScopeEvaluation",
        description = "Read-only client scope and token claim preview.")
public record AdminClientScopeEvaluationDTO(
        @Schema(description = "Requested scopes.", requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> requestedScopes,
        @Schema(
                        description = "Scopes effective for this client.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> effectiveScopes,
        @Schema(
                        description = "Configured mapper claims that may be emitted.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> mappedClaims,
        @Schema(
                        description = "Effective client roles for the subject.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> roles,
        @Schema(description = "Static preview claims.", requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, Object> claims) {}
