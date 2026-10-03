package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.EmailSettingsEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminEmailSettingsDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminEmailSettingsRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.EmailSettingsMapper;
import io.github.susimsek.springauthserversamples.repository.EmailSettingsRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @Autowired)
public class EmailSettingsService {
    private static final long SETTINGS_ID = 1L;
    private final EmailSettingsRepository repository;
    private final AdminAuditEventService auditEventService;
    private final EmailSettingsMapper emailSettingsMapper;

    public EmailSettingsService(
            EmailSettingsRepository repository, AdminAuditEventService auditEventService) {
        this(repository, auditEventService, null);
    }

    @Transactional(readOnly = true)
    public AdminEmailSettingsDTO get() {
        EmailSettingsEntity e = entity();
        return emailSettingsMapper.toDTO(e);
    }

    @Transactional(readOnly = true)
    public EmailConfiguration current() {
        EmailSettingsEntity e = entity();
        return new EmailConfiguration(
                e.isEnabled(),
                e.getFromAddress(),
                e.getBaseUrl(),
                e.getHost(),
                e.getPort(),
                e.getUsername(),
                e.getPassword(),
                e.isSmtpAuth(),
                e.isStarttls(),
                e.isSsl());
    }

    @Transactional(readOnly = true)
    public EmailConfiguration configuration(AdminEmailSettingsRequestDTO request) {
        EmailSettingsEntity current = entity();
        String password =
                request.password() == null || request.password().isBlank()
                        ? current.getPassword()
                        : request.password();
        return new EmailConfiguration(
                request.enabled(),
                request.fromAddress().trim(),
                request.baseUrl().trim(),
                request.host().trim(),
                request.port(),
                trimToNull(request.username()),
                password,
                request.smtpAuth(),
                request.starttls(),
                request.ssl());
    }

    @Transactional
    @CacheEvict(cacheNames = EmailSettingsRepository.EMAIL_SETTINGS_BY_ID_CACHE, allEntries = true)
    public AdminEmailSettingsDTO update(AdminEmailSettingsRequestDTO request) {
        EmailSettingsEntity e = entity();
        emailSettingsMapper.update(request, e);
        if (request.password() != null && !request.password().isBlank()) {
            e.setPassword(request.password());
        }
        repository.save(e);
        auditEventService.record("email.settings.updated", "email-settings", "default");
        return emailSettingsMapper.toDTO(e);
    }

    private EmailSettingsEntity entity() {
        return repository
                .findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("Email settings are not initialized"));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record EmailConfiguration(
            boolean enabled,
            String fromAddress,
            String baseUrl,
            String host,
            int port,
            String username,
            String password,
            boolean smtpAuth,
            boolean starttls,
            boolean ssl) {}
}
