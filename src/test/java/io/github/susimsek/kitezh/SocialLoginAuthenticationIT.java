package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.config.security.ReloadableClientRegistrationRepository;
import io.github.susimsek.kitezh.service.SocialLoginService;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.util.UriComponentsBuilder;

@IntegrationTest
class SocialLoginAuthenticationIT {

    @Autowired private MockMvc mockMvc;

    @Autowired private ReloadableClientRegistrationRepository registrations;

    @MockitoBean private SocialLoginService socialLoginService;

    @MockitoBean(name = "socialTokenResponseClient")
    private OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> tokenClient;

    @Test
    void oidcCallbackUsesTheOAuthProviderAndHandlesTokenExchangeFailure() throws Exception {
        registrations.replace(
                List.of(
                        ClientRegistration.withRegistrationId("google")
                                .clientId("test-client")
                                .clientSecret("test-secret")
                                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                                .scope("openid")
                                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                                .tokenUri("https://oauth2.googleapis.com/token")
                                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                                .build()));
        when(socialLoginService.isProviderLoginAllowed("google")).thenReturn(true);
        when(tokenClient.getTokenResponse(any()))
                .thenThrow(new OAuth2AuthenticationException("invalid_token_response"));
        try {
            var start =
                    mockMvc.perform(get("/oauth2/authorization/google"))
                            .andExpect(status().is3xxRedirection())
                            .andReturn();
            var sessionCookie = start.getResponse().getCookie("SESSION");
            assertThat(sessionCookie).isNotNull();
            var callbackRequest =
                    get("/login/oauth2/code/google")
                            .cookie(sessionCookie)
                            .param("code", "test-authorization-code")
                            .param(
                                    "state",
                                    URLDecoder.decode(
                                            UriComponentsBuilder.fromUriString(
                                                            start.getResponse().getRedirectedUrl())
                                                    .build()
                                                    .getQueryParams()
                                                    .getFirst("state"),
                                            StandardCharsets.UTF_8));
            mockMvc.perform(callbackRequest)
                    .andExpect(status().is3xxRedirection())
                    .andExpect(redirectedUrl("/login?error"));
            verify(tokenClient).getTokenResponse(any());
            mockMvc.perform(get("/api/auth/social-providers").cookie(sessionCookie))
                    .andExpect(status().isOk());
        } finally {
            registrations.replace(List.of());
        }
    }
}
