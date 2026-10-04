package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.DeferredSecurityContext;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpRequestResponseHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/** Keeps OAuth client authentication from reading or replacing the browser SSO context. */
final class AuthorizationServerSecurityContextRepository implements SecurityContextRepository {

    private final SecurityContextRepository browser =
            new ReadOnlySecurityContextRepository(new HttpSessionSecurityContextRepository());
    private final SecurityContextRepository token = new NullSecurityContextRepository();

    @Override
    public boolean containsContext(HttpServletRequest request) {
        return repository(request).containsContext(request);
    }

    @Override
    public DeferredSecurityContext loadDeferredContext(HttpServletRequest request) {
        return repository(request).loadDeferredContext(request);
    }

    @Override
    public SecurityContext loadContext(HttpRequestResponseHolder requestResponseHolder) {
        return repository(requestResponseHolder.getRequest()).loadContext(requestResponseHolder);
    }

    @Override
    public void saveContext(
            SecurityContext context, HttpServletRequest request, HttpServletResponse response) {
        repository(request).saveContext(context, request, response);
    }

    private SecurityContextRepository repository(HttpServletRequest request) {
        return "/oauth2/token".equals(request.getRequestURI()) ? token : browser;
    }
}
