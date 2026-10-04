package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Requires a recently verified MFA factor for the current OAuth authorization request. */
@Component
public class MfaAuthorizationFilter extends OncePerRequestFilter {

    public static final String MFA_VERIFIED = "MFA_TOTP_VERIFIED";
    public static final String MFA_VERIFIED_AT = "MFA_VERIFIED_AT";
    public static final String MFA_VERIFIED_REQUEST = "MFA_VERIFIED_REQUEST";
    public static final String MFA_PENDING_REQUEST = "MFA_PENDING_REQUEST";
    public static final String MFA_CREDENTIAL_VERIFIED = "MFA_CREDENTIAL_VERIFIED";
    private static final Duration DEFAULT_VERIFICATION_TIMEOUT = Duration.ofMinutes(5);

    private final MfaService mfaService;
    private final RequiredActionService requiredActionService;
    private final LoginSettingsService loginSettingsService;
    private final Duration fallbackVerificationTimeout;

    @Autowired
    MfaAuthorizationFilter(
            MfaService mfaService,
            RequiredActionService requiredActionService,
            LoginSettingsService loginSettingsService) {
        this.mfaService = mfaService;
        this.requiredActionService = requiredActionService;
        this.loginSettingsService = loginSettingsService;
        this.fallbackVerificationTimeout = DEFAULT_VERIFICATION_TIMEOUT;
    }

    MfaAuthorizationFilter(MfaService mfaService, RequiredActionService requiredActionService) {
        this.mfaService = mfaService;
        this.requiredActionService = requiredActionService;
        this.loginSettingsService = null;
        this.fallbackVerificationTimeout = DEFAULT_VERIFICATION_TIMEOUT;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if ("/oauth2/authorize".equals(request.getRequestURI())
                && authentication != null
                && authentication.isAuthenticated()
                && !authentication.getClass().getName().contains("Anonymous")
                && requiredActionService.pending(authentication.getName()).isEmpty()) {
            String current = authorizationRequest(request);
            HttpSession session = request.getSession(false);
            var status = mfaService.status(authentication.getName());
            if (!status.available() || !status.enabled()) {
                filterChain.doFilter(request, response);
                return;
            }
            if (isVerified(session, current)) {
                filterChain.doFilter(request, response);
                return;
            }
            clearVerification(session);
            request.getSession(true).setAttribute(MFA_PENDING_REQUEST, current);
            response.sendRedirect(
                    "/mfa?return_to=" + URLEncoder.encode(current, StandardCharsets.UTF_8));
            return;
        }
        filterChain.doFilter(request, response);
    }

    public static void markVerified(HttpSession session) {
        if (session == null) {
            return;
        }
        session.setAttribute(MFA_VERIFIED, true);
        session.setAttribute(MFA_VERIFIED_AT, Instant.now().toEpochMilli());
        Object pending = session.getAttribute(MFA_PENDING_REQUEST);
        if (pending instanceof String request) {
            session.setAttribute(MFA_VERIFIED_REQUEST, request);
        } else {
            session.removeAttribute(MFA_VERIFIED_REQUEST);
        }
        session.removeAttribute(MFA_PENDING_REQUEST);
    }

    /** Marks a successful passkey assertion as the credential factor for the next authorization. */
    public static void markCredentialVerified(HttpSession session) {
        if (session != null) {
            session.setAttribute(MFA_CREDENTIAL_VERIFIED, true);
        }
    }

    private boolean isVerified(HttpSession session, String currentRequest) {
        if (session != null && Boolean.TRUE.equals(session.getAttribute(MFA_CREDENTIAL_VERIFIED))) {
            session.removeAttribute(MFA_CREDENTIAL_VERIFIED);
            return true;
        }
        if (session == null || !Boolean.TRUE.equals(session.getAttribute(MFA_VERIFIED))) {
            return false;
        }
        Object verifiedAt = session.getAttribute(MFA_VERIFIED_AT);
        Object verifiedRequest = session.getAttribute(MFA_VERIFIED_REQUEST);
        if (!(verifiedAt instanceof Number)
                || !(verifiedRequest instanceof String)
                || !currentRequest.equals(verifiedRequest)) {
            return false;
        }
        long age = Instant.now().toEpochMilli() - ((Number) verifiedAt).longValue();
        Duration timeout =
                loginSettingsService == null
                        ? fallbackVerificationTimeout
                        : loginSettingsService.mfaVerificationTimeout();
        return age >= 0 && age <= timeout.toMillis();
    }

    private static void clearVerification(HttpSession session) {
        if (session == null) {
            return;
        }
        session.removeAttribute(MFA_VERIFIED);
        session.removeAttribute(MFA_VERIFIED_AT);
        session.removeAttribute(MFA_VERIFIED_REQUEST);
    }

    private static String authorizationRequest(HttpServletRequest request) {
        String current = request.getRequestURI();
        if (request.getQueryString() != null) {
            current += "?" + request.getQueryString();
        }
        return current;
    }
}
