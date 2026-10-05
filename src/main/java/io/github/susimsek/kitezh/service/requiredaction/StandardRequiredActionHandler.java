package io.github.susimsek.kitezh.service.requiredaction;

import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.AccountProfileRequestDTO;
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
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
final class StandardRequiredActionHandler implements RequiredActionHandler {

    private final Validator validator;
    private final PasswordPolicyService passwordPolicyService;
    private final PasswordService passwordService;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final LoginSettingsService loginSettingsService;
    private final TotpService totpService;
    private final RecoveryCodeService recoveryCodeService;
    private final MfaBruteForceService mfaBruteForceService;
    private final WebAuthnService webAuthnService;

    @Autowired
    StandardRequiredActionHandler(
            Validator validator,
            PasswordPolicyService passwordPolicyService,
            PasswordService passwordService,
            UserAccessInvalidationService userAccessInvalidationService,
            LoginSettingsService loginSettingsService,
            TotpService totpService,
            RecoveryCodeService recoveryCodeService,
            MfaBruteForceService mfaBruteForceService,
            WebAuthnService webAuthnService) {
        this.validator = validator;
        this.passwordPolicyService = passwordPolicyService;
        this.passwordService = passwordService;
        this.userAccessInvalidationService = userAccessInvalidationService;
        this.loginSettingsService = loginSettingsService;
        this.totpService = totpService;
        this.recoveryCodeService = recoveryCodeService;
        this.mfaBruteForceService = mfaBruteForceService;
        this.webAuthnService = webAuthnService;
    }

    StandardRequiredActionHandler(
            Validator validator,
            PasswordPolicyService passwordPolicyService,
            PasswordService passwordService,
            UserAccessInvalidationService userAccessInvalidationService,
            LoginSettingsService loginSettingsService,
            TotpService totpService) {
        this(
                validator,
                passwordPolicyService,
                passwordService,
                userAccessInvalidationService,
                loginSettingsService,
                totpService,
                null,
                null,
                null);
    }

    StandardRequiredActionHandler(
            Validator validator,
            PasswordPolicyService passwordPolicyService,
            PasswordService passwordService,
            UserAccessInvalidationService userAccessInvalidationService,
            LoginSettingsService loginSettingsService,
            TotpService totpService,
            RecoveryCodeService recoveryCodeService) {
        this(
                validator,
                passwordPolicyService,
                passwordService,
                userAccessInvalidationService,
                loginSettingsService,
                totpService,
                recoveryCodeService,
                null,
                null);
    }

    StandardRequiredActionHandler(Validator validator) {
        this.validator = validator;
        this.passwordPolicyService = null;
        this.passwordService = null;
        this.userAccessInvalidationService = null;
        this.loginSettingsService = null;
        this.totpService = null;
        this.recoveryCodeService = null;
        this.mfaBruteForceService = null;
        this.webAuthnService = null;
    }

    @Override
    public String key() {
        return "*";
    }

    @Override
    public boolean isPending(
            UserEntity user, RequiredActionDefinitionEntity definition, boolean completed) {
        return switch (definition.getActionKey()) {
            case "UPDATE_PROFILE" ->
                    isBlank(user.getFirstName())
                            || isBlank(user.getLastName())
                            || isBlank(user.getEmail());
            case "UPDATE_EMAIL" -> user.getPendingEmail() != null;
            case "UPDATE_PASSWORD" ->
                    user.isMustChangePassword()
                            || user.isTemporaryPassword()
                            || (passwordPolicyService != null
                                    && passwordPolicyService.isExpired(user));
            case "CONFIGURE_TOTP" ->
                    loginSettingsService != null
                            && loginSettingsService.isOtpRequired()
                            && !user.isTotpEnabled();
            case "RECOVERY_CODES" -> !completed;
            case "CONFIGURE_PASSKEY", "CONFIGURE_PASSKEY_PASSWORDLESS" ->
                    webAuthnService != null && !webAuthnService.hasCredential(user.getUsername());
            default -> !completed;
        };
    }

    @Override
    public void complete(UserEntity user, Map<String, Object> values) {
        throw ApiException.badRequest(
                ApiErrorCode.ACTION_UNSUPPORTED,
                "A handler must be registered for this required action");
    }

    void completeStandard(UserEntity user, String key, Map<String, Object> values) {
        completeStandard(user, key, values, null);
    }

    void completeStandard(
            UserEntity user, String key, Map<String, Object> values, String currentSessionId) {
        Map<String, Object> submitted = values == null ? Map.of() : values;
        switch (key) {
            case "UPDATE_PROFILE" -> completeProfile(user, submitted);
            case "TERMS_AND_CONDITIONS", "DELETE_ACCOUNT", "CUSTOM" ->
                    requireConfirmation(submitted);
            case "UPDATE_EMAIL" -> requirePendingEmail(user);
            case "UPDATE_PASSWORD" -> completePassword(user, submitted);
            case "CONFIGURE_TOTP" -> completeTotp(user, submitted, currentSessionId);
            case "RECOVERY_CODES" -> requireRecoveryCodes(user, submitted);
            case "CONFIGURE_PASSKEY", "CONFIGURE_PASSKEY_PASSWORDLESS" ->
                    requirePasskey(user, currentSessionId);
            default ->
                    throw ApiException.badRequest(
                            ApiErrorCode.ACTION_UNSUPPORTED,
                            "The required action is not supported");
        }
    }

    private void completeProfile(UserEntity user, Map<String, Object> submitted) {
        String firstName = value(submitted, "firstName");
        String lastName = value(submitted, "lastName");
        String email = value(submitted, "email");
        if (isBlank(firstName) || isBlank(lastName) || isBlank(email)) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "First name, last name, and email are required");
        }
        AccountProfileRequestDTO profile = new AccountProfileRequestDTO(firstName, lastName, email);
        ConstraintViolation<AccountProfileRequestDTO> violation =
                validator.validate(profile).stream().findFirst().orElse(null);
        if (violation != null) {
            throw ApiException.badRequest(
                    violation.getPropertyPath().toString(),
                    ApiErrorCode.INVALID_REQUEST,
                    "Profile value is invalid");
        }
        user.setFirstName(firstName.trim());
        user.setLastName(lastName.trim());
        user.setEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
        user.setEmailVerified(false);
    }

    private static void requireConfirmation(Map<String, Object> submitted) {
        if (!Boolean.TRUE.equals(submitted.get("accepted"))
                && !Boolean.TRUE.equals(submitted.get("confirmed"))) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST,
                    "The required action must be explicitly confirmed");
        }
    }

    private static void requirePendingEmail(UserEntity user) {
        if (user.getPendingEmail() == null) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_UNSUPPORTED, "There is no pending email change");
        }
    }

    private void completePassword(UserEntity user, Map<String, Object> submitted) {
        String newPassword = value(submitted, "newPassword");
        if (passwordService == null) {
            throw ApiException.badRequest(
                    ApiErrorCode.ACTION_UNSUPPORTED, "Password service is unavailable");
        }
        passwordService.changePassword(user, newPassword);
        if (userAccessInvalidationService != null) {
            userAccessInvalidationService.invalidate(user.getUsername());
        }
    }

    private void completeTotp(UserEntity user, Map<String, Object> submitted, String sessionId) {
        String code = value(submitted, "code");
        if (mfaBruteForceService != null && mfaBruteForceService.isLocked(user.getUsername())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, "The authenticator code is invalid");
        }
        boolean validTotp =
                totpService != null
                        && loginSettingsService != null
                        && user.getTotpSecret() != null
                        && consumeTotpCode(user, code);
        if (!validTotp) {
            if (mfaBruteForceService != null) {
                mfaBruteForceService.recordFailure(user.getUsername());
            }
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, "The authenticator code is invalid");
        }
        if (mfaBruteForceService != null) {
            mfaBruteForceService.recordSuccess(user.getUsername());
        }
        user.setTotpEnabled(true);
        if (userAccessInvalidationService != null) {
            userAccessInvalidationService.invalidateOtherSessions(user.getUsername(), sessionId);
        }
    }

    private void requireRecoveryCodes(UserEntity user, Map<String, Object> submitted) {
        if (!Boolean.TRUE.equals(submitted.get("accepted"))
                || recoveryCodeService == null
                || recoveryCodeService.status(user.getUsername()).remaining() == 0) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST,
                    "Save the recovery codes before completing this action");
        }
    }

    private void requirePasskey(UserEntity user, String sessionId) {
        if (webAuthnService == null || !webAuthnService.hasCredential(user.getUsername())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST,
                    "Register a passkey before completing this action");
        }
        if (userAccessInvalidationService != null) {
            userAccessInvalidationService.invalidateOtherSessions(user.getUsername(), sessionId);
        }
    }

    private boolean consumeTotpCode(UserEntity user, String code) {
        var counter =
                totpService.matchingCounter(
                        user.getTotpSecret(),
                        code,
                        loginSettingsService.otpAlgorithm(),
                        loginSettingsService.otpDigits(),
                        loginSettingsService.otpPeriodSeconds(),
                        loginSettingsService.otpLookAheadWindow());
        if (counter.isEmpty()
                || (!loginSettingsService.isOtpCodeReusable()
                        && counter.getAsLong()
                                == (user.getTotpLastUsedCounter() == null
                                        ? Long.MIN_VALUE
                                        : user.getTotpLastUsedCounter()))) {
            return false;
        }
        user.setTotpLastUsedCounter(counter.getAsLong());
        return true;
    }

    private static String value(Map<String, Object> values, String key) {
        Object value = values.get(key);
        return value == null ? null : Objects.toString(value, null);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
