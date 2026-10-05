package io.github.susimsek.kitezh.dto.captcha;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "CaptchaTokenProperties", description = "Enterprise CAPTCHA token properties.")
public record CaptchaTokenPropertiesDTO(
        @Schema(
                        description = "Whether the token is valid.",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean valid,
        @Schema(description = "Resolved action.", nullable = true) String action) {}
