package io.github.susimsek.springauthserversamples.service.account;

import io.github.susimsek.springauthserversamples.domain.UserAction;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.account.AccountProfileDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountProfileRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AccountProfileMapper;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.LdapFederationWriteService;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.PasswordService;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountProfileService {

    private static final String CURRENT_PASSWORD_FIELD = "currentPassword";

    private final UserRepository userRepository;
    private final AccountProfileMapper accountProfileMapper;
    private final PasswordService passwordService;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final UserActionService userActionService;
    private final LoginSettingsService loginSettingsService;
    private final LdapFederationWriteService ldapFederationWriteService;

    @Autowired
    public AccountProfileService(
            UserRepository userRepository,
            AccountProfileMapper accountProfileMapper,
            PasswordService passwordService,
            AdminAuditEventService auditEventService,
            UserAccessInvalidationService userAccessInvalidationService,
            UserActionService userActionService,
            LoginSettingsService loginSettingsService,
            LdapFederationWriteService ldapFederationWriteService) {
        this.userRepository = userRepository;
        this.accountProfileMapper = accountProfileMapper;
        this.passwordService = passwordService;
        this.auditEventService = auditEventService;
        this.userAccessInvalidationService = userAccessInvalidationService;
        this.userActionService = userActionService;
        this.loginSettingsService = loginSettingsService;
        this.ldapFederationWriteService = ldapFederationWriteService;
    }

    @Transactional(readOnly = true)
    public AccountProfileDTO profile(String username) {
        return accountProfileMapper.toDTO(requireUser(username));
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, key = "#username")
    public AccountProfileDTO updateProfile(String username, AccountProfileRequestDTO request) {
        return updateProfileInternal(username, request, Instant.now());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, key = "#username")
    public AccountProfileDTO updateProfile(
            String username, AccountProfileRequestDTO request, Instant authenticationTime) {
        return updateProfileInternal(username, request, authenticationTime);
    }

    private AccountProfileDTO updateProfileInternal(
            String username, AccountProfileRequestDTO request, Instant authenticationTime) {
        UserEntity user = requireUser(username);
        AccountProfileRequestDTO normalized = accountProfileMapper.normalize(request);
        String email = normalized.email();
        if (email != null && userRepository.existsByEmailIgnoreCaseAndIdNot(email, user.getId())) {
            throw ApiException.conflict(
                    "email", ApiErrorCode.USER_DUPLICATE_EMAIL, "Email is already registered");
        }
        boolean emailChanged = !java.util.Objects.equals(user.getEmail(), email);
        if (emailChanged) {
            requireRecentAuthentication(user, normalized.currentPassword(), authenticationTime);
            writeLdapProfile(user, email, normalized.firstName(), normalized.lastName());
            accountProfileMapper.updateNames(normalized, user);
            user.setPendingEmail(email);
            user.setEmailVerified(false);
            userActionService.invalidateActions(user.getId());
            userActionService.executeActionsEmail(
                    user.getId(), UserAction.UPDATE_EMAIL, null, java.util.Locale.ENGLISH);
        } else {
            writeLdapProfile(user, email, normalized.firstName(), normalized.lastName());
            accountProfileMapper.updateEntity(normalized, user);
        }
        userRepository.save(user);
        auditEventService.record("account.profile.updated", "user", user.getId().toString());
        return accountProfileMapper.toDTO(user);
    }

    private void writeLdapProfile(
            UserEntity user, String email, String firstName, String lastName) {
        ldapFederationWriteService.updateProfile(
                user, user.getUsername(), email, firstName, lastName);
    }

    private void requireRecentAuthentication(
            UserEntity user, String currentPassword, Instant authenticationTime) {
        Duration maxAge =
                loginSettingsService == null
                        ? Duration.ofDays(365_000)
                        : loginSettingsService.emailUpdateReauthenticationAge();
        Instant authenticatedAt = authenticationTime == null ? Instant.EPOCH : authenticationTime;
        boolean expired =
                maxAge.isZero()
                        || authenticatedAt.equals(Instant.EPOCH)
                        || authenticatedAt.plus(maxAge).isBefore(Instant.now());
        if (!expired) {
            return;
        }
        if (currentPassword == null || currentPassword.isBlank()) {
            throw ApiException.forbidden(
                    CURRENT_PASSWORD_FIELD,
                    ApiErrorCode.REAUTHENTICATION_REQUIRED,
                    "Re-authentication is required before changing the email address");
        }
        if (!passwordService.matchesCurrentPassword(currentPassword, user)) {
            throw ApiException.badRequest(
                    CURRENT_PASSWORD_FIELD,
                    ApiErrorCode.INVALID_CURRENT_PASSWORD,
                    "Current password is invalid");
        }
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, key = "#username")
    public void changePassword(String username, String currentPassword, String newPassword) {
        UserEntity user = requireUser(username);
        boolean ldapPasswordChanged =
                ldapFederationWriteService.changePassword(user, currentPassword, newPassword);
        if (!ldapPasswordChanged
                && !passwordService.matchesCurrentPassword(currentPassword, user)) {
            throw ApiException.badRequest(
                    CURRENT_PASSWORD_FIELD,
                    ApiErrorCode.INVALID_CURRENT_PASSWORD,
                    "Current password is incorrect");
        }
        passwordService.changePassword(user, newPassword);
        userActionService.invalidateActions(user.getId());
        userRepository.save(user);
        userAccessInvalidationService.invalidate(username);
        auditEventService.record("account.password.updated", "user", user.getId().toString());
    }

    @Transactional
    public void sendVerificationEmail(String username, java.util.Locale locale) {
        userActionService.sendForCurrentUser(username, UserAction.VERIFY_EMAIL, locale);
    }

    private UserEntity requireUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }
}
