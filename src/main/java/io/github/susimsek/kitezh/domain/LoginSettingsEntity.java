package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** Application-wide switches that control the public login experience. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "login_settings")
public class LoginSettingsEntity {

    @Id private Long id;

    @Column(name = "user_registration_enabled", nullable = false)
    private boolean userRegistrationEnabled;

    @Column(name = "forgot_password_enabled", nullable = false)
    private boolean forgotPasswordEnabled;

    @Column(name = "password_reset_otp_mode", nullable = false, length = 20)
    private String passwordResetOtpMode;

    @Column(name = "password_reset_token_lifespan_seconds", nullable = false)
    private int passwordResetTokenLifespanSeconds;

    @Column(name = "password_reset_resend_cooldown_seconds", nullable = false)
    private int passwordResetResendCooldownSeconds;

    @Column(name = "remember_me_enabled", nullable = false)
    private boolean rememberMeEnabled;

    @Column(name = "passkeys_enabled", nullable = false)
    private boolean passkeysEnabled;

    @Column(name = "login_with_email", nullable = false)
    private boolean loginWithEmail;

    @Column(name = "verify_email", nullable = false)
    private boolean verifyEmail;

    @Column(name = "webauthn_mediation", nullable = false, length = 20)
    private String webAuthnMediation;

    @Column(name = "webauthn_rp_name", nullable = false, length = 255)
    private String webAuthnRpName;

    @Column(name = "webauthn_rp_id", nullable = false, length = 253)
    private String webAuthnRpId;

    @Column(name = "webauthn_signature_algorithms", nullable = false, length = 255)
    private String webAuthnSignatureAlgorithms;

    @Column(name = "webauthn_attestation", nullable = false, length = 20)
    private String webAuthnAttestation;

    @Column(name = "webauthn_authenticator_attachment", nullable = false, length = 20)
    private String webAuthnAuthenticatorAttachment;

    @Column(name = "webauthn_resident_key", nullable = false, length = 20)
    private String webAuthnResidentKey;

    @Column(name = "webauthn_user_verification", nullable = false, length = 20)
    private String webAuthnUserVerification;

    @Column(name = "webauthn_timeout_seconds", nullable = false)
    private int webAuthnTimeoutSeconds;

    @Column(name = "webauthn_avoid_same_authenticator", nullable = false)
    private boolean webAuthnAvoidSameAuthenticator;

    @Column(name = "webauthn_acceptable_aaguids", length = 4000)
    private String webAuthnAcceptableAaguids;

    @Column(name = "webauthn_passwordless_rp_name", nullable = false, length = 255)
    private String webAuthnPasswordlessRpName;

    @Column(name = "webauthn_passwordless_rp_id", nullable = false, length = 253)
    private String webAuthnPasswordlessRpId;

    @Column(name = "webauthn_passwordless_signature_algorithms", nullable = false, length = 255)
    private String webAuthnPasswordlessSignatureAlgorithms;

    @Column(name = "webauthn_passwordless_attestation", nullable = false, length = 20)
    private String webAuthnPasswordlessAttestation;

    @Column(name = "webauthn_passwordless_authenticator_attachment", nullable = false, length = 20)
    private String webAuthnPasswordlessAuthenticatorAttachment;

    @Column(name = "webauthn_passwordless_resident_key", nullable = false, length = 20)
    private String webAuthnPasswordlessResidentKey;

    @Column(name = "webauthn_passwordless_user_verification", nullable = false, length = 20)
    private String webAuthnPasswordlessUserVerification;

    @Column(name = "webauthn_passwordless_timeout_seconds", nullable = false)
    private int webAuthnPasswordlessTimeoutSeconds;

    @Column(name = "webauthn_passwordless_avoid_same_authenticator", nullable = false)
    private boolean webAuthnPasswordlessAvoidSameAuthenticator;

    @Column(name = "webauthn_passwordless_acceptable_aaguids", length = 4000)
    private String webAuthnPasswordlessAcceptableAaguids;

    @Column(name = "email_update_reauthentication_minutes", nullable = false)
    private int emailUpdateReauthenticationMinutes;

    @Column(name = "google_login_enabled", nullable = false)
    private boolean googleLoginEnabled;

    @Column(name = "github_login_enabled", nullable = false)
    private boolean githubLoginEnabled;

    @Column(name = "linkedin_login_enabled", nullable = false)
    private boolean linkedinLoginEnabled;

    @Column(name = "microsoft_login_enabled", nullable = false)
    private boolean microsoftLoginEnabled;

    @Column(name = "google_alias", nullable = false, length = 50)
    private String googleAlias;

    @Column(name = "google_hide_on_login", nullable = false)
    private boolean googleHideOnLogin;

    @Column(name = "google_account_linking_only", nullable = false)
    private boolean googleAccountLinkingOnly;

    @Column(name = "google_trust_email", nullable = false)
    private boolean googleTrustEmail;

    @Column(name = "google_mfa_required", nullable = false)
    private boolean googleMfaRequired;

    @Column(name = "google_required_claims", nullable = false, length = 500)
    private String googleRequiredClaims;

    @Column(name = "google_store_tokens", nullable = false)
    private boolean googleStoreTokens;

    @Column(name = "google_stored_tokens_readable", nullable = false)
    private boolean googleStoredTokensReadable;

    @Column(name = "google_gui_order", nullable = false)
    private int googleGuiOrder;

    @Column(name = "google_show_in_account_console", nullable = false, length = 20)
    private String googleShowInAccountConsole;

    @Column(name = "github_alias", nullable = false, length = 50)
    private String githubAlias;

    @Column(name = "github_hide_on_login", nullable = false)
    private boolean githubHideOnLogin;

    @Column(name = "github_account_linking_only", nullable = false)
    private boolean githubAccountLinkingOnly;

    @Column(name = "github_trust_email", nullable = false)
    private boolean githubTrustEmail;

    @Column(name = "github_mfa_required", nullable = false)
    private boolean githubMfaRequired;

    @Column(name = "github_required_claims", nullable = false, length = 500)
    private String githubRequiredClaims;

    @Column(name = "github_store_tokens", nullable = false)
    private boolean githubStoreTokens;

    @Column(name = "github_stored_tokens_readable", nullable = false)
    private boolean githubStoredTokensReadable;

    @Column(name = "github_gui_order", nullable = false)
    private int githubGuiOrder;

    @Column(name = "github_show_in_account_console", nullable = false, length = 20)
    private String githubShowInAccountConsole;

    @Column(name = "linkedin_alias", nullable = false, length = 50)
    private String linkedinAlias;

    @Column(name = "linkedin_hide_on_login", nullable = false)
    private boolean linkedinHideOnLogin;

    @Column(name = "linkedin_account_linking_only", nullable = false)
    private boolean linkedinAccountLinkingOnly;

    @Column(name = "linkedin_trust_email", nullable = false)
    private boolean linkedinTrustEmail;

    @Column(name = "linkedin_mfa_required", nullable = false)
    private boolean linkedinMfaRequired;

    @Column(name = "linkedin_required_claims", nullable = false, length = 500)
    private String linkedinRequiredClaims;

    @Column(name = "linkedin_store_tokens", nullable = false)
    private boolean linkedinStoreTokens;

    @Column(name = "linkedin_stored_tokens_readable", nullable = false)
    private boolean linkedinStoredTokensReadable;

    @Column(name = "linkedin_gui_order", nullable = false)
    private int linkedinGuiOrder;

    @Column(name = "linkedin_show_in_account_console", nullable = false, length = 20)
    private String linkedinShowInAccountConsole;

    @Column(name = "microsoft_alias", nullable = false, length = 50)
    private String microsoftAlias;

    @Column(name = "microsoft_hide_on_login", nullable = false)
    private boolean microsoftHideOnLogin;

    @Column(name = "microsoft_account_linking_only", nullable = false)
    private boolean microsoftAccountLinkingOnly;

    @Column(name = "microsoft_trust_email", nullable = false)
    private boolean microsoftTrustEmail;

    @Column(name = "microsoft_mfa_required", nullable = false)
    private boolean microsoftMfaRequired;

    @Column(name = "microsoft_required_claims", nullable = false, length = 500)
    private String microsoftRequiredClaims;

    @Column(name = "microsoft_store_tokens", nullable = false)
    private boolean microsoftStoreTokens;

    @Column(name = "microsoft_stored_tokens_readable", nullable = false)
    private boolean microsoftStoredTokensReadable;

    @Column(name = "microsoft_gui_order", nullable = false)
    private int microsoftGuiOrder;

    @Column(name = "microsoft_show_in_account_console", nullable = false, length = 20)
    private String microsoftShowInAccountConsole;

    @Column(name = "google_client_id", length = 500)
    private String googleClientId;

    @Column(name = "google_client_secret_encrypted", length = 2000)
    private String googleClientSecretEncrypted;

    @Column(name = "github_client_id", length = 500)
    private String githubClientId;

    @Column(name = "github_client_secret_encrypted", length = 2000)
    private String githubClientSecretEncrypted;

    @Column(name = "linkedin_client_id", length = 500)
    private String linkedinClientId;

    @Column(name = "linkedin_client_secret_encrypted", length = 2000)
    private String linkedinClientSecretEncrypted;

    @Column(name = "microsoft_client_id", length = 500)
    private String microsoftClientId;

    @Column(name = "microsoft_client_secret_encrypted", length = 2000)
    private String microsoftClientSecretEncrypted;

    @Column(name = "registration_captcha_enabled", nullable = false)
    private boolean registrationCaptchaEnabled;

    @Column(name = "registration_captcha_provider", nullable = false, length = 20)
    private String registrationCaptchaProvider;

    @Column(name = "registration_captcha_site_key", length = 500)
    private String registrationCaptchaSiteKey;

    @Column(name = "registration_captcha_secret_encrypted", length = 2000)
    private String registrationCaptchaSecretEncrypted;

    @Column(name = "registration_captcha_project_id", length = 200)
    private String registrationCaptchaProjectId;

    @Column(name = "registration_captcha_api_key_encrypted", length = 2000)
    private String registrationCaptchaApiKeyEncrypted;

    @Column(name = "registration_captcha_action", nullable = false, length = 100)
    private String registrationCaptchaAction;

    @Column(name = "registration_captcha_v3", nullable = false)
    private boolean registrationCaptchaV3;

    @Column(name = "registration_captcha_score_threshold", nullable = false)
    private double registrationCaptchaScoreThreshold;

    @Column(name = "registration_captcha_use_recaptcha_net", nullable = false)
    private boolean registrationCaptchaUseRecaptchaNet;

    @Column(name = "login_captcha_enabled", nullable = false)
    private boolean loginCaptchaEnabled;

    @Column(name = "login_captcha_action", nullable = false, length = 100)
    private String loginCaptchaAction;

    @Column(name = "login_captcha_v3", nullable = false)
    private boolean loginCaptchaV3;

    @Column(name = "login_captcha_score_threshold", nullable = false)
    private double loginCaptchaScoreThreshold;

    @Column(name = "session_timeout_minutes", nullable = false)
    private int sessionTimeoutMinutes;

    @Column(name = "password_minimum_length", nullable = false)
    private int passwordMinimumLength;

    @Column(name = "brute_force_enabled", nullable = false)
    private boolean bruteForceEnabled;

    @Column(name = "brute_force_max_failures", nullable = false)
    private int bruteForceMaxFailures;

    @Column(name = "brute_force_max_secondary_failures", nullable = false)
    private int bruteForceMaxSecondaryFailures;

    @Column(name = "mfa_verification_timeout_seconds", nullable = false)
    private int mfaVerificationTimeoutSeconds;

    @Column(name = "password_maximum_length", nullable = false)
    private int passwordMaximumLength;

    @Column(name = "password_minimum_uppercase", nullable = false)
    private int passwordMinimumUppercase;

    @Column(name = "password_minimum_lowercase", nullable = false)
    private int passwordMinimumLowercase;

    @Column(name = "password_minimum_digits", nullable = false)
    private int passwordMinimumDigits;

    @Column(name = "password_minimum_special_characters", nullable = false)
    private int passwordMinimumSpecialCharacters;

    @Column(name = "password_reject_username", nullable = false)
    private boolean passwordRejectUsername;

    @Column(name = "password_reject_email", nullable = false)
    private boolean passwordRejectEmail;

    @Column(name = "password_reject_common_passwords", nullable = false)
    private boolean passwordRejectCommonPasswords;

    @Column(name = "password_history_size", nullable = false)
    private int passwordHistorySize;

    @Column(name = "password_expiration_days", nullable = false)
    private int passwordExpirationDays;

    @Column(name = "password_common_passwords", nullable = false, length = 4000)
    private String passwordCommonPasswords;

    @Column(name = "brute_force_quick_login_window_millis", nullable = false)
    private int bruteForceQuickLoginWindowMillis;

    @Column(name = "brute_force_minimum_quick_login_wait_seconds", nullable = false)
    private int bruteForceMinimumQuickLoginWaitSeconds;

    @Column(name = "brute_force_wait_increment_seconds", nullable = false)
    private int bruteForceWaitIncrementSeconds;

    @Column(name = "brute_force_max_wait_seconds", nullable = false)
    private int bruteForceMaxWaitSeconds;

    @Column(name = "brute_force_failure_reset_time_seconds", nullable = false)
    private int bruteForceFailureResetTimeSeconds;

    @Column(name = "brute_force_max_temporary_lockouts", nullable = false)
    private int bruteForceMaxTemporaryLockouts;

    @Column(name = "brute_force_permanent_lockout", nullable = false)
    private boolean bruteForcePermanentLockout;

    @Column(name = "brute_force_ip_requests_per_minute", nullable = false)
    private int bruteForceIpRequestsPerMinute;

    @Column(name = "brute_force_username_ip_requests_per_minute", nullable = false)
    private int bruteForceUsernameIpRequestsPerMinute;

    @Column(name = "otp_enabled", nullable = false)
    private boolean otpEnabled;

    @Column(name = "otp_required", nullable = false)
    private boolean otpRequired;

    @Column(name = "otp_issuer", nullable = false, length = 100)
    private String otpIssuer;

    @Column(name = "otp_algorithm", nullable = false, length = 10)
    private String otpAlgorithm;

    @Column(name = "otp_digits", nullable = false)
    private int otpDigits;

    @Column(name = "otp_period_seconds", nullable = false)
    private int otpPeriodSeconds;

    @Column(name = "otp_look_ahead_window", nullable = false)
    private int otpLookAheadWindow;

    @Column(name = "otp_code_reusable", nullable = false)
    private boolean otpCodeReusable;

    @Column(name = "otp_add_recovery_codes", nullable = false)
    private boolean otpAddRecoveryCodes;

    @Column(name = "recovery_code_warning_threshold", nullable = false)
    private int recoveryCodeWarningThreshold;
}
