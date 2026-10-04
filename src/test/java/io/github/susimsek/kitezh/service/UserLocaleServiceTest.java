package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class UserLocaleServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private LocalizationSettingsService localizationSettingsService;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void storesAndReadsTheAuthenticatedUsersLocale() {
        UserEntity user = user();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(localizationSettingsService.isInternationalizationEnabled()).thenReturn(true);
        when(localizationSettingsService.isSupported(Locale.of("tr"))).thenReturn(true);

        assertThat(service().update("alice", "TR").locale()).isEqualTo("tr");
        assertThat(service().get("alice").locale()).isEqualTo("tr");
        verify(auditEventService).record("account.locale.updated", "user", "7");
    }

    @Test
    void rejectsLocalesDisabledByApplicationSettings() {
        when(localizationSettingsService.isInternationalizationEnabled()).thenReturn(false);

        assertThatThrownBy(() -> service().update("alice", "tr")).isInstanceOf(ApiException.class);
    }

    private UserLocaleService service() {
        return new UserLocaleService(
                userRepository, localizationSettingsService, auditEventService);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        return user;
    }
}
