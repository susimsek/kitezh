package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.SamlLoginService;
import io.github.susimsek.kitezh.service.SocialAccountLinkRequiredException;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.account.MfaService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationServiceException;
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
import org.springframework.security.saml2.provider.service.authentication.Saml2AssertionAuthentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2ResponseAssertion;
import org.springframework.security.saml2.provider.service.authentication.Saml2ResponseAssertionAccessor;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.context.SecurityContextRepository;

/** Establishes the local application session after Spring Security validates a SAML response. */
@RequiredArgsConstructor
public final class SamlLoginAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final SamlLoginService samlLoginService;
    private final UserDetailsService userDetailsService;
    private final SecurityContextRepository securityContextRepository;
    private final MfaService mfaService;
    private final AuthenticationFailureHandler failureHandler =
            new SimpleUrlAuthenticationFailureHandler("/login?error");
    private final AuthenticationFailureHandler accountLinkFailureHandler =
            new SimpleUrlAuthenticationFailureHandler("/login?account_link_required");
    private final SavedRequestAwareAuthenticationSuccessHandler delegate = delegate();

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {
        try {
            if (!(authentication instanceof Saml2Authentication samlAuthentication)
                    || !(samlAuthentication.getPrincipal()
                            instanceof Saml2AuthenticatedPrincipal)) {
                throw new AuthenticationServiceException(
                        "SAML login requires a SAML authentication");
            }
            String registrationId = registrationId(request);
            Object linkTarget =
                    request.getSession(false) == null
                            ? null
                            : request.getSession(false)
                                    .getAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET);
            if (linkTarget instanceof Map<?, ?> target) {
                String expectedProvider = value(target, "provider");
                if (!Objects.equals(registrationId, expectedProvider)) {
                    throw new AuthenticationServiceException(
                            "The SAML provider did not match the pending link");
                }
                establishLocalSession(
                        request,
                        response,
                        samlAuthentication,
                        value(target, "username"),
                        registrationId);
                samlLoginService.linkExisting(
                        value(target, "username"), registrationId, samlAuthentication);
                request.getSession(false)
                        .removeAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET);
                response.sendRedirect("/account/security?social_linked=1");
                return;
            }
            String username = samlLoginService.findOrCreate(registrationId, samlAuthentication);
            Authentication localAuthentication =
                    establishLocalSession(
                            request, response, samlAuthentication, username, registrationId);
            delegate.onAuthenticationSuccess(request, response, localAuthentication);
        } catch (RuntimeException exception) {
            SecurityContextHolder.clearContext();
            securityContextRepository.saveContext(
                    SecurityContextHolder.createEmptyContext(), request, response);
            if (request.getSession(false) != null) {
                request.getSession(false).removeAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER);
                request.getSession(false)
                        .removeAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED);
            }
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
                            : new AuthenticationServiceException(
                                    "SAML login could not be completed", exception));
        }
    }

    private Authentication establishLocalSession(
            HttpServletRequest request,
            HttpServletResponse response,
            Saml2Authentication samlAuthentication,
            String username,
            String registrationId) {
        UserDetails user = userDetailsService.loadUserByUsername(username);
        ensureAccountCanAuthenticate(user);
        Set<GrantedAuthority> authorities = new HashSet<>(user.getAuthorities());
        authorities.add(
                FactorGrantedAuthority.withAuthority(FactorGrantedAuthority.SAML_RESPONSE_AUTHORITY)
                        .issuedAt(Instant.now())
                        .build());
        Authentication local =
                localAuthentication(user, authorities, samlAuthentication, registrationId);
        if (samlLoginService.providerRequiresMfa(registrationId)) {
            if (mfaService == null || !mfaService.status(username).enabled()) {
                throw new AuthenticationServiceException(
                        "This SAML provider requires an enrolled MFA factor");
            }
            // Enrollment is not verification. The normal authorization flow must challenge MFA.
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(local);
        SecurityContextHolder.setContext(context);
        request.getSession(true)
                .setAttribute(SocialLoginService.SOCIAL_LOGIN_PROVIDER, registrationId);
        securityContextRepository.saveContext(context, request, response);
        return local;
    }

    private static void ensureAccountCanAuthenticate(UserDetails user) {
        if (!user.isEnabled()) {
            throw new DisabledException("The local account is disabled");
        }
        if (!user.isAccountNonLocked()) {
            throw new LockedException("The local account is locked");
        }
    }

    private static Authentication localAuthentication(
            UserDetails user,
            Set<GrantedAuthority> authorities,
            Saml2Authentication authentication,
            String registrationId) {
        if (authentication instanceof Saml2AssertionAuthentication assertionAuthentication
                && assertionAuthentication.getCredentials()
                        instanceof Saml2ResponseAssertionAccessor accessor) {
            Saml2ResponseAssertionAccessor compactAssertion =
                    Saml2ResponseAssertion.withResponseValue("")
                            .nameId(nameId(accessor, user))
                            .sessionIndexes(sessionIndexes(accessor))
                            .attributes(new HashMap<>())
                            .build();
            return new Saml2AssertionAuthentication(
                    user, compactAssertion, authorities, registrationId);
        }
        return UsernamePasswordAuthenticationToken.authenticated(user, null, authorities);
    }

    private static String nameId(Saml2ResponseAssertionAccessor accessor, UserDetails user) {
        return Optional.ofNullable(accessor.getNameId()).orElse(user.getUsername());
    }

    private static List<String> sessionIndexes(Saml2ResponseAssertionAccessor accessor) {
        return Optional.ofNullable(accessor.getSessionIndexes())
                .map(ArrayList::new)
                .orElseGet(ArrayList::new);
    }

    private static String value(Map<?, ?> values, String key) {
        Object value = values.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static String registrationId(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String prefix = "/login/saml2/sso/";
        if (uri == null || !uri.startsWith(prefix) || uri.length() == prefix.length()) {
            throw new AuthenticationServiceException("SAML registration id is missing");
        }
        String registrationId = uri.substring(prefix.length());
        if (!registrationId.matches("[a-z0-9][a-z0-9_-]{0,49}")) {
            throw new AuthenticationServiceException("SAML registration id is invalid");
        }
        return registrationId;
    }

    private static SavedRequestAwareAuthenticationSuccessHandler delegate() {
        SavedRequestAwareAuthenticationSuccessHandler handler =
                new SavedRequestAwareAuthenticationSuccessHandler();
        handler.setDefaultTargetUrl("/admin");
        return handler;
    }
}
