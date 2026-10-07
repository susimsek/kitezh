package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEventSettingsEntity;
import io.github.susimsek.kitezh.domain.UserEventType;
import io.github.susimsek.kitezh.dto.admin.UserEventSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.UserEventSettingsRepository;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class UserEventSettingsServiceTest {

    private final UserEventSettingsRepository repository = mock(UserEventSettingsRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final UserEventSettingsService service =
            new UserEventSettingsService(repository, auditEventService);

    @Test
    void returnsAndUpdatesUserEventSettings() {
        UserEventSettingsEntity entity = settings();
        when(repository.findById(1L)).thenReturn(Optional.of(entity));
        UserEventSettingsRequestDTO request =
                new UserEventSettingsRequestDTO(false, Set.of(UserEventType.LOGIN_FAILURE), 30);

        assertThat(service.get().eventTypes())
                .containsExactlyInAnyOrder(
                        UserEventType.LOGIN_SUCCESS, UserEventType.LOGIN_FAILURE);
        assertThat(service.update(request))
                .satisfies(
                        value -> {
                            assertThat(value.eventsEnabled()).isFalse();
                            assertThat(value.eventTypes())
                                    .containsExactly(UserEventType.LOGIN_FAILURE);
                            assertThat(value.eventsExpirationDays()).isEqualTo(30);
                        });
        verify(auditEventService)
                .record("user-events.settings.updated", "user-event-settings", "default");
    }

    private static UserEventSettingsEntity settings() {
        UserEventSettingsEntity entity = new UserEventSettingsEntity();
        entity.setId(1L);
        entity.setEventsEnabled(true);
        entity.setEventTypes(
                new HashSet<>(Set.of(UserEventType.LOGIN_SUCCESS, UserEventType.LOGIN_FAILURE)));
        entity.setEventsExpirationDays(0);
        return entity;
    }
}
