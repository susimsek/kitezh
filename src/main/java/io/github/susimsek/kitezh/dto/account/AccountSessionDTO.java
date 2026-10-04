package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(name = "AccountSession", description = "One Spring Session-backed browser login.")
public record AccountSessionDTO(
        @Schema(
                        description = "Opaque session identifier.",
                        example = "6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Session creation time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Most recent session access time.",
                        example = "2026-09-04T09:00:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant lastAccessedAt,
        @Schema(
                        description = "Session expiration time.",
                        example = "2026-09-04T10:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt,
        @Schema(
                        description = "Whether this is the session used by the current request.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean current,
        @Schema(
                        description = "OAuth2 clients associated with this session.",
                        example =
                                "[{\"clientId\":\"account-console\",\"clientName\":\"Account"
                                        + " Console\"}]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<AccountSessionClientDTO> clients) {}
