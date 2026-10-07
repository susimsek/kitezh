package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOrganizationDomain", description = "A domain associated with an organization.")
public record AdminOrganizationDomainDTO(
        @Schema(
                        description = "Domain identifier.",
                        example = "1",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "Lowercase domain name.",
                        example = "acme.com",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String domain) {}
