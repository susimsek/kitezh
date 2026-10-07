package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.UserEventType;
import java.time.Instant;

public record UserEventSearchCriteria(
        String query,
        UserEventType type,
        String username,
        String clientId,
        String ipAddress,
        Instant from,
        Instant to) {}
