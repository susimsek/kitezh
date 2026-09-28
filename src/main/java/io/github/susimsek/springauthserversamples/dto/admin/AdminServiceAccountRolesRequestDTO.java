package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

@Schema(
        name = "AdminServiceAccountRolesRequest",
        description = "Complete service-account client-role assignment.")
public record AdminServiceAccountRolesRequestDTO(
        @NotNull
                @Schema(
                        description = "Client role identifiers to assign.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotNull Long> roleIds) {}
