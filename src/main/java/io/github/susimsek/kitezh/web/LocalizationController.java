package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsDTO;
import io.github.susimsek.kitezh.dto.localization.UserLocaleDTO;
import io.github.susimsek.kitezh.dto.localization.UserLocaleRequestDTO;
import io.github.susimsek.kitezh.service.UserLocaleService;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/localization")
@RequiredArgsConstructor
@ApiController
public class LocalizationController {

    private final LocalizationSettingsService service;
    private final UserLocaleService userLocaleService;

    @GetMapping
    @Operation(summary = "Get application localization settings")
    @ApiResponse(responseCode = "200", description = "Localization settings returned.")
    public LocalizationSettingsDTO get() {
        return service.get();
    }

    @GetMapping("/messages")
    @Operation(summary = "Get public message overrides for a bundle")
    @ApiResponse(responseCode = "200", description = "Message overrides returned.")
    public java.util.Map<String, String> messages(
            @RequestParam String locale, @RequestParam(defaultValue = "admin") String bundle) {
        return service.publicOverrides(locale, bundle);
    }

    @GetMapping("/me")
    @Operation(summary = "Get the authenticated user's locale preference")
    @ApiResponse(responseCode = "200", description = "User locale preference returned.")
    public UserLocaleDTO userLocale(Authentication authentication) {
        return userLocaleService.get(requireUsername(authentication));
    }

    @PutMapping("/me")
    @Operation(summary = "Set the authenticated user's locale preference")
    @ApiResponse(responseCode = "200", description = "User locale preference updated.")
    public UserLocaleDTO updateUserLocale(
            Authentication authentication, @Valid @RequestBody UserLocaleRequestDTO request) {
        return userLocaleService.update(requireUsername(authentication), request.locale());
    }

    private static String requireUsername(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw ApiException.forbidden(ApiErrorCode.FORBIDDEN, "Authentication is required.");
        }
        return authentication.getName();
    }
}
