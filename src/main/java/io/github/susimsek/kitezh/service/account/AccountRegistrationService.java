package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.mapper.AccountRegistrationMapper;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import io.github.susimsek.kitezh.service.LdapFederationWriteService;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.PasswordService;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S6829")
public class AccountRegistrationService {

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordService passwordService;
    private final UserActionService userActionService;
    private final AdminAuditEventService auditEventService;
    private final ApplicationProperties applicationProperties;
    private final EmailSettingsService emailSettingsService;
    private final LoginSettingsService loginSettingsService;
    private final AccountRegistrationMapper accountRegistrationMapper;
    private final LdapFederationWriteService ldapFederationWriteService;

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void register(
            String username,
            String firstName,
            String lastName,
            String email,
            String password,
            String confirmPassword,
            Locale locale) {
        String normalizedUsername = username == null ? null : username.trim();
        final String normalizedEmail = normalizeEmail(email);
        if (normalizedUsername == null || normalizedUsername.isBlank()) {
            throw ApiException.badRequest(
                    "username", ApiErrorCode.USER_INVALID_USERNAME, "Username is required");
        }
        if (!java.util.Objects.equals(password, confirmPassword)) {
            throw ApiException.badRequest(
                    "confirmPassword", ApiErrorCode.PASSWORD_MISMATCH, "Passwords do not match");
        }
        if (userRepository.findByUsername(normalizedUsername).isPresent()) {
            throw ApiException.conflict(
                    "username",
                    ApiErrorCode.USER_DUPLICATE_USERNAME,
                    "Username is already registered");
        }
        if (normalizedEmail != null && userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw ApiException.conflict(
                    "email", ApiErrorCode.USER_DUPLICATE_EMAIL, "Email is already registered");
        }

        AuthorityEntity defaultRole =
                authorityRepository
                        .findByName(AuthoritiesConstants.USER)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "The default user authority is not configured"));
        UserEntity user =
                accountRegistrationMapper.toEntity(
                        normalizedUsername,
                        normalizeRequiredName(firstName),
                        normalizeRequiredName(lastName),
                        normalizedEmail,
                        null,
                        java.util.Set.of(defaultRole));
        passwordService.setInitialPassword(user, password);
        UserEntity saved = userRepository.save(user);
        if (ldapFederationWriteService != null) {
            ldapFederationWriteService.registerUser(saved, password);
        }
        auditEventService.record("user.registered", "user", saved.getId().toString());

        if (mailEnabled()
                && (loginSettingsService == null || loginSettingsService.isVerifyEmailEnabled())) {
            userActionService.sendForCurrentUser(
                    saved.getUsername(),
                    UserAction.VERIFY_EMAIL,
                    locale == null ? Locale.ENGLISH : locale);
        }
    }

    private boolean mailEnabled() {
        return emailSettingsService == null
                ? applicationProperties.mail().enabled()
                : emailSettingsService.current().enabled();
    }

    private static String normalizeRequiredName(String value) {
        return value == null ? null : value.trim();
    }

    private static String normalizeEmail(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }
}
