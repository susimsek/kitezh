package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.util.Locale;
import org.junit.jupiter.api.Test;

@SuppressWarnings("java:S5778")
class EmailConnectionTestServiceTest {

    private final EmailSettingsService emailSettingsService = mock(EmailSettingsService.class);
    private final MailService mailService = mock(MailService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final EmailConnectionTestService service =
            new EmailConnectionTestService(emailSettingsService, mailService, userRepository);

    @Test
    void sendsTestMessageToAuthenticatedAdministrator() {
        UserEntity administrator = new UserEntity();
        administrator.setEmail("admin@example.com");
        AdminEmailSettingsRequestDTO request = request();
        var configuration =
                new EmailSettingsService.EmailConfiguration(
                        true,
                        request.fromAddress(),
                        request.baseUrl(),
                        request.host(),
                        request.port(),
                        request.username(),
                        request.password(),
                        request.smtpAuth(),
                        request.starttls(),
                        request.ssl());
        when(userRepository.findByUsername("admin"))
                .thenReturn(java.util.Optional.of(administrator));
        when(emailSettingsService.configuration(request)).thenReturn(configuration);

        service.test(request, "admin", Locale.ENGLISH);

        verify(mailService).testConnection(configuration, "admin@example.com", Locale.ENGLISH);
    }

    @Test
    void rejectsAdministratorWithoutEmail() {
        UserEntity administrator = new UserEntity();
        when(userRepository.findByUsername("admin"))
                .thenReturn(java.util.Optional.of(administrator));

        assertThatThrownBy(() -> service.test(request(), "admin", Locale.ENGLISH))
                .isInstanceOf(ApiException.class);
    }

    private static AdminEmailSettingsRequestDTO request() {
        return new AdminEmailSettingsRequestDTO(
                true,
                "no-reply@example.com",
                "https://example.com",
                "smtp.example.com",
                587,
                "smtp-user",
                "secret",
                true,
                true,
                false);
    }
}
