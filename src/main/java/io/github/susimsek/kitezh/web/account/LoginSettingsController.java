package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.LoginSettingsDTO;
import io.github.susimsek.kitezh.dto.account.RegistrationCaptchaDTO;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.security.RegistrationCaptchaService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Login settings", description = "Public login-page feature switches.")
public class LoginSettingsController {

    private final LoginSettingsService loginSettingsService;
    private final RegistrationCaptchaService registrationCaptchaService;

    @GetMapping("/login-settings")
    @Operation(summary = "Get public login settings")
    @ApiResponse(responseCode = "200", description = "Public login settings returned.")
    LoginSettingsDTO get() {
        return loginSettingsService.publicLoginSettings();
    }

    @GetMapping("/registration-captcha")
    @Operation(summary = "Get public registration CAPTCHA settings")
    @ApiResponse(responseCode = "200", description = "Registration CAPTCHA settings returned.")
    RegistrationCaptchaDTO registrationCaptcha() {
        return registrationCaptchaService.publicSettings();
    }

    @GetMapping("/login-captcha")
    @Operation(summary = "Get public login CAPTCHA settings")
    @ApiResponse(responseCode = "200", description = "Login CAPTCHA settings returned.")
    RegistrationCaptchaDTO loginCaptcha() {
        return registrationCaptchaService.publicLoginSettings();
    }
}
