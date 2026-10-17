package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.PersonalAccessTokenRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Transactional
class AccountPersonalAccessTokenEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthorizationRepository authorizationRepository;
    @Autowired private PersonalAccessTokenRepository personalAccessTokenRepository;
    @Autowired private JwtDecoder jwtDecoder;
    @Autowired private OAuth2AuthorizationService authorizationService;
    @Autowired private UserRepository userRepository;

    @Test
    void createsMcpReadTokenListsMetadataOnlyAndRevokesAuthorization() throws Exception {
        String username = "admin";
        String response =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(account(username))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Codex test\",\"description\":\"My"
                                                        + " laptop\",\"expiration\":\"30\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.name").value("Codex test"))
                        .andExpect(jsonPath("$.description").value("My laptop"))
                        .andExpect(jsonPath("$.scope").value("mcp.read"))
                        .andExpect(jsonPath("$.token").isString())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String token = JsonSupport.read(response, "token");
        String tokenId = JsonSupport.read(response, "id");
        var jwtToken = jwtDecoder.decode(token);
        assertThat(jwtToken.getSubject()).isEqualTo(username);
        assertThat(jwtToken.getAudience())
                .contains("https://kitezh-mcp.onrender.com/mcp", "mcp-server");
        assertThat(jwtToken.getClaimAsStringList("scope")).containsExactly("mcp.read");
        assertThat(jwtToken.getExpiresAt())
                .isBetween(
                        Instant.now().plus(Duration.ofDays(29)),
                        Instant.now().plus(Duration.ofDays(31)));
        assertThat(authorizationRepository.findByAccessTokenValue(token)).isPresent();
        Authentication authorizationPrincipal =
                authorizationService
                        .findByToken(token, OAuth2TokenType.ACCESS_TOKEN)
                        .getAttribute(Principal.class.getName());
        assertThat(authorizationPrincipal.getName()).isEqualTo("admin");
        assertThat(authorizationPrincipal.getAuthorities())
                .extracting(Object::toString)
                .contains("ROLE_ADMIN");

        mockMvc.perform(get("/api/account/personal-access-tokens").with(account(username)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(tokenId))
                .andExpect(jsonPath("$[0].name").value("Codex test"))
                .andExpect(jsonPath("$[0].token").doesNotExist());

        mockMvc.perform(
                        delete("/api/account/personal-access-tokens/{tokenId}", tokenId)
                                .with(account(username)))
                .andExpect(status().isNoContent());

        assertThat(personalAccessTokenRepository.findById(tokenId)).isEmpty();
        assertThat(authorizationRepository.findByAccessTokenValue(token)).isEmpty();
    }

    @Test
    void createsTokenWithoutExpiration() throws Exception {
        String username = "pat-no-expiry-" + UUID.randomUUID();
        userRepository.save(
                new UserEntity(null, username, "{noop}Pat-test12!", true, java.util.Set.of()));
        String response =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(account(username))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Long term\",\"description\":\"No"
                                                        + " expiry\",\"expiration\":\"never\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.expiresAt").doesNotExist())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String token = JsonSupport.read(response, "token");
        assertThat(jwtDecoder.decode(token).getExpiresAt()).isNull();
    }

    @Test
    void liquibaseSeedsNoExpirationTokensForAdminAndUser() {
        for (String username : java.util.List.of("admin", "user")) {
            var token =
                    personalAccessTokenRepository
                            .findAllByUserUsernameOrderByCreatedAtDesc(username)
                            .stream()
                            .filter(candidate -> candidate.getSeedKey() != null)
                            .findFirst()
                            .orElseThrow();

            assertThat(token.getSeedKey()).isEqualTo("demo-" + username + "-mcp");
            assertThat(token.getExpiresAt()).isNull();
            var authorization = authorizationRepository.findById(token.getAuthorizationId());
            assertThat(authorization).isPresent();
            var jwtToken = jwtDecoder.decode(authorization.orElseThrow().getAccessTokenValue());
            assertThat(jwtToken.getSubject()).isEqualTo(username);
            assertThat(jwtToken.getClaimAsStringList("scope")).containsExactly("mcp.read");
            assertThat(jwtToken.getExpiresAt()).isNull();
        }
    }

    @Test
    void createsTokenWithCustomExpirationDate() throws Exception {
        String username = "pat-custom-expiry-" + UUID.randomUUID();
        userRepository.save(
                new UserEntity(null, username, "{noop}Pat-test12!", true, java.util.Set.of()));
        LocalDate expirationDate = LocalDate.now(ZoneOffset.UTC).plusDays(30);
        String response =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(account(username))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Custom"
                                                    + " expiry\",\"expiration\":\"custom\",\"customExpirationDate\":\""
                                                        + expirationDate
                                                        + "\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String token = JsonSupport.read(response, "token");
        assertThat(jwtDecoder.decode(token).getExpiresAt())
                .isEqualTo(expirationDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
    }

    @Test
    void rejectsUnsupportedLifetimeAndCrossAccountRevocation() throws Exception {
        String owner = "pat-owner-" + UUID.randomUUID();
        userRepository.save(
                new UserEntity(null, owner, "{noop}Pat-test12!", true, java.util.Set.of()));
        String response =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(account(owner))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"name\":\"Codex test\",\"expiration\":\"31\"}"))
                        .andExpect(status().isBadRequest())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        assertThat(response).contains("expiration");

        String tokenResponse =
                mockMvc.perform(
                                post("/api/account/personal-access-tokens")
                                        .with(account(owner))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"name\":\"Codex test\",\"expiration\":\"90\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String tokenId = JsonSupport.read(tokenResponse, "id");

        mockMvc.perform(
                        delete("/api/account/personal-access-tokens/{tokenId}", tokenId)
                                .with(account("other-user")))
                .andExpect(status().isNotFound());
        assertThat(personalAccessTokenRepository.findById(tokenId)).isPresent();
    }

    private static JwtRequestPostProcessor account(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }

    private static final class JsonSupport {

        private static String read(String json, String property) {
            int propertyIndex = json.indexOf('"' + property + '"');
            int colonIndex = json.indexOf(':', propertyIndex);
            int quoteIndex = json.indexOf('"', colonIndex + 1);
            int endIndex = json.indexOf('"', quoteIndex + 1);
            return json.substring(quoteIndex + 1, endIndex);
        }
    }
}
