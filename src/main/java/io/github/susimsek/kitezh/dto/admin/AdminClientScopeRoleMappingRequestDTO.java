package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

@Schema(
        name = "AdminClientScopeRoleMappingRequest",
        description = "Complete application and client-role mappings for a client scope.")
public record AdminClientScopeRoleMappingRequestDTO(
        @Schema(
                        description = "Application-wide roles allowed by this client scope.",
                        example = "[\"ROLE_USER\", \"ROLE_REPORT_VIEWER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Set<String> applicationRoles,
        @Schema(
                        description = "Client-role identifiers allowed by this client scope.",
                        example = "[12, 18]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                Set<Long> clientRoleIds) {}
