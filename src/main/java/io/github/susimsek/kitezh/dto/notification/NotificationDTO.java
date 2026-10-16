package io.github.susimsek.kitezh.dto.notification;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "Notification", description = "A localized, privacy-safe durable notification.")
public record NotificationDTO(
        @Schema(
                        description = "Notification identifier.",
                        example = "9a418c80-2b43-4afe-977f-17ea426e8c80",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Shared localization message key.",
                        example = "notificationAccountMfaEnabled",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String messageKey,
        @Schema(
                        description = "Creation timestamp.",
                        example = "2026-10-12T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant createdAt,
        @Schema(
                        description = "Whether the authenticated user has read this notification.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean read) {}
