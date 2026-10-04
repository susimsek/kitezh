package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "Stored external provider tokens for a linked social identity.")
public record SocialProviderTokenDTO(
        @Schema(
                        description = "Configured provider alias.",
                        example = "google",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String provider,
        @Schema(
                        description = "OAuth token type.",
                        example = "Bearer",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String tokenType,
        @Schema(
                        description = "External provider access token.",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String accessToken,
        @Schema(
                        description = "External provider refresh token, when issued.",
                        format = "password",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String refreshToken,
        @Schema(
                        description = "Access-token expiration time.",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Instant expiresAt,
        @Schema(
                        description = "Scopes granted by the external provider.",
                        example = "openid profile email",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String scopes) {}
