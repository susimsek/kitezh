package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.kitezh.service.EmailConnectionTestService;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

class AdminEmailSettingsControllerTest {

    private final EmailSettingsService emailSettingsService = mock(EmailSettingsService.class);
    private final EmailConnectionTestService connectionTestService =
            mock(EmailConnectionTestService.class);
    private final AdminEmailSettingsController controller =
            new AdminEmailSettingsController(emailSettingsService, connectionTestService);

    @Test
    void testsConnectionUsingAuthenticatedAdministrator() {
        Authentication authentication = mock(Authentication.class);
        AdminEmailSettingsRequestDTO request =
                new AdminEmailSettingsRequestDTO(
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
        when(authentication.getName()).thenReturn("admin");

        var response = controller.testConnection(request, authentication, Locale.ENGLISH);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(connectionTestService).test(request, "admin", Locale.ENGLISH);
    }
}
