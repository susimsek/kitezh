package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;

class ConsolePublicClientAuthenticationConverterTest {

    private final ConsolePublicClientAuthenticationConverter converter =
            new ConsolePublicClientAuthenticationConverter();

    @Test
    void returnsAuthenticationForRefreshAndRevokeConsoleRequests() {
        MockHttpServletRequest refreshRequest = new MockHttpServletRequest("POST", "/oauth2/token");
        refreshRequest.addParameter(OAuth2ParameterNames.GRANT_TYPE, "refresh_token");
        refreshRequest.addParameter(OAuth2ParameterNames.CLIENT_ID, "admin-console");

        MockHttpServletRequest revokeRequest = new MockHttpServletRequest("POST", "/oauth2/revoke");
        revokeRequest.addParameter(OAuth2ParameterNames.CLIENT_ID, "admin-console");

        assertThat(converter.convert(refreshRequest))
                .isInstanceOf(OAuth2ClientAuthenticationToken.class);
        assertThat(converter.convert(revokeRequest))
                .isInstanceOf(OAuth2ClientAuthenticationToken.class);
    }

    @Test
    void returnsNullForRevokeRequestWithoutClientId() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/revoke");

        assertThat(converter.convert(request)).isNull();
    }

    @Test
    void returnsNullForNonAdminOrUnsupportedRequests() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.addParameter(OAuth2ParameterNames.GRANT_TYPE, "client_credentials");
        request.addParameter(OAuth2ParameterNames.CLIENT_ID, "other-client");

        assertThat(converter.convert(request)).isNull();
    }
}
