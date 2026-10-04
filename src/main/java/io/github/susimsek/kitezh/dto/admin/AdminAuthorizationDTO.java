package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(
        name = "AdminAuthorization",
        description = "OAuth2 authorization associated with a browser session.")
public record AdminAuthorizationDTO(
        @Schema(
                        description = "Authorization identifier.",
                        example = "5d8f2c10-4e2b-4c5b-9d7c-123456789abc",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
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
                        description = "OAuth2 grant type.",
                        example = "authorization_code",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String grantType,
        @Schema(
                        description = "Scopes granted by this authorization.",
                        example = "[\"openid\", \"account-api\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                List<String> scopes,
        @Schema(
                        description = "Access-token issue time.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant accessTokenIssuedAt,
        @Schema(
                        description = "Access-token expiration time.",
                        example = "2026-09-04T09:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant accessTokenExpiresAt,
        @Schema(
                        description = "Refresh-token expiration time.",
                        example = "2026-12-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant refreshTokenExpiresAt) {}
