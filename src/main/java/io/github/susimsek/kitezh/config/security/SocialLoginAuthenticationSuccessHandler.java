package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.SocialAccountLinkRequiredException;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialTokenService;
import io.github.susimsek.kitezh.service.account.MfaService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.savedrequest.HttpSessionRequestCache;
import org.springframework.security.web.savedrequest.SavedRequest;

public class SocialLoginAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final SocialLoginService socialLoginService;
    private final UserDetailsService userDetailsService;
    private final SecurityContextRepository securityContextRepository;
    private final OAuth2AuthorizedClientRepository authorizedClientRepository;
    private final SocialTokenService socialTokenService;
    private final MfaService mfaService;
    private final AuthenticationFailureHandler failureHandler =
            new SimpleUrlAuthenticationFailureHandler("/login?error");
    private final AuthenticationFailureHandler accountLinkFailureHandler =
            new SimpleUrlAuthenticationFailureHandler("/login?account_link_required");
    private final SavedRequestAwareAuthenticationSuccessHandler delegate = delegate();

    public SocialLoginAuthenticationSuccessHandler(
            SocialLoginService socialLoginService,
            UserDetailsService userDetailsService,
            SecurityContextRepository securityContextRepository,
            OAuth2AuthorizedClientRepository authorizedClientRepository,
            SocialTokenService socialTokenService,
            MfaService mfaService) {
        this.socialLoginService = socialLoginService;
        this.userDetailsService = userDetailsService;
        this.securityContextRepository = securityContextRepository;
        this.authorizedClientRepository = authorizedClientRepository;
        this.socialTokenService = socialTokenService;
        this.mfaService = mfaService;
    }

    public SocialLoginAuthenticationSuccessHandler(
            SocialLoginService socialLoginService,
            UserDetailsService userDetailsService,
            SecurityContextRepository securityContextRepository,
            OAuth2AuthorizedClientRepository authorizedClientRepository,
            SocialTokenService socialTokenService) {
        this(
                socialLoginService,
                userDetailsService,
                securityContextRepository,
                authorizedClientRepository,
                socialTokenService,
                null);
    }

    public SocialLoginAuthenticationSuccessHandler(
            SocialLoginService socialLoginService,
            UserDetailsService userDetailsService,
            SecurityContextRepository securityContextRepository) {
        this(socialLoginService, userDetailsService, securityContextRepository, null, null);
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        try {
            if (!(authentication instanceof OAuth2AuthenticationToken oauth2Authentication)) {
                throw new IllegalStateException("Social login requires an OAuth2 authentication");
            }
            OAuth2AuthorizedClient authorizedClient =
                    authorizedClientRepository == null
                            ? null
                            : authorizedClientRepository.loadAuthorizedClient(
                                    oauth2Authentication.getAuthorizedClientRegistrationId(),
                                    oauth2Authentication,
                                    request);
            jakarta.servlet.http.HttpSession session = request.getSession(false);
            Object linkTarget =
                    session == null
                            ? null
                            : session.getAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET);
            String username;
            if (linkTarget instanceof java.util.Map<?, ?> target) {
                username =
                        socialLoginService.linkExisting(
                                value(target, "username"),
                                value(target, "provider"),
                                oauth2Authentication);
                session.removeAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET);
            } else {
                username = socialLoginService.findOrCreate(oauth2Authentication);
            }
            UserDetails user = userDetailsService.loadUserByUsername(username);
            ensureAccountCanAuthenticate(user);
            if (socialTokenService != null) {
                socialTokenService.store(
                        username,
                        oauth2Authentication.getAuthorizedClientRegistrationId(),
                        authorizedClient);
            }
            if (session != null) {
                session.setAttribute(
                        SocialLoginService.SOCIAL_LOGIN_PROVIDER,
                        oauth2Authentication.getAuthorizedClientRegistrationId());
            }
            Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());
            authorities.add(
                    FactorGrantedAuthority.withAuthority(
                                    FactorGrantedAuthority.AUTHORIZATION_CODE_AUTHORITY)
                            .issuedAt(Instant.now())
                            .build());
            Authentication localAuthentication =
                    UsernamePasswordAuthenticationToken.authenticated(user, null, authorities);
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(localAuthentication);
            SecurityContextHolder.setContext(context);
            boolean providerMfaRequired =
                    socialLoginService.providerRequiresMfa(
                            oauth2Authentication.getAuthorizedClientRegistrationId());
            if (providerMfaRequired) {
                ensureProviderMfaAvailable(username);
            }
            securityContextRepository.saveContext(context, request, response);
            completeResponse(
                    request,
                    response,
                    localAuthentication,
                    linkTarget instanceof java.util.Map<?, ?>,
                    providerMfaRequired);
        } catch (RuntimeException exception) {
            if (exception instanceof SocialAccountLinkRequiredException linkRequired) {
                request.getSession(true)
                        .setAttribute(
                                SocialLoginService.PENDING_SOCIAL_LINK, linkRequired.pendingLink());
                accountLinkFailureHandler.onAuthenticationFailure(request, response, linkRequired);
                return;
            }
            failureHandler.onAuthenticationFailure(
                    request,
                    response,
                    exception instanceof AuthenticationException authenticationException
                            ? authenticationException
                            : new org.springframework.security.authentication
                                    .AuthenticationServiceException(
                                    "Social login could not be completed", exception));
        }
    }

    private void completeResponse(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication localAuthentication,
            boolean socialLink,
            boolean providerMfaRequired)
            throws IOException, ServletException {
        if (socialLink) {
            response.sendRedirect("/account/security?social_linked=1");
        } else if (providerMfaRequired) {
            requireProviderMfa(request, response);
        } else {
            delegate.onAuthenticationSuccess(request, response, localAuthentication);
        }
    }

    private static String value(java.util.Map<?, ?> values, String key) {
        Object value = values.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static void ensureAccountCanAuthenticate(UserDetails user) {
        if (!user.isEnabled()) {
            throw new DisabledException("The local account is disabled");
        }
        if (!user.isAccountNonLocked()) {
            throw new LockedException("The local account is locked");
        }
    }

    private void requireProviderMfa(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        SavedRequest savedRequest = new HttpSessionRequestCache().getRequest(request, response);
        String returnTo = savedRequest == null ? "/admin" : savedRequest.getRedirectUrl();
        request.getSession(true).setAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST, returnTo);
        response.sendRedirect(
                "/mfa?return_to="
                        + URLEncoder.encode(returnTo, java.nio.charset.StandardCharsets.UTF_8));
    }

    private void ensureProviderMfaAvailable(String username) {
        if (mfaService == null || !mfaService.status(username).enabled()) {
            throw new org.springframework.security.authentication.AuthenticationServiceException(
                    "This social provider requires an enrolled MFA factor");
        }
    }

    private static SavedRequestAwareAuthenticationSuccessHandler delegate() {
        SavedRequestAwareAuthenticationSuccessHandler handler =
                new SavedRequestAwareAuthenticationSuccessHandler();
        handler.setDefaultTargetUrl("/admin");
        return handler;
    }
}
