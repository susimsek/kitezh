package io.github.susimsek.springauthserversamples.web.account;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.account.AccountApplicationDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountAvatarDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountDeleteRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountOfflineSessionDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountPasswordRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountProfileDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountProfileRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountSessionDTO;
import io.github.susimsek.springauthserversamples.dto.account.MfaCodeRequestDTO;
import io.github.susimsek.springauthserversamples.dto.account.MfaSetupDTO;
import io.github.susimsek.springauthserversamples.dto.account.MfaStatusDTO;
import io.github.susimsek.springauthserversamples.dto.account.RecoveryCodesDTO;
import io.github.susimsek.springauthserversamples.dto.account.RecoveryCodesStatusDTO;
import io.github.susimsek.springauthserversamples.dto.account.WebAuthnCredentialDTO;
import io.github.susimsek.springauthserversamples.dto.account.WebAuthnCredentialLabelRequestDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesDTO;
import io.github.susimsek.springauthserversamples.dto.userprofile.UserProfileAttributesRequestDTO;
import io.github.susimsek.springauthserversamples.service.UserProfileService;
import io.github.susimsek.springauthserversamples.service.account.AccountApplicationService;
import io.github.susimsek.springauthserversamples.service.account.AccountAvatarService;
import io.github.susimsek.springauthserversamples.service.account.AccountDeletionService;
import io.github.susimsek.springauthserversamples.service.account.AccountProfileService;
import io.github.susimsek.springauthserversamples.service.account.AccountSessionService;
import io.github.susimsek.springauthserversamples.service.account.MfaService;
import io.github.susimsek.springauthserversamples.service.account.RecoveryCodeService;
import io.github.susimsek.springauthserversamples.service.account.WebAuthnService;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@ApiController
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor(onConstructor_ = @Autowired)
@Tag(
        name = "Account",
        description = "Account Console profile, session, and application management.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
@SuppressWarnings("java:S107")
public class AccountController {

    private final AccountProfileService accountProfileService;
    private final UserProfileService userProfileService;
    private final AccountSessionService accountSessionService;
    private final AccountApplicationService accountApplicationService;
    private final AccountAvatarService accountAvatarService;
    private final AccountDeletionService accountDeletionService;
    private final MfaService mfaService;
    private final RecoveryCodeService recoveryCodeService;
    private final WebAuthnService webAuthnService;

    AccountController(
            AccountProfileService accountProfileService,
            UserProfileService userProfileService,
            AccountSessionService accountSessionService,
            AccountApplicationService accountApplicationService,
            AccountAvatarService accountAvatarService,
            AccountDeletionService accountDeletionService,
            MfaService mfaService,
            RecoveryCodeService recoveryCodeService) {
        this(
                accountProfileService,
                userProfileService,
                accountSessionService,
                accountApplicationService,
                accountAvatarService,
                accountDeletionService,
                mfaService,
                recoveryCodeService,
                null);
    }

    @GetMapping("/mfa")
    @Operation(
            summary = "Read MFA status",
            description = "Returns TOTP MFA status and realm policy.")
    @ApiResponse(responseCode = "200", description = "MFA status returned.")
    MfaStatusDTO mfa(Authentication authentication) {
        return mfaService.status(authentication.getName());
    }

    @GetMapping("/mfa/recovery-codes")
    @Operation(
            summary = "Read recovery code status",
            description =
                    "Returns the number of unused one-time MFA recovery codes and the configured"
                            + " warning threshold.")
    @ApiResponse(responseCode = "200", description = "Recovery code status returned.")
    RecoveryCodesStatusDTO recoveryCodes(Authentication authentication) {
        return recoveryCodeService.status(authentication.getName());
    }

    @PostMapping("/mfa/recovery-codes")
    @Operation(
            summary = "Generate recovery codes",
            description =
                    "Replaces existing MFA recovery codes and returns the new codes once."
                            + " The codes are stored as hashes and cannot be read again.")
    @ApiResponse(responseCode = "200", description = "New recovery codes returned.")
    RecoveryCodesDTO generateRecoveryCodes(Authentication authentication) {
        return recoveryCodeService.generate(authentication.getName());
    }

    @GetMapping("/webauthn/credentials")
    @Operation(
            summary = "List registered passkeys",
            description = "Returns the authenticated account's registered WebAuthn credentials.")
    @ApiResponse(responseCode = "200", description = "Passkey credentials returned.")
    Page<WebAuthnCredentialDTO> webAuthnCredentials(
            Authentication authentication,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return webAuthnService.credentials(authentication.getName(), pageable);
    }

    @GetMapping("/webauthn/credentials/{credentialId}")
    @Operation(summary = "Read a registered passkey", description = "Returns passkey metadata.")
    @ApiResponse(responseCode = "200", description = "Passkey metadata returned.")
    WebAuthnCredentialDTO webAuthnCredential(
            Authentication authentication, @PathVariable String credentialId) {
        return webAuthnService.credential(authentication.getName(), credentialId);
    }

    @PutMapping("/webauthn/credentials/{credentialId}")
    @Operation(
            summary = "Rename a registered passkey",
            description = "Updates the label of a passkey owned by the authenticated account.")
    @ApiResponse(responseCode = "204", description = "Passkey label updated.")
    ResponseEntity<Void> updateWebAuthnCredential(
            Authentication authentication,
            @PathVariable String credentialId,
            @Valid @RequestBody WebAuthnCredentialLabelRequestDTO request) {
        webAuthnService.updateLabel(authentication.getName(), credentialId, request.label(), null);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/webauthn/credentials/{credentialId}")
    @Operation(
            summary = "Remove a registered passkey",
            description = "Removes a passkey owned by the authenticated account.")
    @ApiResponse(responseCode = "204", description = "Passkey removed.")
    ResponseEntity<Void> deleteWebAuthnCredential(
            Authentication authentication, @PathVariable String credentialId) {
        webAuthnService.delete(authentication.getName(), credentialId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mfa/setup")
    @Operation(
            summary = "Start MFA setup",
            description = "Creates a new TOTP enrollment secret and backend-generated QR code.")
    @ApiResponse(responseCode = "200", description = "TOTP setup details returned.")
    MfaSetupDTO setupMfa(Authentication authentication) {
        return mfaService.setup(authentication.getName());
    }

    @PostMapping("/mfa/enable")
    @Operation(
            summary = "Enable MFA",
            description = "Enables TOTP after verifying an authenticator code.")
    @ApiResponse(responseCode = "204", description = "MFA enabled.")
    ResponseEntity<Void> enableMfa(
            Authentication authentication, @Valid @RequestBody MfaCodeRequestDTO request) {
        mfaService.enable(authentication.getName(), request.code());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/mfa/disable")
    @Operation(
            summary = "Disable MFA",
            description = "Disables TOTP after verifying an authenticator code.")
    @ApiResponse(responseCode = "204", description = "MFA disabled.")
    ResponseEntity<Void> disableMfa(
            Authentication authentication, @Valid @RequestBody MfaCodeRequestDTO request) {
        mfaService.disable(authentication.getName(), request.code());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @Operation(
            summary = "Delete the authenticated account",
            description =
                    "Permanently deletes the authenticated account after password confirmation.")
    @ApiResponse(responseCode = "204", description = "Account deleted.")
    ResponseEntity<Void> deleteAccount(
            Authentication authentication,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Current password confirmation.",
                            required = true)
                    @Valid
                    @RequestBody
                    AccountDeleteRequestDTO request) {
        accountDeletionService.deleteAccount(authentication.getName(), request.currentPassword());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/profile")
    @Operation(
            summary = "Read profile",
            description = "Returns the profile of the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Authenticated account profile returned.")
    AccountProfileDTO profile(Authentication authentication) {
        return accountProfileService.profile(authentication.getName());
    }

    @PutMapping("/profile")
    @Operation(
            summary = "Update profile",
            description = "Updates editable profile fields for the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Updated account profile returned.")
    AccountProfileDTO updateProfile(
            Authentication authentication,
            @AuthenticationPrincipal Jwt jwt,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Editable profile fields.",
                            required = true)
                    @Valid
                    @RequestBody
                    AccountProfileRequestDTO request) {
        java.time.Instant authenticationTime;
        if (jwt == null) {
            authenticationTime = java.time.Instant.now();
        } else {
            java.time.Instant authTime = jwt.getClaimAsInstant("auth_time");
            authenticationTime = authTime != null ? authTime : jwt.getIssuedAt();
        }
        return accountProfileService.updateProfile(
                authentication.getName(), request, authenticationTime);
    }

    @GetMapping("/profile/avatar")
    @Operation(
            summary = "Read account avatar",
            description = "Returns the public, versioned avatar URL for the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Account avatar returned.")
    AccountAvatarDTO avatar(Authentication authentication) {
        return accountAvatarService.avatar(authentication.getName());
    }

    @PutMapping(path = "/profile/avatar", consumes = "multipart/form-data")
    @Operation(
            summary = "Upload account avatar",
            description =
                    "Stores a JPEG or PNG avatar for the authenticated account. The image is"
                            + " limited to 2 MiB and 4 megapixels.")
    @ApiResponse(responseCode = "200", description = "Account avatar uploaded.")
    AccountAvatarDTO updateAvatar(
            Authentication authentication,
            @Parameter(description = "JPEG or PNG avatar image.", required = true)
                    @RequestParam("file")
                    MultipartFile file) {
        return accountAvatarService.updateAvatar(authentication.getName(), file);
    }

    @DeleteMapping("/profile/avatar")
    @Operation(
            summary = "Delete account avatar",
            description = "Removes the avatar for the authenticated account.")
    @ApiResponse(responseCode = "204", description = "Account avatar deleted.")
    ResponseEntity<Void> deleteAvatar(Authentication authentication) {
        accountAvatarService.deleteAvatar(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/profile/attributes")
    @Operation(
            summary = "Read profile attributes",
            description =
                    "Returns configured profile fields and values for the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Profile attributes returned.")
    UserProfileAttributesDTO profileAttributes(Authentication authentication) {
        return userProfileService.attributes(authentication.getName());
    }

    @PutMapping("/profile/attributes")
    @Operation(
            summary = "Update profile attributes",
            description =
                    "Validates and replaces configured profile values for the authenticated"
                            + " account.")
    @ApiResponse(responseCode = "200", description = "Profile attributes updated.")
    UserProfileAttributesDTO updateProfileAttributes(
            Authentication authentication,
            @Valid @RequestBody UserProfileAttributesRequestDTO request) {
        return userProfileService.saveAttributes(
                authentication.getName(), request.attributes(), authentication.getName());
    }

    @PutMapping("/password")
    @Operation(
            summary = "Change password",
            description =
                    "Changes the authenticated account password and invalidates affected access.")
    @ApiResponse(responseCode = "204", description = "Password changed successfully.")
    ResponseEntity<Void> changePassword(
            Authentication authentication,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Current and new password.",
                            required = true)
                    @Valid
                    @RequestBody
                    AccountPasswordRequestDTO request) {
        accountProfileService.changePassword(
                authentication.getName(), request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/send-verify-email")
    @Operation(
            summary = "Send an email verification link",
            description = "Sends a verification link to the authenticated account email address.")
    @ApiResponse(responseCode = "204", description = "Verification email queued.")
    ResponseEntity<Void> sendVerifyEmail(
            Authentication authentication,
            @Parameter(
                            description = "BCP 47 locale used for the verification email.",
                            example = "en")
                    Locale locale) {
        accountProfileService.sendVerificationEmail(authentication.getName(), locale);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    @Operation(
            summary = "List sessions",
            description =
                    "Returns the authenticated account's active sessions. `size` is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged active sessions returned.")
    Page<AccountSessionDTO> sessions(
            Authentication authentication,
            @AuthenticationPrincipal Jwt jwt,
            @PageableDefault(
                            size = 20,
                            sort = "lastAccessTime",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return accountSessionService.sessions(
                authentication.getName(), jwt.getClaimAsString("sid"), pageable);
    }

    @DeleteMapping("/sessions/others")
    @Operation(
            summary = "Sign out other sessions",
            description = "Terminates every authenticated session except the current session.")
    @ApiResponse(responseCode = "204", description = "Other sessions terminated.")
    ResponseEntity<Void> deleteOtherSessions(
            Authentication authentication, @AuthenticationPrincipal Jwt jwt) {
        accountSessionService.deleteOtherSessions(
                authentication.getName(), jwt.getClaimAsString("sid"));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions/{sessionId}")
    @Operation(
            summary = "Sign out a session",
            description = "Terminates the selected authenticated browser session.")
    @ApiResponse(responseCode = "204", description = "Session terminated.")
    ResponseEntity<Void> deleteSession(
            Authentication authentication,
            @Parameter(
                            description = "Opaque session identifier.",
                            example = "6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12",
                            required = true)
                    @PathVariable
                    String sessionId) {
        accountSessionService.deleteSession(authentication.getName(), sessionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/applications")
    @Operation(
            summary = "List authorized applications",
            description =
                    "Returns a paged list of OAuth2/OIDC clients authorized by the account. `size`"
                            + " is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged authorized applications returned.")
    Page<AccountApplicationDTO> applications(
            Authentication authentication,
            @PageableDefault(size = 20, sort = "id.registeredClientId") Pageable pageable) {
        return accountApplicationService.applications(authentication.getName(), pageable);
    }

    @DeleteMapping("/applications/{clientId}")
    @Operation(
            summary = "Revoke application consent",
            description = "Revokes the authenticated account's consent for a registered client.")
    @ApiResponse(responseCode = "204", description = "Application consent revoked.")
    ResponseEntity<Void> revokeApplication(
            Authentication authentication,
            @Parameter(
                            description = "Registered client identifier.",
                            example = "account-console",
                            required = true)
                    @PathVariable
                    String clientId) {
        accountApplicationService.revokeApplication(authentication.getName(), clientId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/offline-sessions")
    @Operation(
            summary = "List offline sessions",
            description =
                    "Returns offline refresh-token sessions owned by the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Paged offline sessions returned.")
    Page<AccountOfflineSessionDTO> offlineSessions(
            Authentication authentication,
            @PageableDefault(
                            size = 20,
                            sort = "refreshTokenIssuedAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return accountApplicationService.offlineSessions(authentication.getName(), pageable);
    }

    @DeleteMapping("/offline-sessions/{id}")
    @Operation(
            summary = "Revoke offline session",
            description = "Revokes one offline refresh-token session.")
    @ApiResponse(responseCode = "204", description = "Offline session revoked.")
    ResponseEntity<Void> revokeOfflineSession(
            Authentication authentication, @PathVariable String id) {
        accountApplicationService.revokeOfflineSession(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
