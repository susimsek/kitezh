package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.MfaSetupDTO;
import io.github.susimsek.kitezh.dto.account.MobileConsentDecisionDTO;
import io.github.susimsek.kitezh.dto.account.MobileGoogleLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginActionRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginMfaRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginResponseDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyAssertionRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyOptionsDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyRegistrationRequestDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesDTO;
import io.github.susimsek.kitezh.service.security.MobileGoogleLoginService;
import io.github.susimsek.kitezh.service.security.MobileNativeLoginService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth/mobile/login")
@RequiredArgsConstructor
@Tag(
        name = "Mobile authentication",
        description = "Native credential login continuing through authorization code and PKCE.")
public class MobileNativeLoginController {

    private final MobileNativeLoginService mobileNativeLoginService;
    private final MobileGoogleLoginService mobileGoogleLoginService;

    @PostMapping
    @Operation(
            summary = "Authenticate a native mobile client",
            description =
                    "Validates the registered mobile public client and its S256 PKCE request,"
                            + " authenticates credentials, and returns a code or a one-time"
                            + " MFA/required-action continuation.")
    @ApiResponse(
            responseCode = "200",
            description = "Authorization code or required continuation returned.",
            content = @Content(schema = @Schema(implementation = MobileLoginResponseDTO.class)))
    @ApiResponse(responseCode = "401", description = "Credentials are invalid.")
    @ApiResponse(responseCode = "429", description = "Login rate limit exceeded.")
    @ApiResponse(
            responseCode = "400",
            description = "Request, CAPTCHA, or consent policy is invalid.")
    public MobileLoginResponseDTO begin(
            @RequestBody(
                            required = true,
                            description =
                                    "Registered mobile client, S256 challenge, and credentials.")
                    @Valid
                    @org.springframework.web.bind.annotation.RequestBody
                    MobileLoginRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileNativeLoginService.begin(request, servletRequest);
    }

    @PostMapping("/google")
    @Operation(
            summary = "Authenticate a mobile client with native Google Sign-In",
            description =
                    "Verifies the signed Google ID token against Google's issuer and configured"
                            + " client audience, then returns the normal PKCE authorization-code or"
                            + " MFA/required-action continuation.")
    @ApiResponse(
            responseCode = "200",
            description = "Authorization code or required continuation returned.",
            content = @Content(schema = @Schema(implementation = MobileLoginResponseDTO.class)))
    @ApiResponse(responseCode = "401", description = "Google authentication is invalid.")
    @ApiResponse(responseCode = "429", description = "Login rate limit exceeded.")
    @ApiResponse(
            responseCode = "400",
            description = "The mobile request or provider config is invalid.")
    public MobileLoginResponseDTO beginGoogle(
            @RequestBody(
                            required = true,
                            description =
                                    "Native Google ID token plus the registered mobile S256"
                                            + " PKCE request.")
                    @Valid
                    @org.springframework.web.bind.annotation.RequestBody
                    MobileGoogleLoginRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileGoogleLoginService.login(request, servletRequest);
    }

    @PostMapping("/passkey/begin")
    @Operation(
            summary = "Begin native passkey sign-in",
            description =
                    "Creates a server-bound WebAuthn assertion challenge for a registered mobile"
                            + " client and returns the normal PKCE authorization-code continuation"
                            + " after proof.")
    @ApiResponse(
            responseCode = "200",
            description = "Passkey challenge and request options returned.")
    @ApiResponse(responseCode = "401", description = "Passkey authentication failed.")
    public MobileLoginResponseDTO beginPasskey(
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobilePasskeyLoginRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileNativeLoginService.beginPasskey(request, servletRequest);
    }

    @PostMapping("/{transactionId}/passkey/verify")
    @Operation(
            summary = "Complete native passkey sign-in",
            description =
                    "Verifies the assertion against options bound to the transaction and resumes"
                            + " login.")
    @ApiResponse(responseCode = "200", description = "Authorization continuation returned.")
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(responseCode = "401", description = "Passkey assertion is invalid.")
    public MobileLoginResponseDTO verifyPasskey(
            @PathVariable String transactionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobilePasskeyAssertionRequestDTO request) {
        return mobileNativeLoginService.verifyPasskey(transactionId, request);
    }

    @PostMapping("/{transactionId}/actions/{actionKey}/passkey/options")
    @Operation(
            summary = "Create native passkey registration options",
            description =
                    "Returns registration options only while a passkey required action is pending.")
    @ApiResponse(responseCode = "200", description = "Passkey registration options returned.")
    public MobilePasskeyOptionsDTO passkeyRegistrationOptions(
            @PathVariable String transactionId, @PathVariable String actionKey) {
        return mobileNativeLoginService.passkeyRegistrationOptions(transactionId, actionKey);
    }

    @PostMapping("/{transactionId}/actions/{actionKey}/passkey/register")
    @Operation(
            summary = "Register a passkey for a native required action",
            description =
                    "Verifies and registers the WebAuthn attestation, then resumes required"
                            + " actions.")
    @ApiResponse(responseCode = "200", description = "Authorization continuation returned.")
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(
            responseCode = "400",
            description = "Registration proof is invalid or action is not pending.")
    public MobileLoginResponseDTO registerPasskey(
            @PathVariable String transactionId,
            @PathVariable String actionKey,
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobilePasskeyRegistrationRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileNativeLoginService.registerPasskey(
                transactionId, actionKey, request, servletRequest);
    }

    @PostMapping("/{transactionId}/mfa")
    @Operation(
            summary = "Continue native login with TOTP",
            description = "Consumes the TOTP challenge bound to the server-side login transaction.")
    @ApiResponse(
            responseCode = "200",
            description = "Authorization code or next continuation returned.",
            content = @Content(schema = @Schema(implementation = MobileLoginResponseDTO.class)))
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(responseCode = "400", description = "MFA proof is invalid.")
    public MobileLoginResponseDTO verifyMfa(
            @PathVariable String transactionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobileLoginMfaRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileNativeLoginService.verifyMfa(transactionId, request, servletRequest);
    }

    @PostMapping("/{transactionId}/consent")
    @Operation(
            summary = "Approve or deny native OAuth consent",
            description =
                    "Applies an explicit decision to the scopes shown by the server-bound consent"
                            + " continuation. The request cannot change client, scope, state, PKCE,"
                            + " or redirect values.")
    @ApiResponse(
            responseCode = "200",
            description = "Authorization code issued after approval, or denial returned.",
            content = @Content(schema = @Schema(implementation = MobileLoginResponseDTO.class)))
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(responseCode = "400", description = "Transaction is not awaiting consent.")
    public MobileLoginResponseDTO decideConsent(
            @PathVariable String transactionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobileConsentDecisionDTO request) {
        return mobileNativeLoginService.decideConsent(transactionId, request.approved());
    }

    @PostMapping("/{transactionId}/actions/{actionKey}")
    @Operation(
            summary = "Complete a supported native required action",
            description = "Completes an action bound to the authenticated server-side transaction.")
    @ApiResponse(
            responseCode = "200",
            description = "Authorization code or next continuation returned.",
            content = @Content(schema = @Schema(implementation = MobileLoginResponseDTO.class)))
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(
            responseCode = "400",
            description = "Action is not supported or values are invalid.")
    public MobileLoginResponseDTO completeAction(
            @PathVariable String transactionId,
            @PathVariable String actionKey,
            @Valid @org.springframework.web.bind.annotation.RequestBody
                    MobileLoginActionRequestDTO request,
            HttpServletRequest servletRequest) {
        return mobileNativeLoginService.completeAction(
                transactionId, actionKey, request, servletRequest);
    }

    @PostMapping("/{transactionId}/actions/CONFIGURE_TOTP/setup")
    @Operation(
            summary = "Create TOTP setup data for a native login transaction",
            description =
                    "Issues one-time TOTP setup material only while CONFIGURE_TOTP is pending for"
                            + " this transaction.")
    @ApiResponse(responseCode = "200", description = "TOTP setup material returned once.")
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(responseCode = "400", description = "TOTP setup is not pending.")
    public MfaSetupDTO setupTotp(@PathVariable String transactionId) {
        return mobileNativeLoginService.setupTotp(transactionId);
    }

    @PostMapping("/{transactionId}/actions/RECOVERY_CODES/setup")
    @Operation(
            summary = "Create recovery codes for a native login transaction",
            description =
                    "Issues recovery codes once only while RECOVERY_CODES is pending for this"
                            + " transaction.")
    @ApiResponse(responseCode = "200", description = "Recovery codes returned once.")
    @ApiResponse(responseCode = "404", description = "Transaction is absent, expired, or consumed.")
    @ApiResponse(responseCode = "400", description = "Recovery-code setup is not pending.")
    public RecoveryCodesDTO setupRecoveryCodes(@PathVariable String transactionId) {
        return mobileNativeLoginService.setupRecoveryCodes(transactionId);
    }
}
