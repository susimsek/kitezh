package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.UserEventType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "UserEvent", description = "Immutable user authentication event.")
public record UserEventDTO(
        @Schema(
                        description = "Event identifier.",
                        example = "evt-20260904-0001",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Internal user identifier when the account exists.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                Long userId,
        @Schema(
                        description = "Username submitted or authenticated.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String username,
        @Schema(
                        description = "User authentication event type.",
                        example = "LOGIN_SUCCESS",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                UserEventType type,
        @Schema(
                        description = "OAuth client identifier when available.",
                        example = "account-console",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String clientId,
        @Schema(
                        description = "Source IP address.",
                        example = "192.0.2.10",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String ipAddress,
        @Schema(
                        description = "Time at which the event occurred.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant occurredAt) {}
