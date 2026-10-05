package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpRequestResponseHolder;
import org.springframework.security.web.context.SecurityContextRepository;

class SecurityContextRepositoryTest {

    @Test
    void delegatesReadOnlyRepositoryOperationsAndIgnoresSave() {
        SecurityContextRepository delegate = mock(SecurityContextRepository.class);
        ReadOnlySecurityContextRepository repository =
                new ReadOnlySecurityContextRepository(delegate);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        final SecurityContext context = mock(SecurityContext.class);
        final HttpRequestResponseHolder holder = new HttpRequestResponseHolder(request, response);

        when(delegate.containsContext(request)).thenReturn(true);

        assertThat(repository.containsContext(request)).isTrue();
        repository.loadDeferredContext(request);
        repository.loadContext(holder);
        repository.saveContext(context, request, response);

        verify(delegate).containsContext(request);
        verify(delegate).loadDeferredContext(request);
        verify(delegate).loadContext(holder);
    }

    @Test
    void usesNullRepositoryForTokenRequestsAndBrowserRepositoryOtherwise() {
        AuthorizationServerSecurityContextRepository repository =
                new AuthorizationServerSecurityContextRepository();
        MockHttpServletRequest tokenRequest = new MockHttpServletRequest();
        tokenRequest.setRequestURI("/oauth2/token");
        MockHttpServletResponse tokenResponse = new MockHttpServletResponse();
        final SecurityContext context = mock(SecurityContext.class);

        assertThat(repository.containsContext(tokenRequest)).isFalse();
        repository.loadDeferredContext(tokenRequest);
        repository.loadContext(new HttpRequestResponseHolder(tokenRequest, tokenResponse));
        repository.saveContext(context, tokenRequest, tokenResponse);

        MockHttpServletRequest browserRequest = new MockHttpServletRequest();
        browserRequest.setRequestURI("/login");
        MockHttpServletResponse browserResponse = new MockHttpServletResponse();
        assertThat(repository.containsContext(browserRequest)).isFalse();
        repository.loadDeferredContext(browserRequest);
        repository.loadContext(new HttpRequestResponseHolder(browserRequest, browserResponse));
        repository.saveContext(context, browserRequest, browserResponse);
    }
}
