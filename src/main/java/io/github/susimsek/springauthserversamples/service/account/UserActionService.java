package io.github.susimsek.springauthserversamples.service.account;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.UserAction;
import io.github.susimsek.springauthserversamples.domain.UserActionTokenEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.mapper.AccountActionTokenMapper;
import io.github.susimsek.springauthserversamples.repository.UserActionTokenRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.EmailSettingsService;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.PasswordService;
import io.github.susimsek.springauthserversamples.service.security.TotpService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
@SuppressWarnings("java:S6829")
public class UserActionService {

    private static final String ACTION_TOKEN_INVALID_MESSAGE = "Action token is invalid";
    public static final long DEFAULT_LIFESPAN_SECONDS = Duration.ofHours(12).toSeconds();
    private static final long MIN_LIFESPAN_SECONDS = 60;
    private static final long MAX_LIFESPAN_SECONDS = Duration.ofDays(1).toSeconds();
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);

    private final UserRepository userRepository;
    private final UserActionTokenRepository tokenRepository;
    private final PasswordService passwordService;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService auditEventService;
    private final ApplicationEventPublisher eventPublisher;
    private final ApplicationProperties applicationProperties;
    private final EmailSettingsService emailSettingsService;
    private final AccountActionTokenMapper accountActionTokenMapper;
    private final LoginSettingsService loginSettingsService;
    private final TotpService totpService;
    private final SecureRandom secureRandom = new SecureRandom();

    public UserActionService(
            UserRepository userRepository,
            UserActionTokenRepository tokenRepository,
            PasswordService passwordService,
            UserAccessInvalidationService userAccessInvalidationService,
            AdminAuditEventService auditEventService,
            ApplicationEventPublisher eventPublisher,
            ApplicationProperties applicationProperties,
            EmailSettingsService emailSettingsService) {
        this(
                userRepository,
                tokenRepository,
                passwordService,
                userAccessInvalidationService,
                auditEventService,
                eventPublisher,
                applicationProperties,
                emailSettingsService,
                null,
                null,
                null);
    }

    public UserActionService(
            UserRepository userRepository,
            UserActionTokenRepository tokenRepository,
            PasswordService passwordService,
            UserAccessInvalidationService userAccessInvalidationService,
            AdminAuditEventService auditEventService,
            ApplicationEventPublisher eventPublisher,
            ApplicationProperties applicationProperties) {
        this(
                userRepository,
                tokenRepository,
                passwordService,
                userAccessInvalidationService,
                auditEventService,
                eventPublisher,
                applicationProperties,
                null);
    }

    @Transactional
    public void forgotPassword(String identifier, Locale locale) {
        if (identifier == null || identifier.isBlank() || !mailEnabled()) {
            return;
        }
        findByIdentifier(identifier.trim())
                .ifPresent(id -> issue(id, UserAction.UPDATE_PASSWORD, locale, null, true));
    }

    @Transactional
    public void sendForCurrentUser(String username, UserAction action, Locale locale) {
        Long id =
                userRepository
                        .findIdByUsername(username)
                        .orElseThrow(() -> ApiException.notFound("User not found"));
        issue(id, action, locale, null, false);
    }

    @Transactional
    public void executeActionsEmail(
            Long userId, UserAction action, Long lifespanSeconds, Locale locale) {
        issue(userId, action, locale, lifespanSeconds, false);
    }

    @Transactional
    public void invalidateActions(Long userId) {
        tokenRepository.deleteByUserId(userId);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void verifyEmail(String rawToken) {
        UserActionTokenEntity token = requireToken(rawToken, UserAction.VERIFY_EMAIL);
        token.getUser().setEmailVerified(true);
        consume(token);
        auditEventService.record("user.email.verified", "user", token.getUser().getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void confirmEmailChange(String rawToken) {
        UserActionTokenEntity token = requireToken(rawToken, UserAction.UPDATE_EMAIL);
        UserEntity user = token.getUser();
        user.setEmail(user.getPendingEmail());
        user.setPendingEmail(null);
        user.setEmailVerified(true);
        consume(token);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("user.email.changed", "user", user.getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void resetPassword(String rawToken, String newPassword) {
        resetPasswordInternal(rawToken, newPassword, null);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void resetPassword(String rawToken, String newPassword, String otpCode) {
        resetPasswordInternal(rawToken, newPassword, otpCode);
    }

    private void resetPasswordInternal(String rawToken, String newPassword, String otpCode) {
        if (newPassword == null || newPassword.length() < 12 || newPassword.length() > 128) {
            throw ApiException.badRequest(
                    "newPassword", ApiErrorCode.INVALID_PASSWORD, "Password is invalid");
        }
        UserActionTokenEntity token = requireToken(rawToken, UserAction.UPDATE_PASSWORD);
        UserEntity user = token.getUser();
        validateResetOtp(user, otpCode);
        passwordService.changePassword(user, newPassword);
        consume(token);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("user.password.reset", "user", user.getId().toString());
    }

    private void issue(
            Long userId,
            UserAction action,
            Locale locale,
            Long requestedLifespan,
            boolean suppressCooldown) {
        if (!mailEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_EMAIL_UNAVAILABLE, "Email delivery is not configured");
        }
        UserEntity user = lockUser(userId);
        if (!user.isEnabled()) {
            if (suppressCooldown) {
                return;
            }
            throw ApiException.badRequest(ApiErrorCode.USER_PROTECTED, "User is disabled");
        }
        String email =
                normalizeEmail(
                        action == UserAction.UPDATE_EMAIL
                                ? user.getPendingEmail()
                                : user.getEmail());
        if (email == null) {
            if (suppressCooldown) {
                return;
            }
            throw ApiException.badRequest(
                    "email", ApiErrorCode.ACTION_EMAIL_REQUIRED, "User has no email address");
        }
        Instant now = Instant.now();
        Optional<UserActionTokenEntity> latest =
                tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(user.getId(), action);
        Duration resendCooldown = resetResendCooldown(action);
        if (latest.isPresent() && latest.get().getIssuedAt().plus(resendCooldown).isAfter(now)) {
            if (suppressCooldown) {
                return;
            }
            throw ApiException.conflict(
                    ApiErrorCode.ACTION_EMAIL_COOLDOWN, "Please wait before resending the email");
        }
        final long lifespan = validateLifespan(requestedLifespan, action);
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        final String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        tokenRepository.deleteActive(user.getId(), action);
        UserActionTokenEntity token =
                accountActionTokenMapper.toEntity(
                        user,
                        action,
                        email,
                        hash(user.getPassword()),
                        hash(rawToken),
                        now,
                        now.plusSeconds(lifespan));
        tokenRepository.save(token);

        Locale supportedLocale =
                "tr".equals(locale.getLanguage()) ? Locale.forLanguageTag("tr") : Locale.ENGLISH;
        String route =
                switch (action) {
                    case VERIFY_EMAIL -> "verify-email";
                    case UPDATE_EMAIL -> "confirm-email";
                    case UPDATE_PASSWORD -> "reset-password";
                };
        String url =
                UriComponentsBuilder.fromUriString(baseUrl())
                        .pathSegment(route)
                        .queryParam("token", rawToken)
                        .build()
                        .toUriString();
        eventPublisher.publishEvent(
                new UserActionEmailEvent(action, email, user.getUsername(), supportedLocale, url));
        auditEventService.record(
                switch (action) {
                    case VERIFY_EMAIL -> "user.verify-email.sent";
                    case UPDATE_EMAIL -> "user.email-change.sent";
                    case UPDATE_PASSWORD -> "user.reset-password.sent";
                },
                "user",
                user.getId().toString());
    }

    private boolean mailEnabled() {
        return emailSettingsService == null
                ? applicationProperties.mail().enabled()
                : emailSettingsService.current().enabled();
    }

    private String baseUrl() {
        return emailSettingsService == null
                ? applicationProperties.mail().baseUrl()
                : emailSettingsService.current().baseUrl();
    }

    private UserActionTokenEntity requireToken(String rawToken, UserAction expectedAction) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_INVALID, ACTION_TOKEN_INVALID_MESSAGE);
        }
        String tokenHash = hash(rawToken);
        Long userId =
                tokenRepository
                        .findUserIdByTokenHash(tokenHash)
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.ACTION_TOKEN_INVALID,
                                                ACTION_TOKEN_INVALID_MESSAGE));
        // Always lock the user before the token, including issuance, to serialize competing
        // actions.
        final UserEntity user = lockUser(userId);
        UserActionTokenEntity token =
                tokenRepository
                        .findByTokenHash(tokenHash)
                        .orElseThrow(
                                () ->
                                        ApiException.badRequest(
                                                ApiErrorCode.ACTION_TOKEN_INVALID,
                                                ACTION_TOKEN_INVALID_MESSAGE));
        if (token.getAction() != expectedAction) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_INVALID, ACTION_TOKEN_INVALID_MESSAGE);
        }
        if (token.getConsumedAt() != null) {
            throw ApiException.conflict(ApiErrorCode.ACTION_TOKEN_USED, "Action token was used");
        }
        if (!token.getExpiresAt().isAfter(Instant.now())) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_EXPIRED, "Action token expired");
        }
        String expectedEmail =
                normalizeEmail(
                        expectedAction == UserAction.UPDATE_EMAIL
                                ? user.getPendingEmail()
                                : user.getEmail());
        if (!user.isEnabled()
                || !java.util.Objects.equals(token.getEmail(), expectedEmail)
                || !java.util.Objects.equals(
                        token.getCredentialFingerprint(), hash(user.getPassword()))) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_TOKEN_INVALID, ACTION_TOKEN_INVALID_MESSAGE);
        }
        return token;
    }

    private static void consume(UserActionTokenEntity token) {
        token.setConsumedAt(Instant.now());
    }

    private Optional<Long> findByIdentifier(String identifier) {
        return userRepository
                .findIdByUsername(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier).map(UserEntity::getId));
    }

    private UserEntity lockUser(Long id) {
        return userRepository
                .findForActionById(id)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private long validateLifespan(Long requested, UserAction action) {
        long value;
        if (requested != null) {
            value = requested;
        } else if (action == UserAction.UPDATE_PASSWORD) {
            value = resetTokenLifespanSeconds();
        } else {
            value = DEFAULT_LIFESPAN_SECONDS;
        }
        if (value < MIN_LIFESPAN_SECONDS || value > MAX_LIFESPAN_SECONDS) {
            throw ApiException.badRequest(
                    "lifespan",
                    ApiErrorCode.INVALID_REQUEST,
                    "Lifespan must be between 60 and 86400 seconds");
        }
        return value;
    }

    private Duration resetResendCooldown(UserAction action) {
        if (action == UserAction.UPDATE_PASSWORD && loginSettingsService != null) {
            return loginSettingsService.passwordResetResendCooldown();
        }
        return RESEND_COOLDOWN;
    }

    private long resetTokenLifespanSeconds() {
        if (loginSettingsService != null) {
            return loginSettingsService.passwordResetTokenLifespan().toSeconds();
        }
        return DEFAULT_LIFESPAN_SECONDS;
    }

    private void validateResetOtp(UserEntity user, String otpCode) {
        String mode =
                loginSettingsService == null ? "none" : loginSettingsService.passwordResetOtpMode();
        if (mode == null || mode.isBlank()) {
            mode = "none";
        }
        if ("none".equalsIgnoreCase(mode)) {
            return;
        }
        if (!user.isTotpEnabled() || user.getTotpSecret() == null) {
            if ("required".equalsIgnoreCase(mode)) {
                throw invalidResetOtp();
            }
            return;
        }
        if (otpCode == null || otpCode.isBlank() || totpService == null) {
            throw invalidResetOtp();
        }
        var matchingCounter =
                totpService.matchingCounter(
                        user.getTotpSecret(),
                        otpCode.trim(),
                        loginSettingsService.otpAlgorithm(),
                        loginSettingsService.otpDigits(),
                        loginSettingsService.otpPeriodSeconds(),
                        loginSettingsService.otpLookAheadWindow());
        if (matchingCounter.isEmpty()
                || (user.getTotpLastUsedCounter() != null
                        && matchingCounter.getAsLong() <= user.getTotpLastUsedCounter())) {
            throw invalidResetOtp();
        }
        user.setTotpLastUsedCounter(matchingCounter.getAsLong());
    }

    private static ApiException invalidResetOtp() {
        return ApiException.badRequest(
                "otpCode", ApiErrorCode.INVALID_TOTP_CODE, "The OTP code is invalid");
    }

    private static String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String hash(String token) {
        try {
            return java.util.HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
