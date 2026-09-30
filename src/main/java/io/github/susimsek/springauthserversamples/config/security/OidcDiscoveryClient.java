package io.github.susimsek.springauthserversamples.config.security;

import java.net.URI;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/** Typed HTTP client for OpenID Connect provider metadata. */
@HttpExchange(accept = MediaType.APPLICATION_JSON_VALUE)
public interface OidcDiscoveryClient {

    @GetExchange
    Map<String, Object> discover(URI endpoint);
}
