package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.UserEventSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.UserEventSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.UserEventSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.UserEventSettingsRepository;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserEventSettingsService {

    static final long SETTINGS_ID = 1L;

    private final UserEventSettingsRepository repository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public UserEventSettingsDTO get() {
        return toDTO(entity());
    }

    @Transactional
    public UserEventSettingsDTO update(UserEventSettingsRequestDTO request) {
        UserEventSettingsEntity settings = entity();
        settings.setEventsEnabled(request.eventsEnabled());
        settings.getEventTypes().clear();
        settings.getEventTypes().addAll(request.eventTypes());
        settings.setEventsExpirationDays(request.eventsExpirationDays());
        auditEventService.record("user-events.settings.updated", "user-event-settings", "default");
        return toDTO(settings);
    }

    UserEventSettingsEntity entity() {
        return repository
                .findById(SETTINGS_ID)
                .orElseThrow(
                        () -> new IllegalStateException("User event settings are not initialized"));
    }

    private static UserEventSettingsDTO toDTO(UserEventSettingsEntity settings) {
        return new UserEventSettingsDTO(
                settings.isEventsEnabled(),
                Set.copyOf(settings.getEventTypes()),
                settings.getEventsExpirationDays());
    }
}
