package io.github.susimsek.springauthserversamples.service.account;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.UserAction;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.mapper.AccountRegistrationMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import io.github.susimsek.springauthserversamples.service.EmailSettingsService;
import io.github.susimsek.springauthserversamples.service.LdapFederationWriteService;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.PasswordService;
import java.util.Locale;
import org.mapstruct.factory.Mappers;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
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

    @org.springframework.beans.factory.annotation.Autowired
    public AccountRegistrationService(
            UserRepository userRepository,
            AuthorityRepository authorityRepository,
            PasswordService passwordService,
            UserActionService userActionService,
            AdminAuditEventService auditEventService,
            ApplicationProperties applicationProperties,
            EmailSettingsService emailSettingsService,
            LoginSettingsService loginSettingsService,
            AccountRegistrationMapper accountRegistrationMapper,
            LdapFederationWriteService ldapFederationWriteService) {
        this.userRepository = userRepository;
        this.authorityRepository = authorityRepository;
        this.passwordService = passwordService;
        this.userActionService = userActionService;
        this.auditEventService = auditEventService;
        this.applicationProperties = applicationProperties;
        this.emailSettingsService = emailSettingsService;
        this.loginSettingsService = loginSettingsService;
        this.accountRegistrationMapper = accountRegistrationMapper;
        this.ldapFederationWriteService = ldapFederationWriteService;
    }

    public AccountRegistrationService(
            UserRepository userRepository,
            AuthorityRepository authorityRepository,
            PasswordService passwordService,
            UserActionService userActionService,
            AdminAuditEventService auditEventService,
            ApplicationProperties applicationProperties,
            EmailSettingsService emailSettingsService,
            LoginSettingsService loginSettingsService) {
        this(
                userRepository,
                authorityRepository,
                passwordService,
                userActionService,
                auditEventService,
                applicationProperties,
                emailSettingsService,
                loginSettingsService,
                Mappers.getMapper(AccountRegistrationMapper.class),
                null);
    }

    public AccountRegistrationService(
            UserRepository userRepository,
            AuthorityRepository authorityRepository,
            PasswordService passwordService,
            UserActionService userActionService,
            AdminAuditEventService auditEventService,
            ApplicationProperties applicationProperties) {
        this(
                userRepository,
                authorityRepository,
                passwordService,
                userActionService,
                auditEventService,
                applicationProperties,
                null,
                null);
    }

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
