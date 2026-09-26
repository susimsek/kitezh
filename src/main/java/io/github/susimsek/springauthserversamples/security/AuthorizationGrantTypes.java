package io.github.susimsek.springauthserversamples.security;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** OAuth 2.0 grant type values supported by the application. */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class AuthorizationGrantTypes {

    /** RFC 8693 OAuth 2.0 Token Exchange grant. */
    public static final String TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
}
