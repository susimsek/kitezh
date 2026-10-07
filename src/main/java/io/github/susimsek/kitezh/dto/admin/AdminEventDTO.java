package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

@Schema(name = "AdminEvent", description = "Administrative audit event.")
public record AdminEventDTO(
        @Schema(
                        description = "Audit event identifier.",
                        example = "evt-20260904-0001",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String id,
        @Schema(
                        description = "Username that performed the action.",
                        example = "admin",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String actor,
        @Schema(
                        description = "Stable action name.",
                        example = "user.updated",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String action,
        @Schema(
                        description = "Type of resource affected.",
                        example = "user",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String targetType,
        @Schema(
                        description = "Identifier of the affected resource.",
                        example = "2",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                String targetId,
        @Schema(
                        description = "Optional structured context for the audit event.",
                        example = "actor=admin;targetUsername=user;result=success",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                String details,
        @Schema(
                        description = "Time at which the event occurred.",
                        example = "2026-09-04T08:30:00Z",
                        format = "date-time",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Instant occurredAt) {}
