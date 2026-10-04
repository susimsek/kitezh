package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Tests the current SMTP form values by sending a message to the authenticated administrator. */
@Service
@RequiredArgsConstructor
public class EmailConnectionTestService {

    private final EmailSettingsService emailSettingsService;
    private final MailService mailService;
    private final UserRepository userRepository;

    public void test(AdminEmailSettingsRequestDTO request, String username, Locale locale) {
        UserEntity administrator =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> ApiException.notFound("Administrator not found"));
        String recipient = administrator.getEmail();
        if (recipient == null || recipient.isBlank()) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_EMAIL_REQUIRED,
                    "The administrator must have an email address");
        }
        mailService.testConnection(emailSettingsService.configuration(request), recipient, locale);
    }
}
