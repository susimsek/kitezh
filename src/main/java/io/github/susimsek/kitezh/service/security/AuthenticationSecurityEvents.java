package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.domain.UserEventType;
import io.github.susimsek.kitezh.service.admin.UserEventService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@RequiredArgsConstructor
public class AuthenticationSecurityEvents {

    private final AccountLockService accountLockService;
    private final LoginRateLimitService loginRateLimitService;
    private final UserEventService userEventService;

    @EventListener
    public void onSuccess(AuthenticationSuccessEvent event) {
        String username = username(event.getAuthentication());
        String clientId = clientId();
        String remoteAddress = remoteAddress();
        accountLockService.recordSuccess(username);
        loginRateLimitService.clear(username, remoteAddress);
        userEventService.record(UserEventType.LOGIN_SUCCESS, username, clientId, remoteAddress);
    }

    @EventListener
    public void onFailure(AbstractAuthenticationFailureEvent event) {
        String username = username(event.getAuthentication());
        String clientId = clientId();
        String remoteAddress = remoteAddress();
        accountLockService.recordFailure(username, remoteAddress);
        userEventService.record(UserEventType.LOGIN_FAILURE, username, clientId, remoteAddress);
    }

    private static String username(Authentication authentication) {
        Object principal = authentication == null ? null : authentication.getPrincipal();
        if (principal instanceof String value) {
            return value;
        }
        return authentication == null ? null : authentication.getName();
    }

    private static String remoteAddress() {
        if (RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return request.getRemoteAddr();
        }
        return "unknown";
    }

    private static String clientId() {
        if (RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest().getParameter("client_id");
        }
        return null;
    }
}
