package io.github.susimsek.kitezh.dto.captcha;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "CaptchaRiskAnalysis", description = "Enterprise CAPTCHA risk analysis.")
public record CaptchaRiskAnalysisDTO(
        @Schema(description = "Risk score.", requiredMode = Schema.RequiredMode.REQUIRED)
                double score) {}
