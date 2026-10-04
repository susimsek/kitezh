package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminSession", description = "Browser session visible to administrators.")
public record AdminSessionDTO(
        @Schema(
                        description = "Opaque session identifier.",
                        example = "6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Authenticated username.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Session creation time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Most recent access time.",
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
                        description = "Number of OAuth2 authorizations in the session.",
                        example = "2",
                        format = "int64",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                long authorizationCount,
        @Schema(
                        description = "Whether the session is currently active.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean active) {

    public AdminSessionDTO(
            String id,
            String username,
            Instant createdAt,
            Instant lastAccessedAt,
            Instant expiresAt,
            long authorizationCount) {
        this(id, username, createdAt, lastAccessedAt, expiresAt, authorizationCount, true);
    }
}
