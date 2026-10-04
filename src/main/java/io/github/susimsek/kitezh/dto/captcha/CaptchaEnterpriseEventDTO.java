package io.github.susimsek.kitezh.dto.captcha;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "CaptchaEnterpriseEvent", description = "Enterprise CAPTCHA event payload.")
public record CaptchaEnterpriseEventDTO(
        @Schema(description = "CAPTCHA token.", requiredMode = Schema.RequiredMode.REQUIRED)
                String token,
        @Schema(description = "Site key.", requiredMode = Schema.RequiredMode.REQUIRED)
                String siteKey,
        @Schema(description = "User agent.", nullable = true) String userAgent,
        @Schema(description = "User IP address.", nullable = true) String userIpAddress,
        @Schema(description = "Expected action.", requiredMode = Schema.RequiredMode.REQUIRED)
                String expectedAction) {}
