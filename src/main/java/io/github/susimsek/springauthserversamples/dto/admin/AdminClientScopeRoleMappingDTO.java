package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(
        name = "AdminClientScopeRoleMappings",
        description = "Application and client roles allowed by a client scope.")
public record AdminClientScopeRoleMappingDTO(
        @Schema(
                        description = "Application-wide roles mapped to the scope.",
                        example = "[\"ROLE_USER\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> applicationRoles,
        @Schema(
                        description = "Client roles mapped to the scope.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<AdminClientRoleDTO> clientRoles) {}
