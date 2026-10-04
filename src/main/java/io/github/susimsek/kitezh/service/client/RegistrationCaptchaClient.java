package io.github.susimsek.kitezh.service.client;

import io.github.susimsek.kitezh.dto.captcha.CaptchaEnterpriseRequestDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaEnterpriseResponseDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaStandardResponseDTO;
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
    CaptchaStandardResponseDTO verify(
            URI endpoint, @RequestBody MultiValueMap<String, String> form);

    @PostExchange(contentType = MediaType.APPLICATION_JSON_VALUE)
    CaptchaEnterpriseResponseDTO assess(
            URI endpoint, @RequestBody CaptchaEnterpriseRequestDTO request);
}
