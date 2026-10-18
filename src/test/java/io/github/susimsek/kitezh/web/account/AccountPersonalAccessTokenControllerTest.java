package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenCreatedDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenRequestDTO;
import io.github.susimsek.kitezh.service.account.PersonalAccessTokenService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

class AccountPersonalAccessTokenControllerTest {

    private static final String USERNAME = "alice";
    private final PersonalAccessTokenService service =
            org.mockito.Mockito.mock(PersonalAccessTokenService.class);
    private final AccountPersonalAccessTokenController controller =
            new AccountPersonalAccessTokenController(service);

    @Test
    void listsTokensForAuthenticatedUser() {
        var token = tokenView();
        when(service.list(USERNAME)).thenReturn(List.of(token));

        assertThat(controller.list(authentication())).containsExactly(token);
        verify(service).list(USERNAME);
    }

    @Test
    void createsTokenWithoutCachingTheOneTimeSecret() {
        var request = new PersonalAccessTokenRequestDTO("Codex", null, "30", null);
        var created = createdView();
        when(service.create(USERNAME, request)).thenReturn(created);

        var response = controller.create(authentication(), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getBody()).isSameAs(created);
        verify(service).create(USERNAME, request);
    }

    @Test
    void revokesTokenForAuthenticatedUser() {
        var response = controller.revoke(authentication(), "token-id");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).revoke(USERNAME, "token-id");
    }

    private static UsernamePasswordAuthenticationToken authentication() {
        return UsernamePasswordAuthenticationToken.authenticated(USERNAME, "ignored", List.of());
    }

    private static PersonalAccessTokenDTO tokenView() {
        return new PersonalAccessTokenDTO(
                "token-id", "Codex", null, "mcp.read", Instant.EPOCH, null);
    }

    private static PersonalAccessTokenCreatedDTO createdView() {
        return new PersonalAccessTokenCreatedDTO(
                "token-id", "Codex", null, "secret", "mcp.read", Instant.EPOCH, null);
    }
}
