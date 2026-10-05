package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.service.security.LoginRateLimitService;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.ProblemDetailJacksonMixin;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class LoginRateLimitFilterTest {

    @Test
    void writesLocalizedProblemDetailAndLegacyHeadersWhenBlocked() throws Exception {
        LoginRateLimitService rateLimitService = mock(LoginRateLimitService.class);
        StaticMessageSource messages = new StaticMessageSource();
        messages.addMessage("app.api.problem.title", Locale.ENGLISH, "API request failed");
        messages.addMessage(
                "app.api.problem.rate_limit_exceeded",
                Locale.ENGLISH,
                "Too many login attempts. Please try again later.");
        when(rateLimitService.check("alice", "127.0.0.1"))
                .thenReturn(new LoginRateLimitService.RateLimitDecision(false, 5, 0, 60));

        ObjectMapper objectMapper =
                JsonMapper.builder()
                        .addMixIn(ProblemDetail.class, ProblemDetailJacksonMixin.class)
                        .build();
        LoginRateLimitFilter filter =
                new LoginRateLimitFilter(rateLimitService, objectMapper, messages);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
        request.setParameter("username", "alice");
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = mock(jakarta.servlet.FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentType()).isEqualTo("application/problem+json");
        assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("5");
        assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("0");
        assertThat(response.getHeader("X-RateLimit-Reset")).isEqualTo("60");
        assertThat(response.getHeader("Retry-After")).isEqualTo("60");

        var problem = objectMapper.readTree(response.getContentAsString());
        assertThat(problem.get("status").asInt()).isEqualTo(429);
        assertThat(problem.get("title").asText()).isEqualTo("API request failed");
        assertThat(problem.get("detail").asText())
                .isEqualTo("Too many login attempts. Please try again later.");
        assertThat(problem.get("type").asText()).isEqualTo("urn:problem:rate_limit_exceeded");
        assertThat(problem.get("instance").asText()).isEqualTo("/login");
        assertThat(problem.get("errorCode").asText()).isEqualTo("rate_limit_exceeded");
        verify(rateLimitService).check("alice", "127.0.0.1");
        verifyNoInteractions(chain);
    }
}
