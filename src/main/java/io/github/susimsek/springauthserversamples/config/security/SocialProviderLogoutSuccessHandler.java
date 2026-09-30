package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.service.SocialLoginService;
import io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService;
import io.github.susimsek.springauthserversamples.service.security.OAuth2ObservabilityMetrics;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcLogoutAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.oidc.web.authentication.OidcLogoutAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;

/** Starts an upstream broker logout when the provider exposes a browser logout endpoint. */
public class SocialProviderLogoutSuccessHandler implements AuthenticationSuccessHandler {

    private static final String SUCCESS = "success";

    private final SocialProviderSettingsService providerSettingsService;
    private final SocialProviderLogoutEndpointResolver logoutEndpointResolver;
    private final OAuth2ObservabilityMetrics metrics;
    private final OidcLogoutAuthenticationSuccessHandler delegate =
            new OidcLogoutAuthenticationSuccessHandler();
    private final SecurityContextLogoutHandler securityContextLogoutHandler =
            new SecurityContextLogoutHandler();

    public SocialProviderLogoutSuccessHandler(
            SocialProviderSettingsService providerSettingsService,
            SocialProviderLogoutEndpointResolver logoutEndpointResolver) {
        this(providerSettingsService, logoutEndpointResolver, OAuth2ObservabilityMetrics.noop());
    }

    public SocialProviderLogoutSuccessHandler(
            SocialProviderSettingsService providerSettingsService,
            SocialProviderLogoutEndpointResolver logoutEndpointResolver,
            OAuth2ObservabilityMetrics metrics) {
        this.providerSettingsService = providerSettingsService;
        this.logoutEndpointResolver = logoutEndpointResolver;
        this.metrics = metrics;
    }

    public SocialProviderLogoutSuccessHandler(
            SocialProviderSettingsService providerSettingsService) {
        this(providerSettingsService, new SocialProviderLogoutEndpointResolver());
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        if (!(authentication instanceof OidcLogoutAuthenticationToken logout)) {
            metrics.recordLogout(SUCCESS, null);
            delegate.onAuthenticationSuccess(request, response, authentication);
            return;
        }
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        String provider =
                session == null
                        ? null
                        : (String) session.getAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER);
        SocialProviderSettingsService.ProviderCredentials credentials =
                providerSettingsService.provider(provider);
        String upstreamLogout = credentials == null ? null : upstreamLogout(credentials, logout);
        if (upstreamLogout == null) {
            metrics.recordLogout(SUCCESS, provider);
            delegate.onAuthenticationSuccess(request, response, authentication);
            return;
        }
        if (logout.isPrincipalAuthenticated()) {
            if (session != null) {
                session.removeAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER);
            }
            securityContextLogoutHandler.logout(
                    request, response, (Authentication) logout.getPrincipal());
        }
        metrics.recordLogout(SUCCESS, provider);
        response.sendRedirect(upstreamLogout);
    }

    private String upstreamLogout(
            SocialProviderSettingsService.ProviderCredentials provider,
            OidcLogoutAuthenticationToken logout) {
        String endpoint = logoutEndpointResolver.resolve(provider);
        if (endpoint == null) {
            return null;
        }
        String redirect =
                logout.getPostLogoutRedirectUri() == null
                                || logout.getPostLogoutRedirectUri().isBlank()
                        ? "/"
                        : logout.getPostLogoutRedirectUri();
        String providerType = provider.providerType().toLowerCase(java.util.Locale.ROOT);
        if ("google".equals(providerType) && isBlank(provider.issuerUri())) {
            return appendParameter(endpoint, "continue", redirect);
        }
        if ("github".equals(providerType)) {
            return appendParameter(endpoint, "return_to", redirect);
        }
        if ("linkedin".equals(providerType)) {
            return appendParameter(endpoint, "redirect_uri", redirect);
        }
        String upstream = appendParameter(endpoint, "post_logout_redirect_uri", redirect);
        if (!isBlank(logout.getIdTokenHint())) {
            upstream = appendParameter(upstream, "id_token_hint", logout.getIdTokenHint());
        }
        return upstream;
    }

    private static String appendParameter(String endpoint, String name, String value) {
        String separator = endpoint.contains("?") ? "&" : "?";
        return endpoint + separator + name + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
