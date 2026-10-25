package io.github.susimsek.kitezh.service.account;

import java.time.Instant;
import java.util.List;
import org.springframework.security.authentication.AbstractAuthenticationToken;

/** Additional metadata used while creating a user-owned MCP access token. */
public final class PersonalAccessTokenGrant extends AbstractAuthenticationToken {

    private final Instant expiresAt;

    public PersonalAccessTokenGrant(Instant expiresAt) {
        super(List.of());
        this.expiresAt = expiresAt;
        setAuthenticated(true);
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    @Override
    public Object getCredentials() {
        return "";
    }

    @Override
    public Object getPrincipal() {
        return "personal-access-token";
    }
}
