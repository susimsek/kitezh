package io.github.susimsek.kitezh.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorsConfigTest {

    private static final String IDP_ORIGIN = "https://idp.example.test";
    private static final String RENDERER_ORIGIN = "app://renderer";

    @ParameterizedTest
    @CsvSource({
        "/login/saml2/sso/saml-e2e,navigate",
        "/logout/saml2/slo/saml-e2e,navigate",
        "/login/saml2/sso/saml-e2e,"
    })
    void allowsSamlFormNavigationWithoutGrantingCrossOriginReadAccess(String path, String mode)
            throws Exception {
        MockHttpServletRequest request = request("POST", path, IDP_ORIGIN);
        if (mode != null) {
            request.addHeader("Sec-Fetch-Mode", mode);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedSecurity = new AtomicBoolean();

        new CorsConfig()
                .corsFilter(RENDERER_ORIGIN)
                .getFilter()
                .doFilter(request, response, (_, _) -> reachedSecurity.set(true));

        assertThat(reachedSecurity).isTrue();
        assertThat(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isNull();
    }

    @ParameterizedTest
    @CsvSource({
        "POST,/api/account/profile,navigate",
        "GET,/login/saml2/sso/saml-e2e,navigate",
        "POST,/login/saml2/sso/saml-e2e,cors",
        "POST,/login/saml2/sso/saml-e2e,no-cors",
        "POST,/login/saml2/sso/invalid/path,navigate",
        "OPTIONS,/login/saml2/sso/saml-e2e,cors"
    })
    void rejectsUnconfiguredOriginsOutsideSamlFormNavigation(
            String method, String path, String mode) throws Exception {
        MockHttpServletRequest request = request(method, path, IDP_ORIGIN);
        request.addHeader("Sec-Fetch-Mode", mode);
        if ("OPTIONS".equals(method)) {
            request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST");
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedSecurity = new AtomicBoolean();

        new CorsConfig()
                .corsFilter(RENDERER_ORIGIN)
                .getFilter()
                .doFilter(request, response, (_, _) -> reachedSecurity.set(true));

        assertThat(reachedSecurity).isFalse();
        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void retainsConfiguredRendererCorsAccess() throws Exception {
        MockHttpServletRequest request = request("POST", "/oauth2/token", RENDERER_ORIGIN);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean reachedSecurity = new AtomicBoolean();

        new CorsConfig()
                .corsFilter(RENDERER_ORIGIN)
                .getFilter()
                .doFilter(request, response, (_, _) -> reachedSecurity.set(true));

        assertThat(reachedSecurity).isTrue();
        assertThat(response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN))
                .isEqualTo(RENDERER_ORIGIN);
    }

    private static MockHttpServletRequest request(String method, String path, String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setContentType(MediaType.APPLICATION_FORM_URLENCODED_VALUE);
        request.addHeader(HttpHeaders.ORIGIN, origin);
        return request;
    }
}
