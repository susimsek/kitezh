package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.SocialLoginService;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@IntegrationTest
class MobileSocialLinkHandoffIT {

    private static final String CODE_VERIFIER =
            "mobile-link-verifier-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;

    @MockitoBean private SocialLoginService socialLoginService;
    @MockitoBean private ClientRegistrationRepository clientRegistrationRepository;

    @Test
    @Transactional
    void startsMobileLinkAndBindsBrowserHandoffToAuthenticatedAccountAndPkceState()
            throws Exception {
        String username = "mobile-link-it-" + UUID.randomUUID();
        userRepository.save(
                new UserEntity(null, username, "{noop}test-password", true, java.util.Set.of()));
        when(socialLoginService.isProviderEnabled("github")).thenReturn(true);
        when(clientRegistrationRepository.findByRegistrationId("github"))
                .thenReturn(mock(ClientRegistration.class));
        String challenge = codeChallenge(CODE_VERIFIER);

        MvcResult startResult =
                mockMvc.perform(
                                post("/api/account/social-links/github/mobile/start")
                                        .with(accountUser(username))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"state\":\"mobile-link-state-0123456789\","
                                                        + "\"codeChallenge\":\""
                                                        + challenge
                                                        + "\"}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.state").value("mobile-link-state-0123456789"))
                        .andReturn();
        String authorizationUrl =
                tools.jackson.databind.json.JsonMapper.builder()
                        .build()
                        .readTree(startResult.getResponse().getContentAsString())
                        .get("authorizationUrl")
                        .asText();
        URI authorizationUri = URI.create(authorizationUrl);
        String transaction =
                UriComponentsBuilder.fromUri(authorizationUri)
                        .build()
                        .getQueryParams()
                        .getFirst("transaction");
        assertThat(authorizationUri.getPath())
                .isEqualTo("/account/social-links/github/mobile/authorize");
        assertThat(transaction).isNotBlank();

        MvcResult authorizeResult =
                mockMvc.perform(get(authorizationUri.getPath()).param("transaction", transaction))
                        .andExpect(status().is3xxRedirection())
                        .andReturn();

        assertThat(authorizeResult.getResponse().getRedirectedUrl())
                .isEqualTo("/oauth2/authorization/github");
        assertThat(authorizeResult.getResponse().getCookie("SESSION")).isNotNull();
    }

    private static RequestPostProcessor accountUser(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }

    private static String codeChallenge(String verifier) throws Exception {
        byte[] digest =
                MessageDigest.getInstance("SHA-256")
                        .digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}
