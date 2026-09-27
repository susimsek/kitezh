package io.github.susimsek.springauthserversamples.dto.oauth;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(description = "A pending CIBA request awaiting the authenticated user's decision.")
public record CibaPendingRequestDTO(
        @Schema(
                        description = "Opaque CIBA request identifier.",
                        example = "ciba-auth-req-id",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String authReqId,
        @Schema(
                        description = "Short code shown to the user for request confirmation.",
                        example = "K7P4M2Q9",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String userCode,
        @Schema(
                        description = "Optional message supplied by the requesting client.",
                        example = "Approve sign in",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String bindingMessage,
        @Schema(
                        description = "Space-delimited scopes requested by the client.",
                        example = "openid profile",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String authorizedScopes,
        @Schema(
                        description = "CIBA delivery mode.",
                        example = "poll",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String deliveryMode,
        @Schema(
                        description = "Request creation time.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Request expiration time.",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant expiresAt,
        @Schema(
                        description = "Request state.",
                        example = "PENDING",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                CibaAuthenticationRequestStatus status,
        @Schema(
                        description = "Whether MFA is required before approval.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean mfaRequired,
        @Schema(
                        description = "Whether step-up authentication is required before approval.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean stepUpRequired) {}
