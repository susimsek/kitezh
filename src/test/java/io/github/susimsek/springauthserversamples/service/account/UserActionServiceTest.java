package io.github.susimsek.springauthserversamples.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class UserActionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserActionTokenRepository tokenRepository;
    @Mock private PasswordService passwordService;
    @Mock private UserAccessInvalidationService invalidationService;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ApplicationProperties applicationProperties;
    @Mock private LoginSettingsService loginSettingsService;
    @Mock private TotpService totpService;

    private UserActionService service;

    @BeforeEach
    void setUp() {
        service =
                new UserActionService(
                        userRepository,
                        tokenRepository,
                        passwordService,
                        invalidationService,
                        auditEventService,
                        eventPublisher,
                        applicationProperties,
                        null,
                        Mappers.getMapper(AccountActionTokenMapper.class),
                        null,
                        null);
    }

    @Test
    void sendsPasswordResetWithoutPersistingTheRawToken() throws Exception {
        UserEntity user = user();
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "http://127.0.0.1:9090"));
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.UPDATE_PASSWORD))
                .thenReturn(Optional.empty());

        service.forgotPassword("alice", Locale.ENGLISH);

        ArgumentCaptor<UserActionTokenEntity> tokenCaptor =
                ArgumentCaptor.forClass(UserActionTokenEntity.class);
        ArgumentCaptor<UserActionEmailEvent> eventCaptor =
                ArgumentCaptor.forClass(UserActionEmailEvent.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        String rawToken =
                org.springframework.web.util.UriComponentsBuilder.fromUriString(
                                eventCaptor.getValue().actionUrl())
                        .build()
                        .getQueryParams()
                        .getFirst("token");
        assertThat(rawToken).isNotBlank();
        assertThat(eventCaptor.getValue().actionUrl())
                .startsWith("http://127.0.0.1:9090/reset-password?");
        assertThat(tokenCaptor.getValue().getTokenHash()).isEqualTo(hash(rawToken));
        assertThat(tokenCaptor.getValue().getTokenHash()).doesNotContain(rawToken);
        assertThat(tokenCaptor.getValue().getExpiresAt())
                .isAfter(tokenCaptor.getValue().getIssuedAt().plusSeconds(43199));
    }

    @Test
    void forgotPasswordDoesNotRevealAnUnknownAccount() {
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "http://localhost:9090"));
        when(userRepository.findIdByUsername("missing")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("missing")).thenReturn(Optional.empty());

        service.forgotPassword("missing", Locale.ENGLISH);

        verify(tokenRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void verifiesEmailAndConsumesToken() throws Exception {
        UserActionTokenEntity token = token(UserAction.VERIFY_EMAIL, Instant.now().plusSeconds(60));
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));

        service.verifyEmail("raw-token");

        assertThat(token.getUser().isEmailVerified()).isTrue();
        assertThat(token.getConsumedAt()).isNotNull();
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        UserActionTokenEntity token = token(UserAction.VERIFY_EMAIL, Instant.now().minusSeconds(1));
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));

        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.ACTION_TOKEN_EXPIRED);
    }

    @Test
    void resetsPasswordAndInvalidatesAllUserAccess() throws Exception {
        UserActionTokenEntity token =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            invocation.<UserEntity>getArgument(0).setPassword("encoded-password");
                            return null;
                        })
                .when(passwordService)
                .changePassword(any(UserEntity.class), org.mockito.Mockito.eq("new-password"));

        service.resetPassword("raw-token", "new-password");

        assertThat(token.getUser().getPassword()).isEqualTo("encoded-password");
        assertThat(token.getConsumedAt()).isNotNull();
        verify(invalidationService).invalidate("alice");
    }

    @Test
    void requiresAndConsumesTotpForPasswordResetWhenPolicyRequiresIt() throws Exception {
        service =
                new UserActionService(
                        userRepository,
                        tokenRepository,
                        passwordService,
                        invalidationService,
                        auditEventService,
                        eventPublisher,
                        applicationProperties,
                        null,
                        org.mapstruct.factory.Mappers.getMapper(AccountActionTokenMapper.class),
                        loginSettingsService,
                        totpService);
        UserActionTokenEntity token =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        token.getUser().setTotpEnabled(true);
        token.getUser().setTotpSecret("JBSWY3DPEHPK3PXP");
        when(loginSettingsService.passwordResetOtpMode()).thenReturn("required");
        when(loginSettingsService.otpAlgorithm()).thenReturn("SHA1");
        when(loginSettingsService.otpDigits()).thenReturn(6);
        when(loginSettingsService.otpPeriodSeconds()).thenReturn(30);
        when(loginSettingsService.otpLookAheadWindow()).thenReturn(1);
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));
        when(totpService.matchingCounter("JBSWY3DPEHPK3PXP", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(42));

        service.resetPassword("raw-token", "new-password", "123456");

        assertThat(token.getUser().getTotpLastUsedCounter()).isEqualTo(42L);
        assertThat(token.getConsumedAt()).isNotNull();
    }

    @Test
    void ignoresBlankAndDisabledForgotPasswordRequests() {
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                false, "no-reply@example.test", "http://localhost:9090"));

        service.forgotPassword(" ", Locale.ENGLISH);
        service.forgotPassword("alice", Locale.ENGLISH);

        verify(userRepository, never()).findIdByUsername(any());
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void confirmsPendingEmailChangeAndInvalidatesAccess() throws Exception {
        UserActionTokenEntity token = token(UserAction.UPDATE_EMAIL, Instant.now().plusSeconds(60));
        token.getUser().setPendingEmail("New@example.test");
        token.setEmail("new@example.test");
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));

        service.confirmEmailChange("raw-token");

        assertThat(token.getUser().getEmail()).isEqualTo("New@example.test");
        assertThat(token.getUser().getPendingEmail()).isNull();
        assertThat(token.getUser().isEmailVerified()).isTrue();
        verify(invalidationService).invalidate("alice");
        verify(auditEventService).record("user.email.changed", "user", "7");
    }

    @Test
    void rejectsInvalidActionTokenStatesAndEmailChangeMismatch() throws Exception {
        assertThatThrownBy(() -> service.verifyEmail(null))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.ACTION_TOKEN_INVALID);

        UserActionTokenEntity wrongAction =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(wrongAction.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token")))
                .thenReturn(Optional.of(wrongAction));
        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.ACTION_TOKEN_INVALID);

        UserActionTokenEntity mismatch =
                token(UserAction.UPDATE_EMAIL, Instant.now().plusSeconds(60));
        mismatch.getUser().setPendingEmail("other@example.test");
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(mismatch));
        assertThatThrownBy(() -> service.confirmEmailChange("raw-token"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.ACTION_TOKEN_INVALID);
    }

    @Test
    void rejectsInvalidPasswordAndLifespanRequests() {
        assertThatThrownBy(() -> service.resetPassword("raw-token", "short"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.INVALID_PASSWORD);
        String tooLongPassword = "x".repeat(129);
        assertThatThrownBy(() -> service.resetPassword("raw-token", tooLongPassword))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.INVALID_PASSWORD);

        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "http://localhost:9090"));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user()));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.VERIFY_EMAIL))
                .thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service.executeActionsEmail(
                                        7L, UserAction.VERIFY_EMAIL, 59L, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.INVALID_REQUEST);
    }

    @Test
    void sendsVerificationAndEmailChangeActionsWithLocalizedRoutes() {
        EmailSettingsService emailSettingsService = mock(EmailSettingsService.class);
        when(emailSettingsService.current())
                .thenReturn(
                        new EmailSettingsService.EmailConfiguration(
                                true,
                                "no-reply@example.test",
                                "https://example.test",
                                "smtp.example.test",
                                25,
                                null,
                                null,
                                false,
                                false,
                                false));
        service = serviceWith(emailSettingsService, null, null);
        UserEntity user = user();
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.VERIFY_EMAIL))
                .thenReturn(Optional.empty());
        service.executeActionsEmail(7L, UserAction.VERIFY_EMAIL, 60L, Locale.forLanguageTag("tr"));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.UPDATE_EMAIL))
                .thenReturn(Optional.empty());
        user.setPendingEmail("new@example.test");
        service.executeActionsEmail(7L, UserAction.UPDATE_EMAIL, 60L, Locale.ENGLISH);

        ArgumentCaptor<UserActionEmailEvent> events =
                ArgumentCaptor.forClass(UserActionEmailEvent.class);
        verify(eventPublisher, times(2)).publishEvent(events.capture());
        assertThat(events.getAllValues().get(0).actionUrl()).contains("/verify-email?");
        assertThat(events.getAllValues().get(0).locale()).isEqualTo(Locale.forLanguageTag("tr"));
        assertThat(events.getAllValues().get(1).actionUrl()).contains("/confirm-email?");
        assertThat(events.getAllValues().get(1).recipient()).isEqualTo("new@example.test");
    }

    @Test
    void handlesCurrentUserActionsAndInvalidation() {
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user()));
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "https://example.test"));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.VERIFY_EMAIL))
                .thenReturn(Optional.empty());

        service.sendForCurrentUser("alice", UserAction.VERIFY_EMAIL, Locale.ENGLISH);
        service.invalidateActions(7L);

        verify(tokenRepository).deleteByUserId(7L);
        assertThatThrownBy(
                        () ->
                                service.sendForCurrentUser(
                                        "missing", UserAction.VERIFY_EMAIL, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void suppressesDisabledUsersAndCooldownDuringForgotPassword() throws Exception {
        UserEntity disabled = user();
        disabled.setEnabled(false);
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "https://example.test"));
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(disabled));
        service.forgotPassword("alice", Locale.ENGLISH);
        verify(tokenRepository, never()).save(any());

        UserEntity noEmail = user();
        noEmail.setEmail(null);
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(noEmail));
        assertThatThrownBy(
                        () ->
                                service.sendForCurrentUser(
                                        "alice", UserAction.UPDATE_PASSWORD, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("User has no email address");

        UserActionTokenEntity recent =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        recent.setIssuedAt(Instant.now());
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user()));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.UPDATE_PASSWORD))
                .thenReturn(Optional.of(recent));
        service.forgotPassword("alice", Locale.ENGLISH);
        verify(tokenRepository, never()).deleteActive(7L, UserAction.UPDATE_PASSWORD);
    }

    @Test
    void rejectsDisabledUsersAndCooldownForExplicitResends() throws Exception {
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "https://example.test"));
        UserEntity disabled = user();
        disabled.setEnabled(false);
        when(userRepository.findIdByUsername("alice")).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(disabled));
        assertThatThrownBy(
                        () ->
                                service.sendForCurrentUser(
                                        "alice", UserAction.VERIFY_EMAIL, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("User is disabled");

        UserActionTokenEntity recent =
                token(UserAction.VERIFY_EMAIL, Instant.now().plusSeconds(60));
        recent.setIssuedAt(Instant.now());
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user()));
        when(tokenRepository.findFirstByUserIdAndActionOrderByIssuedAtDesc(
                        7L, UserAction.VERIFY_EMAIL))
                .thenReturn(Optional.of(recent));
        assertThatThrownBy(
                        () ->
                                service.sendForCurrentUser(
                                        "alice", UserAction.VERIFY_EMAIL, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("Please wait before resending the email");
    }

    @Test
    void rejectsInvalidTokenLookupStates() throws Exception {
        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Action token is invalid");
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Action token is invalid");

        UserActionTokenEntity consumed =
                token(UserAction.VERIFY_EMAIL, Instant.now().plusSeconds(60));
        consumed.setConsumedAt(Instant.now());
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(consumed));
        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Action token was used");

        UserActionTokenEntity invalidUser =
                token(UserAction.VERIFY_EMAIL, Instant.now().plusSeconds(60));
        invalidUser.getUser().setEnabled(false);
        when(tokenRepository.findByTokenHash(hash("raw-token")))
                .thenReturn(Optional.of(invalidUser));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(invalidUser.getUser()));
        assertThatThrownBy(() -> service.verifyEmail("raw-token"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Action token is invalid");
    }

    @Test
    void validatesResetOtpModesAndTokenLifespans() throws Exception {
        service = serviceWith(null, loginSettingsService, totpService);
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "https://example.test"));
        when(loginSettingsService.passwordResetOtpMode()).thenReturn("required");
        UserActionTokenEntity token =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        token.getUser().setTotpEnabled(false);
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");

        when(loginSettingsService.passwordResetOtpMode()).thenReturn("if-configured");
        token.getUser().setTotpEnabled(true);
        token.getUser().setTotpSecret("SECRET");
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.empty());
        when(loginSettingsService.otpAlgorithm()).thenReturn("SHA1");
        when(loginSettingsService.otpDigits()).thenReturn(6);
        when(loginSettingsService.otpPeriodSeconds()).thenReturn(30);
        when(loginSettingsService.otpLookAheadWindow()).thenReturn(1);
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");

        assertThatThrownBy(
                        () ->
                                service.executeActionsEmail(
                                        7L, UserAction.UPDATE_PASSWORD, 86401L, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("Lifespan must be between 60 and 86400 seconds");
    }

    @Test
    void acceptsOptionalOtpWhenTotpIsNotConfigured() throws Exception {
        service = serviceWith(null, loginSettingsService, totpService);
        when(loginSettingsService.passwordResetOtpMode()).thenReturn("if-configured");
        UserActionTokenEntity token =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));

        service.resetPassword("raw-token", "valid-password", null);

        verify(passwordService).changePassword(token.getUser(), "valid-password");
        assertThat(token.getConsumedAt()).isNotNull();
    }

    @Test
    void rejectsMissingOtpAndReplayedOtpCounters() throws Exception {
        service = serviceWith(null, loginSettingsService, totpService);
        when(loginSettingsService.passwordResetOtpMode()).thenReturn("required");
        UserActionTokenEntity token =
                token(UserAction.UPDATE_PASSWORD, Instant.now().plusSeconds(60));
        token.getUser().setTotpEnabled(true);
        token.getUser().setTotpSecret("SECRET");
        when(tokenRepository.findUserIdByTokenHash(hash("raw-token"))).thenReturn(Optional.of(7L));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(token.getUser()));
        when(tokenRepository.findByTokenHash(hash("raw-token"))).thenReturn(Optional.of(token));
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", null))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", " "))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");

        when(loginSettingsService.otpAlgorithm()).thenReturn("SHA1");
        when(loginSettingsService.otpDigits()).thenReturn(6);
        when(loginSettingsService.otpPeriodSeconds()).thenReturn(30);
        when(loginSettingsService.otpLookAheadWindow()).thenReturn(1);
        token.getUser().setTotpLastUsedCounter(42L);
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(42));
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");

        service = serviceWith(null, loginSettingsService, null);
        assertThatThrownBy(() -> service.resetPassword("raw-token", "valid-password", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The OTP code is invalid");
    }

    @Test
    void rejectsActionForAUserThatCannotBeLocked() {
        when(applicationProperties.mail())
                .thenReturn(
                        new ApplicationProperties.Mail(
                                true, "no-reply@example.test", "https://example.test"));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.executeActionsEmail(
                                        7L, UserAction.VERIFY_EMAIL, 600L, Locale.ENGLISH))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    private UserActionService serviceWith(
            EmailSettingsService emailSettingsService,
            LoginSettingsService loginSettingsService,
            TotpService totpService) {
        return new UserActionService(
                userRepository,
                tokenRepository,
                passwordService,
                invalidationService,
                auditEventService,
                eventPublisher,
                applicationProperties,
                emailSettingsService,
                org.mapstruct.factory.Mappers.getMapper(AccountActionTokenMapper.class),
                loginSettingsService,
                totpService);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setEmail("alice@example.test");
        user.setEnabled(true);
        user.setPassword("old-password");
        return user;
    }

    private static UserActionTokenEntity token(UserAction action, Instant expiresAt)
            throws Exception {
        UserActionTokenEntity token = new UserActionTokenEntity();
        token.setUser(user());
        token.setEmail("alice@example.test");
        token.setCredentialFingerprint(hash("old-password"));
        token.setAction(action);
        token.setIssuedAt(Instant.now().minusSeconds(10));
        token.setExpiresAt(expiresAt);
        return token;
    }

    private static String hash(String value) throws Exception {
        return HexFormat.of()
                .formatHex(
                        MessageDigest.getInstance("SHA-256")
                                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
