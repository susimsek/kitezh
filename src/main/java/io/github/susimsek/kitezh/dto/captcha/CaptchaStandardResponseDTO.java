package io.github.susimsek.kitezh.dto.captcha;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "CaptchaStandardResponse", description = "Standard CAPTCHA verification response.")
public record CaptchaStandardResponseDTO(
        @Schema(
                        description = "Whether the token was accepted.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean success,
        @Schema(description = "Risk score returned by the provider.", nullable = true) Double score,
        @Schema(description = "Provider action.", nullable = true) String action) {}
