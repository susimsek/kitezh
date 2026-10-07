package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.UserEventType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

@Schema(
        name = "UserEventSettingsRequest",
        description = "Updated user authentication event settings.")
public record UserEventSettingsRequestDTO(
        @Schema(
                        description = "Whether user event recording is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean eventsEnabled,
        @Schema(
                        description =
                                "User event types retained by the server. An empty set disables all"
                                        + " event types.",
                        example = "[\"LOGIN_SUCCESS\",\"LOGIN_FAILURE\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotNull(message = "{app.api.problem.violation.required}")
                Set<UserEventType> eventTypes,
        @Schema(
                        description =
                                "Number of days to retain user events; zero keeps them"
                                        + " indefinitely.",
                        example = "30",
                        minimum = "0",
                        maximum = "3650",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(value = 0, message = "{app.api.problem.violation.min}")
                @Max(value = 3650, message = "{app.api.problem.violation.max}")
                int eventsExpirationDays) {}
