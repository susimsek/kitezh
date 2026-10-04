package io.github.susimsek.kitezh.service.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.net.URI;
import org.springframework.http.MediaType;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/** Typed HTTP client for standard and enterprise reCAPTCHA verification. */
@HttpExchange
public interface RegistrationCaptchaClient {

    @PostExchange(contentType = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    StandardResponse verify(URI endpoint, @RequestBody MultiValueMap<String, String> form);

    @PostExchange(contentType = MediaType.APPLICATION_JSON_VALUE)
    EnterpriseResponse assess(URI endpoint, @RequestBody EnterpriseRequest request);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record StandardResponse(boolean success, Double score, String action) {}

    record EnterpriseRequest(EnterpriseEvent event) {}

    record EnterpriseEvent(
            String token,
            String siteKey,
            String userAgent,
            String userIpAddress,
            String expectedAction) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record EnterpriseResponse(
            TokenProperties tokenProperties, RiskAnalysis riskAnalysis, EnterpriseEvent event) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenProperties(boolean valid, String action) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RiskAnalysis(double score) {}
}
