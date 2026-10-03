package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.EmailSettingsEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.EmailSettingsMapper;
import io.github.susimsek.springauthserversamples.repository.EmailSettingsRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class EmailSettingsServiceTest {

    private final EmailSettingsRepository repository = mock(EmailSettingsRepository.class);
    private final AdminAuditEventService audit = mock(AdminAuditEventService.class);
    private final EmailSettingsEntity settings = settings();
    private final EmailSettingsService service =
            new EmailSettingsService(
                    repository, audit, Mappers.getMapper(EmailSettingsMapper.class));

    @BeforeEach
    void setUp() {
        when(repository.findById(1L)).thenReturn(Optional.of(settings));
    }

    @Test
    void returnsPublicSettingsAndCurrentConfiguration() {
        assertThat(service.get().passwordConfigured()).isTrue();
        assertThat(service.current().username()).isEqualTo("smtp-user");
        assertThat(service.current().password()).isEqualTo("stored-password");
    }

    @Test
    void buildsConfigurationWithRetainedOrReplacementPassword() {
        var retained = service.configuration(request(null, "  smtp.example.com  "));
        assertThat(retained.host()).isEqualTo("smtp.example.com");
        assertThat(retained.username()).isEqualTo("smtp-user");
        assertThat(retained.password()).isEqualTo("stored-password");

        var replacement = service.configuration(request("new-password", "host"));
        assertThat(replacement.password()).isEqualTo("new-password");
        var blankUsername = service.configuration(request(" ", "host", " "));
        assertThat(blankUsername.password()).isEqualTo("stored-password");
        assertThat(blankUsername.username()).isNull();
    }

    @Test
    void updatesAndAuditsSettingsAndRejectsMissingBootstrapData() {
        service.update(request("new-password", "host"));
        assertThat(settings.getPassword()).isEqualTo("new-password");
        verify(repository).save(settings);
        verify(audit).record("email.settings.updated", "email-settings", "default");

        when(repository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(service::get)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not initialized");
    }

    private static EmailSettingsEntity settings() {
        var value = new EmailSettingsEntity();
        value.setId(1L);
        value.setEnabled(true);
        value.setFromAddress("no-reply@example.com");
        value.setBaseUrl("https://example.com");
        value.setHost("smtp.example.com");
        value.setPort(587);
        value.setUsername("smtp-user");
        value.setPassword("stored-password");
        value.setSmtpAuth(true);
        value.setStarttls(true);
        return value;
    }

    private static AdminEmailSettingsRequestDTO request(String password, String host) {
        return request(password, host, " smtp-user ");
    }

    private static AdminEmailSettingsRequestDTO request(
            String password, String host, String username) {
        return new AdminEmailSettingsRequestDTO(
                true,
                "  no-reply@example.com  ",
                " https://example.com ",
                host,
                587,
                username,
                password,
                true,
                true,
                false);
    }
}
