package io.github.susimsek.kitezh.service.requiredaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesStatusDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.account.RecoveryCodeService;
import io.github.susimsek.kitezh.service.account.WebAuthnService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.MfaBruteForceService;
import io.github.susimsek.kitezh.service.security.PasswordPolicyService;
import io.github.susimsek.kitezh.service.security.PasswordService;
import io.github.susimsek.kitezh.service.security.TotpService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Map;
import java.util.OptionalLong;
import org.junit.jupiter.api.Test;

@SuppressWarnings("java:S5778")
class StandardRequiredActionHandlerTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsInvalidProfileValues() {
        StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        new UserEntity(),
                                        "UPDATE_PROFILE",
                                        Map.of(
                                                "firstName", "Ada",
                                                "lastName", "Lovelace",
                                                "email", "not-an-email")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsOversizedProfileValues() {
        StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        new UserEntity(),
                                        "UPDATE_PROFILE",
                                        Map.of(
                                                "firstName", "A".repeat(101),
                                                "lastName", "Lovelace",
                                                "email", "ada@example.test")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void completesTotpRequiredActionAndInvalidatesAccess() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        UserAccessInvalidationService invalidation = mock(UserAccessInvalidationService.class);
        when(settings.isOtpRequired()).thenReturn(true);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        when(totp.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, invalidation, settings, totp);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();
        definition.setActionKey("CONFIGURE_TOTP");

        assertThat(handler.isPending(user, definition, false)).isTrue();
        handler.completeStandard(
                user, "CONFIGURE_TOTP", Map.of("code", "123456"), "current-session");

        assertThat(user.isTotpEnabled()).isTrue();
        verify(invalidation).invalidateOtherSessions("alice", "current-session");
    }

    @Test
    void invalidTotpCodeKeepsRequiredActionPending() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        UserAccessInvalidationService invalidation = mock(UserAccessInvalidationService.class);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, invalidation, settings, totp);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user,
                                        "CONFIGURE_TOTP",
                                        Map.of("code", "000000"),
                                        "current-session"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error ->
                                assertThat(error.getErrorCode())
                                        .isEqualTo(ApiErrorCode.INVALID_TOTP_CODE));

        assertThat(user.isTotpEnabled()).isFalse();
        verify(invalidation, never()).invalidateOtherSessions("alice", "current-session");
    }

    @Test
    void acceptsRepeatedTotpCodeWhenCodeReuseIsEnabled() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        UserAccessInvalidationService invalidation = mock(UserAccessInvalidationService.class);
        when(settings.isOtpCodeReusable()).thenReturn(true);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        when(totp.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, invalidation, settings, totp);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();
        definition.setActionKey("CONFIGURE_TOTP");

        handler.completeStandard(
                user, "CONFIGURE_TOTP", Map.of("code", "123456"), "current-session");
        user.setTotpEnabled(false);
        handler.completeStandard(
                user, "CONFIGURE_TOTP", Map.of("code", "123456"), "current-session");

        assertThat(user.isTotpEnabled()).isTrue();
    }

    @Test
    void requiresRecoveryCodesToBeSavedBeforeCompletingAction() {
        RecoveryCodeService recoveryCodes = mock(RecoveryCodeService.class);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        when(recoveryCodes.status("alice")).thenReturn(new RecoveryCodesStatusDTO(12));
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, null, null, null, recoveryCodes);
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();
        definition.setActionKey("RECOVERY_CODES");

        assertThat(handler.isPending(user, definition, false)).isTrue();
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "RECOVERY_CODES", Map.of("accepted", false)))
                .isInstanceOf(ApiException.class);

        handler.completeStandard(user, "RECOVERY_CODES", Map.of("accepted", true));
        verify(recoveryCodes).status("alice");
    }

    @Test
    void completesProfileAndConfirmationActions() {
        StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);
        UserEntity user = new UserEntity();

        handler.completeStandard(
                user,
                "UPDATE_PROFILE",
                Map.of(
                        "firstName",
                        " Ada ",
                        "lastName",
                        " Lovelace ",
                        "email",
                        "ADA@EXAMPLE.TEST"));
        handler.completeStandard(user, "TERMS_AND_CONDITIONS", Map.of("accepted", true));
        handler.completeStandard(user, "DELETE_ACCOUNT", Map.of("confirmed", true));

        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getLastName()).isEqualTo("Lovelace");
        assertThat(user.getEmail()).isEqualTo("ada@example.test");
        assertThat(user.isEmailVerified()).isFalse();
    }

    @Test
    void reportsPendingStatesForStandardActions() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        PasswordPolicyService policy = mock(PasswordPolicyService.class);
        WebAuthnService webAuthn = mock(WebAuthnService.class);
        when(settings.isOtpRequired()).thenReturn(true);
        when(policy.isExpired(org.mockito.ArgumentMatchers.any())).thenReturn(true);
        when(webAuthn.hasCredential("alice")).thenReturn(false);
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, policy, null, null, settings, null, null, null, webAuthn);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setPendingEmail("new@example.test");
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();

        definition.setActionKey("UPDATE_PROFILE");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.test");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("UPDATE_EMAIL");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        definition.setActionKey("UPDATE_PASSWORD");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        definition.setActionKey("CONFIGURE_TOTP");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        definition.setActionKey("RECOVERY_CODES");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        assertThat(handler.isPending(user, definition, true)).isFalse();
        definition.setActionKey("CONFIGURE_PASSKEY");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        definition.setActionKey("UNKNOWN");
        assertThat(handler.isPending(user, definition, true)).isFalse();
    }

    @Test
    void reportsCompletedPendingConditionsAndPasswordlessPasskeyState() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        WebAuthnService webAuthn = mock(WebAuthnService.class);
        when(settings.isOtpRequired()).thenReturn(false);
        when(webAuthn.hasCredential("alice")).thenReturn(true);
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, null, settings, null, null, null, webAuthn);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.test");
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();

        definition.setActionKey("UPDATE_PROFILE");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("UPDATE_EMAIL");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("UPDATE_PASSWORD");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("CONFIGURE_TOTP");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("CONFIGURE_PASSKEY_PASSWORDLESS");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("UNKNOWN");
        assertThat(handler.isPending(user, definition, false)).isTrue();
    }

    @Test
    void completesPasswordEmailAndPasskeyActions() {
        PasswordService password = mock(PasswordService.class);
        UserAccessInvalidationService invalidation = mock(UserAccessInvalidationService.class);
        WebAuthnService webAuthn = mock(WebAuthnService.class);
        when(webAuthn.hasCredential("alice")).thenReturn(true);
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, password, invalidation, null, null, null, null, webAuthn);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setPendingEmail("new@example.test");

        handler.completeStandard(user, "UPDATE_EMAIL", Map.of());
        handler.completeStandard(user, "UPDATE_PASSWORD", Map.of("newPassword", "new-password"));
        handler.completeStandard(user, "CONFIGURE_PASSKEY", Map.of(), "session-1");

        verify(password).changePassword(user, "new-password");
        verify(invalidation).invalidate("alice");
        verify(invalidation).invalidateOtherSessions("alice", "session-1");
    }

    @Test
    void rejectsUnsupportedAndUnconfirmedActions() {
        final StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);
        UserEntity user = new UserEntity();

        assertThatThrownBy(() -> handler.complete(user, Map.of()))
                .isInstanceOf(ApiException.class)
                .satisfies(
                        error ->
                                assertThat(((ApiException) error).getErrorCode())
                                        .isEqualTo(ApiErrorCode.ACTION_UNSUPPORTED));
        assertThatThrownBy(() -> handler.completeStandard(user, "CUSTOM", Map.of()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> handler.completeStandard(user, "UPDATE_EMAIL", Map.of()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> handler.completeStandard(user, "UNKNOWN", Map.of()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void handlesTotpLockoutReuseAndRepeatedCounter() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        MfaBruteForceService bruteForce = mock(MfaBruteForceService.class);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        when(settings.isOtpCodeReusable()).thenReturn(false);
        when(bruteForce.isLocked("alice")).thenReturn(true, false);
        when(totp.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));
        final StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, null, settings, totp, null, bruteForce, null);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpLastUsedCounter(100L);

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "CONFIGURE_TOTP", Map.of("code", "123456")))
                .isInstanceOf(ApiException.class);
        user.setTotpLastUsedCounter(99L);
        handler.completeStandard(user, "CONFIGURE_TOTP", Map.of("code", "123456"));
        verify(bruteForce).recordSuccess("alice");
    }

    @Test
    void recordsTotpFailureWhenSecretOrCodeIsInvalid() {
        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        MfaBruteForceService bruteForce = mock(MfaBruteForceService.class);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        when(bruteForce.isLocked("alice")).thenReturn(false);
        when(totp.matchingCounter("SECRET", "bad", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.empty());
        StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, null, settings, totp, null, bruteForce, null);
        UserEntity user = new UserEntity();
        user.setUsername("alice");

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "CONFIGURE_TOTP", Map.of("code", "bad")))
                .isInstanceOf(ApiException.class);
        verify(bruteForce).recordFailure("alice");

        user.setTotpSecret(null);
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "CONFIGURE_TOTP", Map.of("code", "bad")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void validatesRecoveryAndPasskeyCompletionRequirements() {
        RecoveryCodeService recovery = mock(RecoveryCodeService.class);
        WebAuthnService webAuthn = mock(WebAuthnService.class);
        UserAccessInvalidationService invalidation = mock(UserAccessInvalidationService.class);
        when(recovery.status("alice")).thenReturn(new RecoveryCodesStatusDTO(0));
        when(webAuthn.hasCredential("alice")).thenReturn(false);
        StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(
                        validator, null, null, invalidation, null, null, recovery, null, webAuthn);
        UserEntity user = new UserEntity();
        user.setUsername("alice");

        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "RECOVERY_CODES", Map.of("accepted", true)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> handler.completeStandard(user, "CONFIGURE_PASSKEY", Map.of()))
                .isInstanceOf(ApiException.class);
        verify(invalidation, never()).invalidateOtherSessions("alice", null);
    }

    @Test
    void handlesNullServicesMissingProfileValuesAndConfirmationVariants() {
        final StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);
        UserEntity user = new UserEntity();
        user.setUsername("alice");

        assertThatThrownBy(() -> handler.completeStandard(user, "UPDATE_PROFILE", null))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user,
                                        "UPDATE_PASSWORD",
                                        Map.of("newPassword", "new-password")))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "RECOVERY_CODES", Map.of("accepted", true)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user, "CONFIGURE_PASSKEY_PASSWORDLESS", Map.of()))
                .isInstanceOf(ApiException.class);

        handler.completeStandard(user, "TERMS_AND_CONDITIONS", Map.of("confirmed", true));
        assertThatThrownBy(
                        () ->
                                handler.completeStandard(
                                        user,
                                        "TERMS_AND_CONDITIONS",
                                        Map.of("accepted", false, "confirmed", false)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void completesPasswordWithoutSessionInvalidationService() {
        PasswordService password = mock(PasswordService.class);
        StandardRequiredActionHandler handler =
                new StandardRequiredActionHandler(validator, null, password, null, null, null);
        UserEntity user = new UserEntity();

        handler.completeStandard(user, "UPDATE_PASSWORD", Map.of("newPassword", "new-password"));

        verify(password).changePassword(user, "new-password");
    }

    @Test
    void coversPendingFlagsBlankProfileAndMissingOptionalServices() {
        final StandardRequiredActionHandler handler = new StandardRequiredActionHandler(validator);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setFirstName(" ");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.test");
        RequiredActionDefinitionEntity definition = new RequiredActionDefinitionEntity();

        definition.setActionKey("UPDATE_PROFILE");
        assertThat(handler.isPending(user, definition, false)).isTrue();
        definition.setActionKey("UPDATE_PASSWORD");
        user.setMustChangePassword(true);
        assertThat(handler.isPending(user, definition, false)).isTrue();
        user.setMustChangePassword(false);
        user.setTemporaryPassword(true);
        assertThat(handler.isPending(user, definition, false)).isTrue();
        user.setTemporaryPassword(false);
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("CONFIGURE_TOTP");
        assertThat(handler.isPending(user, definition, false)).isFalse();
        definition.setActionKey("CONFIGURE_PASSKEY");
        assertThat(handler.isPending(user, definition, false)).isFalse();
    }

    @Test
    void completesPasswordlessAndTotpWithoutSessionInvalidation() {
        WebAuthnService webAuthn = mock(WebAuthnService.class);
        when(webAuthn.hasCredential("alice")).thenReturn(true);
        StandardRequiredActionHandler passkeyHandler =
                new StandardRequiredActionHandler(
                        validator, null, null, null, null, null, null, null, webAuthn);
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        passkeyHandler.completeStandard(user, "CONFIGURE_PASSKEY_PASSWORDLESS", Map.of());

        LoginSettingsService settings = mock(LoginSettingsService.class);
        TotpService totp = mock(TotpService.class);
        when(settings.otpAlgorithm()).thenReturn("SHA1");
        when(settings.otpDigits()).thenReturn(6);
        when(settings.otpPeriodSeconds()).thenReturn(30);
        when(settings.otpLookAheadWindow()).thenReturn(1);
        when(totp.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(1L));
        StandardRequiredActionHandler totpHandler =
                new StandardRequiredActionHandler(validator, null, null, null, settings, totp);
        user.setTotpSecret("SECRET");

        totpHandler.completeStandard(user, "CONFIGURE_TOTP", Map.of("code", "123456"));

        assertThat(user.isTotpEnabled()).isTrue();
        assertThat(user.getTotpLastUsedCounter()).isEqualTo(1L);
    }
}
