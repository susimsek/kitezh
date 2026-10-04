package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Set;

@Schema(
        name = "AdminScopeAssignments",
        description = "Client scope assignments and available scopes.")
public record AdminScopeAssignmentsDTO(
        @Schema(
                        description = "Scopes granted by default.",
                        example = "[\"openid\", \"admin-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> defaultScopes,
        @Schema(
                        description = "Scopes available for optional consent.",
                        example = "[\"profile\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> optionalScopes,
        @Schema(
                        description = "Scopes that can be assigned to the client.",
                        example = "[{\"id\":\"scope-123\",\"name\":\"account-api\"}]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AdminClientScopeDTO> availableScopes) {}
