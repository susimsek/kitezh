package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.service.SessionInvalidationService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Invalidates a user's browser sessions and OAuth2 authorizations after an access change. */
@Service
@RequiredArgsConstructor
public class UserAccessInvalidationService {

    private final SessionInvalidationService sessionInvalidationService;

    public void invalidate(String username) {
        sessionInvalidationService.invalidatePrincipal(username);
    }

    public void invalidateForCurrentPrincipal(String username) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !username.equals(authentication.getName())) {
            invalidate(username);
            return;
        }

        String currentSessionId = currentSessionId();
        if (currentSessionId == null) {
            invalidate(username);
            return;
        }
        invalidateOtherSessions(username, currentSessionId);
    }

    public void invalidateOtherSessions(String username, String currentSessionId) {
        if (currentSessionId == null) {
            invalidate(username);
            return;
        }
        sessionInvalidationService.invalidatePrincipalExceptSession(username, currentSessionId);
    }

    private static String currentSessionId() {
        if (!(RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        HttpSession session = attributes.getRequest().getSession(false);
        return session == null ? null : session.getId();
    }
}
