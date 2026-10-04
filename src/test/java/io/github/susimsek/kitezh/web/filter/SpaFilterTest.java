package io.github.susimsek.kitezh.web.filter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SpaFilterTest {
    private final SpaFilter filter = new SpaFilter();
    private final FilterChain chain = mock(FilterChain.class);

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/",
                "/download",
                "/login",
                "/login/",
                "/consent",
                "/auth-error",
                "/mfa",
                "/forgot-password",
                "/reset-password",
                "/verify-email",
                "/admin",
                "/admin/",
                "/admin/users/123",
                "/admin/users/123/credentials",
                "/admin/clients/abc",
                "/admin/roles/42",
                "/admin/future-resource/runtime-id",
                "/account/personal-info"
            })
    void forwardsFrontendNavigationToOneEntry(String path) throws Exception {
        MockHttpServletRequest request = navigation("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getForwardedUrl()).isEqualTo("/index.html");
        assertThat(response.getRedirectedUrl()).isNull();
        verifyNoInteractions(chain);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/api/admin/users",
                "/oauth2/authorize",
                "/oauth2/token",
                "/.well-known/openid-configuration",
                "/actuator/health",
                "/_next/static/app.js",
                "/avatars/abc",
                "/account/avatar",
                "/account/avatar/file",
                "/oidc/session-status",
                "/v3/api-docs",
                "/swagger-ui/index.html",
                "/h2-console",
                "/error",
                "/logout",
                "/admin/users/123.json",
                "/admin/users/123/index.txt",
                "/admin/file.css",
                "/admin/../api",
                "/admin/file\\name",
                "/favicon.ico",
                "/unknown-backend",
                "/en/admin"
            })
    void leavesBackendAssetsAndUnknownRootsUntouched(String path) throws Exception {
        MockHttpServletRequest request = navigation("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getForwardedUrl()).isNull();
        verify(chain).doFilter(request, response);
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
    void neverForwardsMutations(String method) throws Exception {
        MockHttpServletRequest request = navigation(method, "/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/admin/callback", "/account/callback/"})
    void callbacksUseTheirExplicitStaticEntry(String path) throws Exception {
        MockHttpServletRequest request = navigation("GET", path);
        request.setQueryString("code=abc&state=xyz");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getForwardedUrl()).isEqualTo(path.replaceAll("/$", "") + "/index.html");
        assertThat(request.getQueryString()).isEqualTo("code=abc&state=xyz");
    }

    @Test
    void supportsHeadAndContextPathWithoutRedirecting() throws Exception {
        MockHttpServletRequest request = navigation("HEAD", "/auth/admin/users/123");
        request.setContextPath("/auth");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        assertThat(response.getForwardedUrl()).isEqualTo("/index.html");
    }

    @Test
    void doesNotForwardJsonOrNonNavigationRequests() throws Exception {
        for (String accept : new String[] {"application/json", "*/*"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/admin/users/123");
            request.addHeader("Accept", accept);
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(request, response, chain);
            assertThat(response.getForwardedUrl()).isNull();
            verify(chain).doFilter(request, response);
        }
    }

    @Test
    void ignoresForwardDispatches() throws Exception {
        MockHttpServletRequest request = navigation("GET", "/admin/users/123");
        request.setDispatcherType(DispatcherType.FORWARD);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    private static MockHttpServletRequest navigation(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader("Accept", "text/html,application/xhtml+xml");
        return request;
    }
}
