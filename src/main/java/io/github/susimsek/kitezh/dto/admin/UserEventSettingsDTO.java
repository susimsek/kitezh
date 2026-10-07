package io.github.susimsek.kitezh.dto.admin;

import io.github.susimsek.kitezh.domain.UserEventType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Set;

@Schema(name = "UserEventSettings", description = "User authentication event recording settings.")
public record UserEventSettingsDTO(
        @Schema(
                        description = "Whether user event recording is enabled.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean eventsEnabled,
        @Schema(
                        description = "User event types retained by the server.",
                        example = "[\"LOGIN_SUCCESS\",\"LOGIN_FAILURE\"]",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                Set<UserEventType> eventTypes,
        @Schema(
                        description =
                                "Number of days to retain user events; zero keeps them"
                                        + " indefinitely.",
                        example = "30",
                        minimum = "0",
                        maximum = "3650",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                int eventsExpirationDays) {}
