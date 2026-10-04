package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

@Schema(
        name = "AdminClientScopeAssignmentRequest",
        description = "Complete default and optional scope assignments for a client.")
public record AdminClientScopeAssignmentRequestDTO(
        @Schema(
                        description = "Scopes granted by default.",
                        example = "[\"openid\", \"admin-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Set<@NotBlank(message = "{app.api.problem.violation.scope}") String> defaultScopes,
        @Schema(
                        description = "Scopes the client may request optionally.",
                        example = "[\"profile\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Set<@NotBlank(message = "{app.api.problem.violation.scope}") String>
                        optionalScopes) {}
