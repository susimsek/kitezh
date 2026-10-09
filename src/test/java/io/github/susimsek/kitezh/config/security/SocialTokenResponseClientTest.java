package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.security.LocalizedAccessDeniedHandler;
import io.github.susimsek.kitezh.security.LocalizedAuthenticationEntryPoint;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationExchange;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationResponse;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class SocialTokenResponseClientTest {
    private final SecurityConfig config =
            new SecurityConfig(
                    mock(LocalizedAuthenticationEntryPoint.class),
                    mock(LocalizedAccessDeniedHandler.class));

    @Test
    void readsOidcTokenAndAdditionalParametersWithTheOAuthConverter() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://provider.test/token"))
                .andRespond(
                        withSuccess(
                                """
                                {"access_token":"test-access-token","token_type":"Bearer",
                                 "expires_in":3600,"id_token":"test-id-token"}
                                """,
                                MediaType.APPLICATION_JSON));
        var response = config.socialTokenResponseClient(builder).getTokenResponse(grantRequest());
        assertThat(response.getAccessToken().getTokenValue()).isEqualTo("test-access-token");
        assertThat(response.getAdditionalParameters()).containsEntry("id_token", "test-id-token");
        server.verify();
    }

    @Test
    void convertsProviderErrorsToOAuthErrors() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://provider.test/token"))
                .andRespond(
                        withStatus(HttpStatus.BAD_REQUEST)
                                .contentType(MediaType.APPLICATION_JSON)
                                .body("{\"error\":\"invalid_client\"}"));
        var client = config.socialTokenResponseClient(builder);
        var request = grantRequest();
        assertThatThrownBy(() -> client.getTokenResponse(request))
                .isInstanceOf(OAuth2AuthorizationException.class)
                .satisfies(
                        error ->
                                assertThat(
                                                ((OAuth2AuthorizationException) error)
                                                        .getError()
                                                        .getErrorCode())
                                        .isEqualTo("invalid_client"));
        server.verify();
    }

    private static OAuth2AuthorizationCodeGrantRequest grantRequest() {
        var registration =
                ClientRegistration.withRegistrationId("google")
                        .clientId("test-client")
                        .clientSecret("test-secret")
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("https://app.test/callback")
                        .scope("openid")
                        .authorizationUri("https://provider.test/authorize")
                        .tokenUri("https://provider.test/token")
                        .build();
        var request =
                OAuth2AuthorizationRequest.authorizationCode()
                        .authorizationUri("https://provider.test/authorize")
                        .clientId("test-client")
                        .redirectUri("https://app.test/callback")
                        .state("test-state")
                        .build();
        var response =
                OAuth2AuthorizationResponse.success("test-code")
                        .redirectUri("https://app.test/callback")
                        .state("test-state")
                        .build();
        return new OAuth2AuthorizationCodeGrantRequest(
                registration, new OAuth2AuthorizationExchange(request, response));
    }
}
