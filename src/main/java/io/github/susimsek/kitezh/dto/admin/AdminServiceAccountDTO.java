package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;
import java.util.Set;

@Schema(
        name = "AdminServiceAccount",
        description = "Client service-account identity and role assignments.")
public record AdminServiceAccountDTO(
        @Schema(
                        description = "Service-account user identifier.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Service-account username.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Direct and effective client role names.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> roles,
        @Schema(
                        description = "Direct client role identifiers.",
                        example = "[1, 2]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<Long> roleIds,
        @Schema(
                        description =
                                "Direct application-role names assigned to the service account.",
                        example = "[\"ROLE_REPORTS\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> applicationRoles,
        @Schema(
                        description = "Effective client roles grouped by public client ID.",
                        example = "{\"demo-client\":[\"orders.read\"]}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Map<String, Set<String>> clientRoles) {}
