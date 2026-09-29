package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.core.context.SecurityContextHolder.getContext;

import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

class CibaAuthenticationGrantAuthenticationConverterTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsNullForAnotherGrantAndConvertsValidRequest() {
        CibaAuthenticationGrantAuthenticationConverter converter =
                new CibaAuthenticationGrantAuthenticationConverter();
        MockHttpServletRequest other = new MockHttpServletRequest();
        other.addParameter("grant_type", "client_credentials");
        assertThat(converter.convert(other)).isNull();

        TestingAuthenticationToken client = new TestingAuthenticationToken("client", "secret");
        getContext().setAuthentication(client);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("grant_type", AuthorizationGrantTypes.CIBA);
        request.addParameter("auth_req_id", "opaque-id");
        request.addParameter("foo", "bar");

        CibaAuthenticationGrantAuthenticationToken token =
                (CibaAuthenticationGrantAuthenticationToken) converter.convert(request);
        assertThat(token.getAuthReqId()).isEqualTo("opaque-id");
        assertThat(token.getPrincipal()).isSameAs(client);
        assertThat(token.getAdditionalParameters()).containsEntry("foo", "bar");
    }

    @Test
    void rejectsMissingBlankAndRepeatedRequestIdentifiers() {
        CibaAuthenticationGrantAuthenticationConverter converter =
                new CibaAuthenticationGrantAuthenticationConverter();
        for (String value : new String[] {null, ""}) {
            MockHttpServletRequest request = request();
            if (value != null) {
                request.addParameter("auth_req_id", value);
            }
            assertThatThrownBy(() -> converter.convert(request))
                    .isInstanceOf(OAuth2AuthenticationException.class);
        }
        MockHttpServletRequest repeated = request();
        repeated.addParameter("auth_req_id", "one");
        repeated.addParameter("auth_req_id", "two");
        assertThatThrownBy(() -> converter.convert(repeated))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    void grantTokensCompareByRequestAndClientData() {
        TestingAuthenticationToken client = new TestingAuthenticationToken("client", "secret");
        CibaAuthenticationGrantAuthenticationToken first =
                new CibaAuthenticationGrantAuthenticationToken("request", client, Map.of());
        CibaAuthenticationGrantAuthenticationToken same =
                new CibaAuthenticationGrantAuthenticationToken("request", client, Map.of());
        CibaAuthenticationGrantAuthenticationToken different =
                new CibaAuthenticationGrantAuthenticationToken("other", client, Map.of());

        assertThat(first)
                .isEqualTo(same)
                .hasSameHashCodeAs(same)
                .isNotEqualTo(different)
                .isNotEqualTo("request");
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("grant_type", AuthorizationGrantTypes.CIBA);
        return request;
    }
}
