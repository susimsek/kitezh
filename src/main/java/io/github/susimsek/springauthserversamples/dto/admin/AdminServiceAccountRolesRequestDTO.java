package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

@Schema(
        name = "AdminServiceAccountRolesRequest",
        description = "Complete service-account application and client-role assignment.")
public record AdminServiceAccountRolesRequestDTO(
        @NotNull
                @Schema(
                        description = "Client role identifiers to assign.",
                        example = "[1, 2]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<@NotNull Long> roleIds,
        @Schema(
                        description = "Application-role names to assign.",
                        example = "[\"ROLE_REPORTS\"]",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED,
                        nullable = true)
                Set<@NotBlank String> applicationRoles) {

    public AdminServiceAccountRolesRequestDTO(Set<Long> roleIds) {
        this(roleIds, Set.of());
    }
}
