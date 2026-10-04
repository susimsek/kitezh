package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Set;

@Schema(name = "AdminConsent", description = "OAuth2 consent granted by a user to a client.")
public record AdminConsentDTO(
        @Schema(
                        description = "Registered client identifier.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Human-readable client name.",
                        example = "Account Console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName,
        @Schema(
                        description = "User who granted consent.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String principalName,
        @Schema(
                        description = "Internal user identifier.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Long userId,
        @Schema(
                        description = "Scopes and authorities approved by the user.",
                        example = "[\"openid\", \"account-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<String> authorities,
        @Schema(
                        description = "Consent creation time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Last consent update time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant updatedAt) {}
