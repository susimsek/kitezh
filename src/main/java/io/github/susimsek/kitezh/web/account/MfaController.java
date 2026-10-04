package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.dto.account.MfaCodeRequestDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodeRequestDTO;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.account.RecoveryCodeService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth/mfa")
@Tag(name = "MFA", description = "Browser-session MFA verification.")
@SecurityRequirement(name = OpenApiConfig.BROWSER_SESSION)
public class MfaController {

    private final MfaService mfaService;
    private final RecoveryCodeService recoveryCodeService;

    @Autowired
    MfaController(MfaService mfaService, RecoveryCodeService recoveryCodeService) {
        this.mfaService = mfaService;
        this.recoveryCodeService = recoveryCodeService;
    }

    MfaController(MfaService mfaService) {
        this(mfaService, null);
    }

    @PostMapping("/verify")
    @Operation(
            summary = "Verify TOTP",
            description = "Verifies the current authenticator code for the browser session.")
    @ApiResponse(responseCode = "204", description = "TOTP verified for the current session.")
    ResponseEntity<Void> verify(
            Authentication authentication,
            @Valid @RequestBody MfaCodeRequestDTO request,
            HttpServletRequest servletRequest) {
        if (!mfaService.valid(authentication.getName(), request.code())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, "The authenticator code is invalid");
        }
        MfaAuthorizationFilter.markVerified(servletRequest.getSession(true));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recovery-code")
    @Operation(
            summary = "Verify MFA recovery code",
            description = "Consumes one unused recovery code for the browser session.")
    @ApiResponse(responseCode = "204", description = "Recovery code verified for the session.")
    ResponseEntity<Void> verifyRecoveryCode(
            Authentication authentication,
            @Valid @RequestBody RecoveryCodeRequestDTO request,
            HttpServletRequest servletRequest) {
        if (!recoveryCodeService.consume(authentication.getName(), request.code())) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_RECOVERY_CODE,
                    "The recovery code is invalid or has already been used");
        }
        MfaAuthorizationFilter.markVerified(servletRequest.getSession(true));
        return ResponseEntity.noContent().build();
    }
}
