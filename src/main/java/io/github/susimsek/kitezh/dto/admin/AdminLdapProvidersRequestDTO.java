package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

@Schema(name = "AdminLdapProvidersRequest", description = "LDAP federation providers.")
public record AdminLdapProvidersRequestDTO(
        @Schema(
                        description = "Configured application-wide providers.",
                        example = "[]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Size(max = 20)
                List<@Valid AdminLdapProviderRequestDTO> providers) {}
