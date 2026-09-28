package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
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
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<Long> roleIds) {}
