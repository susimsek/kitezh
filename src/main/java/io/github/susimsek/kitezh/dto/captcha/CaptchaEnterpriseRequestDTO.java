package io.github.susimsek.kitezh.dto.captcha;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "CaptchaEnterpriseRequest", description = "Enterprise CAPTCHA assessment request.")
public record CaptchaEnterpriseRequestDTO(
        @Schema(description = "Enterprise event.", requiredMode = Schema.RequiredMode.REQUIRED)
                CaptchaEnterpriseEventDTO event) {}
