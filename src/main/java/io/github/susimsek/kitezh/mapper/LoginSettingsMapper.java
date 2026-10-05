package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import io.github.susimsek.kitezh.dto.account.LoginSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.WebAuthnPolicyDTO;
import java.util.Locale;
import org.mapstruct.AfterMapping;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;
import org.mapstruct.Named;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface LoginSettingsMapper {

    @Mapping(target = "userRegistration", source = "userRegistrationEnabled")
    @Mapping(target = "forgotPassword", source = "forgotPasswordEnabled")
    @Mapping(target = "passwordResetOtpMode", source = "passwordResetOtpMode")
    @Mapping(target = "rememberMe", source = "rememberMeEnabled")
    @Mapping(target = "passkeys", source = "passkeysEnabled")
    @Mapping(target = "webauthnMediation", source = "webAuthnMediation")
    LoginSettingsDTO toPublicDTO(LoginSettingsEntity source);

    @Mapping(target = "userRegistration", source = "userRegistrationEnabled")
    @Mapping(target = "forgotPassword", source = "forgotPasswordEnabled")
    @Mapping(target = "passwordResetOtpMode", source = "passwordResetOtpMode")
    @Mapping(
            target = "passwordResetTokenLifespanSeconds",
            source = "passwordResetTokenLifespanSeconds")
    @Mapping(
            target = "passwordResetResendCooldownSeconds",
            source = "passwordResetResendCooldownSeconds")
    @Mapping(target = "rememberMe", source = "rememberMeEnabled")
    @Mapping(target = "passkeys", source = "passkeysEnabled")
    @Mapping(target = "loginWithEmail", source = "loginWithEmail")
    @Mapping(target = "verifyEmail", source = "verifyEmail")
    @Mapping(target = "webauthnMediation", source = "webAuthnMediation")
    @Mapping(
            target = "emailUpdateReauthenticationMinutes",
            source = "emailUpdateReauthenticationMinutes")
    @Mapping(target = "googleLoginEnabled", source = "googleLoginEnabled")
    @Mapping(target = "githubLoginEnabled", source = "githubLoginEnabled")
    @Mapping(target = "linkedinLoginEnabled", source = "linkedinLoginEnabled")
    @Mapping(target = "microsoftLoginEnabled", source = "microsoftLoginEnabled")
    @Mapping(target = "sessionTimeoutMinutes", source = "sessionTimeoutMinutes")
    @Mapping(target = "passwordMinimumLength", source = "passwordMinimumLength")
    @Mapping(target = "bruteForceEnabled", source = "bruteForceEnabled")
    @Mapping(target = "bruteForceMaxFailures", source = "bruteForceMaxFailures")
    @Mapping(target = "bruteForceMaxSecondaryFailures", source = "bruteForceMaxSecondaryFailures")
    @Mapping(target = "mfaVerificationTimeoutSeconds", source = "mfaVerificationTimeoutSeconds")
    @Mapping(target = "passwordMaximumLength", source = "passwordMaximumLength")
    @Mapping(target = "passwordMinimumUppercase", source = "passwordMinimumUppercase")
    @Mapping(target = "passwordMinimumLowercase", source = "passwordMinimumLowercase")
    @Mapping(target = "passwordMinimumDigits", source = "passwordMinimumDigits")
    @Mapping(
            target = "passwordMinimumSpecialCharacters",
            source = "passwordMinimumSpecialCharacters")
    @Mapping(target = "passwordRejectUsername", source = "passwordRejectUsername")
    @Mapping(target = "passwordRejectEmail", source = "passwordRejectEmail")
    @Mapping(target = "passwordRejectCommonPasswords", source = "passwordRejectCommonPasswords")
    @Mapping(target = "passwordHistorySize", source = "passwordHistorySize")
    @Mapping(target = "passwordExpirationDays", source = "passwordExpirationDays")
    @Mapping(target = "passwordCommonPasswords", source = "passwordCommonPasswords")
    @Mapping(
            target = "bruteForceQuickLoginWindowMillis",
            source = "bruteForceQuickLoginWindowMillis")
    @Mapping(
            target = "bruteForceMinimumQuickLoginWaitSeconds",
            source = "bruteForceMinimumQuickLoginWaitSeconds")
    @Mapping(target = "bruteForceWaitIncrementSeconds", source = "bruteForceWaitIncrementSeconds")
    @Mapping(target = "bruteForceMaxWaitSeconds", source = "bruteForceMaxWaitSeconds")
    @Mapping(
            target = "bruteForceFailureResetTimeSeconds",
            source = "bruteForceFailureResetTimeSeconds")
    @Mapping(target = "bruteForceMaxTemporaryLockouts", source = "bruteForceMaxTemporaryLockouts")
    @Mapping(target = "bruteForcePermanentLockout", source = "bruteForcePermanentLockout")
    @Mapping(target = "bruteForceIpRequestsPerMinute", source = "bruteForceIpRequestsPerMinute")
    @Mapping(
            target = "bruteForceUsernameIpRequestsPerMinute",
            source = "bruteForceUsernameIpRequestsPerMinute")
    @Mapping(target = "otpEnabled", source = "otpEnabled")
    @Mapping(target = "otpRequired", source = "otpRequired")
    @Mapping(target = "otpIssuer", source = "otpIssuer")
    @Mapping(target = "otpAlgorithm", source = "otpAlgorithm")
    @Mapping(target = "otpDigits", source = "otpDigits")
    @Mapping(target = "otpPeriodSeconds", source = "otpPeriodSeconds")
    @Mapping(target = "otpLookAheadWindow", source = "otpLookAheadWindow")
    @Mapping(target = "otpCodeReusable", source = "otpCodeReusable")
    @Mapping(target = "otpAddRecoveryCodes", source = "otpAddRecoveryCodes")
    @Mapping(target = "recoveryCodeWarningThreshold", source = "recoveryCodeWarningThreshold")
    @Mapping(target = "webauthnPolicy", expression = "java(toWebAuthnPolicy(source, false))")
    @Mapping(
            target = "webauthnPasswordlessPolicy",
            expression = "java(toWebAuthnPolicy(source, true))")
    AdminLoginSettingsDTO toAdminDTO(LoginSettingsEntity source);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "userRegistrationEnabled", source = "userRegistration")
    @Mapping(target = "forgotPasswordEnabled", source = "forgotPassword")
    @Mapping(
            target = "passwordResetOtpMode",
            source = "passwordResetOtpMode",
            qualifiedByName = "normalizeResetOtpMode")
    @Mapping(
            target = "passwordResetTokenLifespanSeconds",
            source = "passwordResetTokenLifespanSeconds")
    @Mapping(
            target = "passwordResetResendCooldownSeconds",
            source = "passwordResetResendCooldownSeconds")
    @Mapping(target = "rememberMeEnabled", source = "rememberMe")
    @Mapping(target = "loginWithEmail", source = "loginWithEmail")
    @Mapping(target = "verifyEmail", source = "verifyEmail")
    @Mapping(
            target = "webAuthnMediation",
            source = "webauthnMediation",
            qualifiedByName = "normalizeMediation")
    @Mapping(
            target = "emailUpdateReauthenticationMinutes",
            source = "emailUpdateReauthenticationMinutes")
    @Mapping(target = "googleLoginEnabled", source = "googleLoginEnabled")
    @Mapping(target = "githubLoginEnabled", source = "githubLoginEnabled")
    @Mapping(target = "linkedinLoginEnabled", source = "linkedinLoginEnabled")
    @Mapping(target = "microsoftLoginEnabled", source = "microsoftLoginEnabled")
    @Mapping(target = "sessionTimeoutMinutes", source = "sessionTimeoutMinutes")
    @Mapping(target = "passwordMinimumLength", source = "passwordMinimumLength")
    @Mapping(target = "bruteForceEnabled", source = "bruteForceEnabled")
    @Mapping(target = "bruteForceMaxFailures", source = "bruteForceMaxFailures")
    @Mapping(target = "bruteForceMaxSecondaryFailures", source = "bruteForceMaxSecondaryFailures")
    @Mapping(target = "mfaVerificationTimeoutSeconds", source = "mfaVerificationTimeoutSeconds")
    @Mapping(target = "passwordMaximumLength", source = "passwordMaximumLength")
    @Mapping(target = "passwordMinimumUppercase", source = "passwordMinimumUppercase")
    @Mapping(target = "passwordMinimumLowercase", source = "passwordMinimumLowercase")
    @Mapping(target = "passwordMinimumDigits", source = "passwordMinimumDigits")
    @Mapping(
            target = "passwordMinimumSpecialCharacters",
            source = "passwordMinimumSpecialCharacters")
    @Mapping(target = "passwordRejectUsername", source = "passwordRejectUsername")
    @Mapping(target = "passwordRejectEmail", source = "passwordRejectEmail")
    @Mapping(target = "passwordRejectCommonPasswords", source = "passwordRejectCommonPasswords")
    @Mapping(target = "passwordHistorySize", source = "passwordHistorySize")
    @Mapping(target = "passwordExpirationDays", source = "passwordExpirationDays")
    @Mapping(target = "passwordCommonPasswords", source = "passwordCommonPasswords")
    @Mapping(
            target = "bruteForceQuickLoginWindowMillis",
            source = "bruteForceQuickLoginWindowMillis")
    @Mapping(
            target = "bruteForceMinimumQuickLoginWaitSeconds",
            source = "bruteForceMinimumQuickLoginWaitSeconds")
    @Mapping(target = "bruteForceWaitIncrementSeconds", source = "bruteForceWaitIncrementSeconds")
    @Mapping(target = "bruteForceMaxWaitSeconds", source = "bruteForceMaxWaitSeconds")
    @Mapping(
            target = "bruteForceFailureResetTimeSeconds",
            source = "bruteForceFailureResetTimeSeconds")
    @Mapping(target = "bruteForceMaxTemporaryLockouts", source = "bruteForceMaxTemporaryLockouts")
    @Mapping(target = "bruteForcePermanentLockout", source = "bruteForcePermanentLockout")
    @Mapping(target = "bruteForceIpRequestsPerMinute", source = "bruteForceIpRequestsPerMinute")
    @Mapping(
            target = "bruteForceUsernameIpRequestsPerMinute",
            source = "bruteForceUsernameIpRequestsPerMinute")
    @Mapping(target = "otpEnabled", source = "otpEnabled")
    @Mapping(target = "otpRequired", source = "otpRequired")
    @Mapping(target = "otpIssuer", source = "otpIssuer", qualifiedByName = "trim")
    @Mapping(
            target = "otpAlgorithm",
            source = "otpAlgorithm",
            qualifiedByName = "normalizeAlgorithm")
    @Mapping(target = "otpDigits", source = "otpDigits")
    @Mapping(target = "otpPeriodSeconds", source = "otpPeriodSeconds")
    @Mapping(target = "otpLookAheadWindow", source = "otpLookAheadWindow")
    @Mapping(target = "otpCodeReusable", source = "otpCodeReusable")
    @Mapping(target = "otpAddRecoveryCodes", source = "otpAddRecoveryCodes")
    @Mapping(target = "recoveryCodeWarningThreshold", source = "recoveryCodeWarningThreshold")
    @Mapping(target = "passkeysEnabled", source = "passkeys")
    void update(AdminLoginSettingsRequestDTO source, @MappingTarget LoginSettingsEntity target);

    @AfterMapping
    default void updateWebAuthnPolicies(
            AdminLoginSettingsRequestDTO source, @MappingTarget LoginSettingsEntity target) {
        WebAuthnPolicyDTO policy = source.webauthnPolicy();
        target.setWebAuthnRpName(policy.rpName().trim());
        target.setWebAuthnRpId(trim(policy.rpId()));
        target.setWebAuthnSignatureAlgorithms(policy.signatureAlgorithms().trim());
        target.setWebAuthnAttestation(policy.attestation().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnAuthenticatorAttachment(
                policy.authenticatorAttachment().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnResidentKey(policy.residentKey().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnUserVerification(
                policy.userVerification().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnTimeoutSeconds(policy.timeoutSeconds());
        target.setWebAuthnAvoidSameAuthenticator(policy.avoidSameAuthenticator());
        target.setWebAuthnAcceptableAaguids(trim(policy.acceptableAaguids()));

        WebAuthnPolicyDTO passwordless = source.webauthnPasswordlessPolicy();
        target.setWebAuthnPasswordlessRpName(passwordless.rpName().trim());
        target.setWebAuthnPasswordlessRpId(trim(passwordless.rpId()));
        target.setWebAuthnPasswordlessSignatureAlgorithms(
                passwordless.signatureAlgorithms().trim());
        target.setWebAuthnPasswordlessAttestation(
                passwordless.attestation().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnPasswordlessAuthenticatorAttachment(
                passwordless.authenticatorAttachment().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnPasswordlessResidentKey(
                passwordless.residentKey().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnPasswordlessUserVerification(
                passwordless.userVerification().trim().toLowerCase(Locale.ROOT));
        target.setWebAuthnPasswordlessTimeoutSeconds(passwordless.timeoutSeconds());
        target.setWebAuthnPasswordlessAvoidSameAuthenticator(passwordless.avoidSameAuthenticator());
        target.setWebAuthnPasswordlessAcceptableAaguids(trim(passwordless.acceptableAaguids()));
    }

    default WebAuthnPolicyDTO toWebAuthnPolicy(LoginSettingsEntity source, boolean passwordless) {
        if (passwordless) {
            return new WebAuthnPolicyDTO(
                    source.getWebAuthnPasswordlessRpName(),
                    source.getWebAuthnPasswordlessRpId(),
                    source.getWebAuthnPasswordlessSignatureAlgorithms(),
                    source.getWebAuthnPasswordlessAttestation(),
                    source.getWebAuthnPasswordlessAuthenticatorAttachment(),
                    source.getWebAuthnPasswordlessResidentKey(),
                    source.getWebAuthnPasswordlessUserVerification(),
                    source.getWebAuthnPasswordlessTimeoutSeconds(),
                    source.isWebAuthnPasswordlessAvoidSameAuthenticator(),
                    source.getWebAuthnPasswordlessAcceptableAaguids());
        }
        return new WebAuthnPolicyDTO(
                source.getWebAuthnRpName(),
                source.getWebAuthnRpId(),
                source.getWebAuthnSignatureAlgorithms(),
                source.getWebAuthnAttestation(),
                source.getWebAuthnAuthenticatorAttachment(),
                source.getWebAuthnResidentKey(),
                source.getWebAuthnUserVerification(),
                source.getWebAuthnTimeoutSeconds(),
                source.isWebAuthnAvoidSameAuthenticator(),
                source.getWebAuthnAcceptableAaguids());
    }

    @Named("trim")
    default String trim(String value) {
        return value == null ? null : value.trim();
    }

    @Named("normalizeAlgorithm")
    default String normalizeAlgorithm(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    @Named("normalizeMediation")
    default String normalizeMediation(String value) {
        return value == null ? "none" : value.trim().toLowerCase(Locale.ROOT);
    }

    @Named("normalizeResetOtpMode")
    default String normalizeResetOtpMode(String value) {
        return value == null ? "none" : value.trim().toLowerCase(Locale.ROOT);
    }
}
