package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.MobileAuthCapabilitiesDTO;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth/mobile")
@Tag(name = "Mobile authentication", description = "Native mobile authentication contracts.")
public class MobileAuthCapabilitiesController {

    private static final List<String> SUPPORTED_CAPABILITIES =
            List.of(
                    "authorization_code_pkce",
                    "native_password_login",
                    "native_google_id_token_login",
                    "native_passkey_login",
                    "native_totp_mfa",
                    "native_required_actions",
                    "native_passkey_required_action_enrollment",
                    "native_oauth_consent",
                    "native_social_account_link");

    @GetMapping("/capabilities")
    @Operation(
            summary = "Discover mobile authentication capabilities",
            description =
                    "Returns the versioned server authentication contract. The list describes"
                            + " implemented endpoint capabilities; provider availability and"
                            + " account-specific eligibility are determined by their normal"
                            + " discovery and login responses.")
    @ApiResponse(
            responseCode = "200",
            description = "Supported mobile authentication contract returned.",
            content = @Content(schema = @Schema(implementation = MobileAuthCapabilitiesDTO.class)))
    public MobileAuthCapabilitiesDTO capabilities() {
        return new MobileAuthCapabilitiesDTO(1, SUPPORTED_CAPABILITIES);
    }
}
