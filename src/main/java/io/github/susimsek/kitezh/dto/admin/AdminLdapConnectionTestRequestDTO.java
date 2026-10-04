package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

@Schema(name = "AdminLdapConnectionTestRequest", description = "LDAP connection test request.")
public record AdminLdapConnectionTestRequestDTO(
        @Schema(
                        description = "Provider configuration to test.",
                        example =
                                "{\"name\":\"Corporate"
                                        + " AD\",\"connectionUrl\":\"ldaps://ad.example.com:636\"}",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull
                @Valid
                AdminLdapProviderRequestDTO provider) {}
