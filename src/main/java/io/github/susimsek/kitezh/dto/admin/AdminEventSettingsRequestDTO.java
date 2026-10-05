package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@Schema(name = "AdminEventSettingsRequest", description = "Updated administrative audit settings.")
public record AdminEventSettingsRequestDTO(
        @Schema(
                        description = "Whether event recording is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean eventsEnabled,
        @Schema(
                        description = "Whether administrative audit events are recorded.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean adminEventsEnabled,
        @Schema(
                        description = "Whether event details are retained.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean adminEventsDetailsEnabled,
        @Schema(
                        description =
                                "Number of days to retain events; zero keeps events indefinitely.",
                        example = "30",
                        minimum = "0",
                        maximum = "3650",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(value = 0, message = "{app.api.problem.violation.min}")
                @Max(value = 3650, message = "{app.api.problem.violation.max}")
                int eventsExpirationDays) {}
