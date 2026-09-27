package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminClientRole", description = "Role scoped to one registered OAuth2 client.")
public record AdminClientRoleDTO(
        @Schema(
                        description = "Internal role identifier.",
                        example = "12",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long id,
        @Schema(
                        description = "OAuth2 client identifier that owns the role.",
                        example = "billing-api",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Client role name.",
                        example = "invoice.read",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String name,
        @Schema(
                        description = "Optional role description.",
                        example = "Read invoices.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String description) {}
