package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AccountSessionClient",
        description = "Client associated with an authenticated browser session.")
public record AccountSessionClientDTO(
        @Schema(
                        description = "Registered client identifier.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Human-readable client name.",
                        example = "Account Console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName) {}
