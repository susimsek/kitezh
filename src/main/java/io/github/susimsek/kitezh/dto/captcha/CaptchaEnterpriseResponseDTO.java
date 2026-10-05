package io.github.susimsek.kitezh.dto.captcha;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(name = "CaptchaEnterpriseResponse", description = "Enterprise CAPTCHA assessment response.")
public record CaptchaEnterpriseResponseDTO(
        @Schema(description = "Token properties.", nullable = true)
                CaptchaTokenPropertiesDTO tokenProperties,
        @Schema(description = "Risk analysis.", nullable = true)
                CaptchaRiskAnalysisDTO riskAnalysis,
        @Schema(description = "Resolved event.", nullable = true)
                CaptchaEnterpriseEventDTO event) {}
