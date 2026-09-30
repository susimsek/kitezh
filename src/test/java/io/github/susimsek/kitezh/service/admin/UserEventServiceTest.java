package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEventEntity;
import io.github.susimsek.kitezh.domain.UserEventSettingsEntity;
import io.github.susimsek.kitezh.domain.UserEventType;
import io.github.susimsek.kitezh.dto.admin.UserEventDTO;
import io.github.susimsek.kitezh.mapper.UserEventMapper;
import io.github.susimsek.kitezh.repository.UserEventRepository;
import io.github.susimsek.kitezh.repository.UserEventSettingsRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

class UserEventServiceTest {

    private final UserEventRepository repository = mock(UserEventRepository.class);
    private final UserEventSettingsRepository settingsRepository =
            mock(UserEventSettingsRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserEventMapper mapper = mock(UserEventMapper.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final UserEventService service =
            new UserEventService(
                    repository, settingsRepository, userRepository, mapper, auditEventService);

    @Test
    void recordsEnabledConfiguredEventsAndExpiresOldRecords() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings(true, 30)));
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(mapper.toEntity(
                        any(String.class),
                        eq(7L),
                        eq("alice"),
                        eq(UserEventType.LOGIN_SUCCESS),
                        eq("admin-console"),
                        eq("192.0.2.10"),
                        any(Instant.class)))
                .thenReturn(new UserEventEntity());

        service.record(UserEventType.LOGIN_SUCCESS, "alice", "admin-console", "192.0.2.10");

        verify(repository).deleteByOccurredAtBefore(any(Instant.class));
        verify(repository).save(any(UserEventEntity.class));
    }

    @Test
    void skipsDisabledAndUnconfiguredEventTypes() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(settings(false, 0)));

        service.record(UserEventType.LOGIN_FAILURE, "alice", "192.0.2.10");

        verifyNoInteractions(repository, userRepository, mapper);
    }

    @Test
    void queriesEventsAndDeletesAllEvents() {
        PageRequest pageable = PageRequest.of(0, 20);
        UserEventEntity entity = new UserEventEntity();
        UserEventDTO dto =
                new UserEventDTO(
                        "event-1",
                        7L,
                        "alice",
                        UserEventType.LOGIN_FAILURE,
                        null,
                        "192.0.2.10",
                        Instant.EPOCH);
        when(repository.findAll(any(Specification.class), eq(pageable)))
                .thenReturn(
                        new org.springframework.data.domain.PageImpl<>(java.util.List.of(entity)));
        when(mapper.toDTO(entity)).thenReturn(dto);

        assertThat(
                        service.events(
                                        "alice",
                                        UserEventType.LOGIN_FAILURE,
                                        "alice",
                                        "admin-console",
                                        "192.0.2.10",
                                        null,
                                        null,
                                        pageable)
                                .getContent())
                .containsExactly(dto);
        service.deleteAll();

        verify(repository).deleteAllInBatch();
        verify(auditEventService).record("user-events.cleared", "user-event", "all");
    }

    private static UserEventSettingsEntity settings(boolean enabled, int expirationDays) {
        UserEventSettingsEntity settings = new UserEventSettingsEntity();
        settings.setEventsEnabled(enabled);
        settings.setEventTypes(Set.of(UserEventType.LOGIN_SUCCESS));
        settings.setEventsExpirationDays(expirationDays);
        return settings;
    }
}
