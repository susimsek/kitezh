package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.AccountRegistrationRequestDTO;
import io.github.susimsek.kitezh.dto.account.ActionTokenRequestDTO;
import io.github.susimsek.kitezh.dto.account.ForgotPasswordRequestDTO;
import io.github.susimsek.kitezh.dto.account.ResetPasswordRequestDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.account.AccountRegistrationService;
import io.github.susimsek.kitezh.service.account.UserActionService;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationInvitationService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(
        name = "Account actions",
        description =
                "Public account registration, email verification, and password reset actions.")
public class AccountActionController {

    private final UserActionService userActionService;
    private final AccountRegistrationService accountRegistrationService;
    private final LoginSettingsService loginSettingsService;
    private final RegistrationCaptchaService registrationCaptchaService;

    @Autowired(required = false)
    private AdminOrganizationInvitationService organizationInvitationService;

    @PostMapping("/register")
    @Operation(
            summary = "Register a user account",
            description =
                    "Creates a new user account and sends any configured verification action"
                            + " email.")
    @ApiResponse(responseCode = "201", description = "Account created.")
    ResponseEntity<Void> register(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "New account details.",
                            required = true)
                    @Valid
                    @RequestBody
                    AccountRegistrationRequestDTO request,
            HttpServletRequest httpRequest,
            @Parameter(description = "BCP 47 locale used for action emails.", example = "en")
                    Locale locale) {
        if (!loginSettingsService.isUserRegistrationEnabled()) {
            throw ApiException.notFound("Account registration is disabled");
        }
        registrationCaptchaService.verifyOrThrow(request.captchaToken(), httpRequest);
        Locale emailLocale =
                request.locale() == null ? locale : Locale.forLanguageTag(request.locale());
        accountRegistrationService.register(
                request.username(),
                request.firstName(),
                request.lastName(),
                request.email(),
                request.password(),
                request.confirmPassword(),
                emailLocale);
        if (request.invitationToken() != null && !request.invitationToken().isBlank()) {
            organizationInvitationService.accept(request.invitationToken(), request.username());
        }
        return ResponseEntity.status(201).build();
    }

    @PostMapping("/forgot-password")
    @Operation(
            summary = "Request a password reset email",
            description =
                    "Sends a localized password-reset email when the account identifier is"
                            + " recognized.")
    @ApiResponse(responseCode = "204", description = "Password-reset request accepted.")
    ResponseEntity<Void> forgotPassword(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Username or email and optional locale.",
                            required = true)
                    @Valid
                    @RequestBody
                    ForgotPasswordRequestDTO request) {
        if (!loginSettingsService.isForgotPasswordEnabled()) {
            throw ApiException.notFound("Password reset is disabled");
        }
        Locale locale = Locale.forLanguageTag(request.locale() == null ? "en" : request.locale());
        userActionService.forgotPassword(request.identifier(), locale);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/verify-email")
    @Operation(
            summary = "Verify an email using a single-use token",
            description =
                    "Consumes the supplied single-use token and marks the associated email address"
                            + " as verified.")
    @ApiResponse(responseCode = "204", description = "Email verified.")
    ResponseEntity<Void> verifyEmail(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Single-use email verification token.",
                            required = true)
                    @Valid
                    @RequestBody
                    ActionTokenRequestDTO request) {
        userActionService.verifyEmail(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/confirm-email")
    @Operation(
            summary = "Confirm an email change using a single-use token",
            description = "Consumes the token and activates the pending email address.")
    @ApiResponse(responseCode = "204", description = "Email change confirmed.")
    ResponseEntity<Void> confirmEmail(@Valid @RequestBody ActionTokenRequestDTO request) {
        userActionService.confirmEmailChange(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    @Operation(
            summary = "Reset a password using a single-use token",
            description = "Consumes the supplied token and replaces the account password.")
    @ApiResponse(responseCode = "204", description = "Password reset completed.")
    ResponseEntity<Void> resetPassword(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description =
                                    "Reset token, replacement password, and optional OTP code.",
                            required = true)
                    @Valid
                    @RequestBody
                    ResetPasswordRequestDTO request) {
        userActionService.resetPassword(request.token(), request.newPassword(), request.otpCode());
        return ResponseEntity.noContent().build();
    }
}
