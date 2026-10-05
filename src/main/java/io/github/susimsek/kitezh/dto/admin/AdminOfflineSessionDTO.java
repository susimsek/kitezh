package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminOfflineSession", description = "An offline OAuth2 refresh-token session.")
public record AdminOfflineSessionDTO(
        @Schema(
                        description = "Authorization identifier.",
                        example = "auth-123",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Username that owns the offline session.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "Registered client identifier.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientId,
        @Schema(
                        description = "Registered client name.",
                        example = "Account Console",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String clientName,
        @Schema(
                        description = "Refresh token issue time.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant issuedAt,
        @Schema(
                        description = "Refresh token expiration time.",
                        format = "date-time",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Instant expiresAt) {}
