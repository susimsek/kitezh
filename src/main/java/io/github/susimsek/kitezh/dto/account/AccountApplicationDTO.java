package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Set;

@Schema(
        name = "AccountApplication",
        description = "An OAuth2/OIDC client authorized by the authenticated account.")
public record AccountApplicationDTO(
        @Schema(
                        description = "Registered client identifier.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Human-readable registered client name.",
                        example = "Account Console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName,
        @Schema(
                        description = "OAuth2 scopes currently granted to the client.",
                        example = "[\"openid\", \"account-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> scopes,
        @Schema(
                        description = "Instant at which the authorization was created.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Instant at which the authorization was last updated.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant updatedAt) {}
