package io.github.susimsek.kitezh.config.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.DeferredSecurityContext;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpRequestResponseHolder;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * Loads the browser's form-login context for Authorization Server endpoints without allowing client
 * authentication to replace it in the browser session.
 */
final class ReadOnlySecurityContextRepository implements SecurityContextRepository {

    private final SecurityContextRepository delegate;

    ReadOnlySecurityContextRepository(SecurityContextRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public boolean containsContext(HttpServletRequest request) {
        return delegate.containsContext(request);
    }

    @Override
    public DeferredSecurityContext loadDeferredContext(HttpServletRequest request) {
        return delegate.loadDeferredContext(request);
    }

    @Override
    public SecurityContext loadContext(HttpRequestResponseHolder requestResponseHolder) {
        return delegate.loadContext(requestResponseHolder);
    }

    @Override
    public void saveContext(
            SecurityContext context, HttpServletRequest request, HttpServletResponse response) {
        // The Authorization Server authenticates OAuth clients while processing token requests.
        // That authentication belongs to the request only; the browser's form-login context stays
        // in the HTTP session and is used by later authorization requests.
    }
}
