package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.dto.account.MfaSetupDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesDTO;
import io.github.susimsek.kitezh.dto.account.RequiredActionCompleteRequestDTO;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.account.RecoveryCodeService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/required-actions")
@Tag(name = "Required actions", description = "Actions required before OAuth authorization.")
@SecurityRequirement(name = OpenApiConfig.BROWSER_SESSION)
public class RequiredActionController {

    private final RequiredActionService requiredActionService;
    private final MfaService mfaService;
    private final RecoveryCodeService recoveryCodeService;

    @Autowired
    RequiredActionController(
            RequiredActionService requiredActionService,
            MfaService mfaService,
            RecoveryCodeService recoveryCodeService) {
        this.requiredActionService = requiredActionService;
        this.mfaService = mfaService;
        this.recoveryCodeService = recoveryCodeService;
    }

    RequiredActionController(RequiredActionService requiredActionService, MfaService mfaService) {
        this(requiredActionService, mfaService, null);
    }

    @GetMapping("/CONFIGURE_TOTP/setup")
    @Operation(
            summary = "Start TOTP required action",
            description =
                    "Creates a TOTP setup secret and backend-generated QR code for the"
                            + " authenticated account.")
    @ApiResponse(responseCode = "200", description = "TOTP setup details returned.")
    MfaSetupDTO setupTotp(Authentication authentication) {
        return mfaService.setup(authentication.getName());
    }

    @GetMapping("/RECOVERY_CODES/setup")
    @Operation(
            summary = "Start recovery codes required action",
            description =
                    "Generates a new one-time recovery code set for the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Recovery codes returned once.")
    RecoveryCodesDTO setupRecoveryCodes(Authentication authentication) {
        if (recoveryCodeService == null) {
            throw new IllegalStateException("Recovery code service is unavailable");
        }
        return recoveryCodeService.generate(authentication.getName());
    }

    @GetMapping
    @Operation(
            summary = "List pending required actions",
            description = "Returns the required actions that block the authenticated account.")
    @ApiResponse(responseCode = "200", description = "Pending actions returned.")
    List<RequiredActionDTO> pending(Authentication authentication) {
        return requiredActionService.pending(authentication.getName());
    }

    @PostMapping("/{key}")
    @Operation(
            summary = "Complete a required action",
            description = "Completes the selected required action for the authenticated account.")
    @ApiResponse(responseCode = "204", description = "Required action completed.")
    ResponseEntity<Void> complete(
            @Parameter(
                            description = "Stable required-action key.",
                            example = "UPDATE_PROFILE",
                            required = true)
                    @PathVariable
                    String key,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description =
                                    "Action-specific completion values; may be omitted for"
                                            + " confirmation-only actions.",
                            required = false)
                    @Valid
                    @RequestBody(required = false)
                    RequiredActionCompleteRequestDTO request,
            Authentication authentication,
            HttpServletRequest servletRequest) {
        HttpSession session = servletRequest.getSession(false);
        boolean completed =
                requiredActionService.completeInSession(
                        authentication.getName(),
                        key,
                        request == null ? null : request.values(),
                        servletRequest.getRemoteAddr(),
                        servletRequest.getHeader("User-Agent"),
                        session == null ? null : session.getId());
        if (completed && session != null && "CONFIGURE_TOTP".equals(key)) {
            MfaAuthorizationFilter.markVerified(session);
        }
        return ResponseEntity.noContent().build();
    }
}
