package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.dto.account.BrandingSettingsDTO;
import io.github.susimsek.kitezh.service.BrandingSettingsService;
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
@Tag(name = "Branding", description = "Public application branding settings.")
public class BrandingController {

    private final BrandingSettingsService brandingSettingsService;

    @GetMapping("/branding")
    @Operation(summary = "Get public branding settings")
    @ApiResponse(responseCode = "200", description = "Branding settings returned.")
    BrandingSettingsDTO get() {
        return brandingSettingsService.publicSettings();
    }
}
