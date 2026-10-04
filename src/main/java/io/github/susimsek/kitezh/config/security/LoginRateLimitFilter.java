package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.security.LoginRateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private final LoginRateLimitService loginRateLimitService;
    private final ObjectMapper objectMapper;
    private final MessageSource messageSource;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!"POST".equalsIgnoreCase(request.getMethod())
                || !"/login".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        LoginRateLimitService.RateLimitDecision decision =
                loginRateLimitService.check(
                        request.getParameter("username"), request.getRemoteAddr());
        if (decision.limit() > 0) {
            setRateLimitHeaders(response, decision);
        }
        if (!decision.allowed()) {
            writeProblemDetail(response, request);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void writeProblemDetail(HttpServletResponse response, HttpServletRequest request)
            throws IOException {
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.TOO_MANY_REQUESTS,
                        message(
                                ApiErrorCode.RATE_LIMIT_EXCEEDED.messageCode(),
                                ApiErrorCode.RATE_LIMIT_EXCEEDED.defaultMessage(),
                                request));
        problem.setTitle(message("app.api.problem.title", "API request failed", request));
        problem.setType(URI.create(ApiErrorCode.RATE_LIMIT_EXCEEDED.type()));
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("errorCode", ApiErrorCode.RATE_LIMIT_EXCEEDED.value());
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }

    private static void setRateLimitHeaders(
            HttpServletResponse response, LoginRateLimitService.RateLimitDecision decision) {
        String limit = Long.toString(decision.limit());
        String remaining = Long.toString(decision.remaining());
        String reset = Long.toString(decision.resetSeconds());
        response.setHeader("X-RateLimit-Limit", limit);
        response.setHeader("X-RateLimit-Remaining", remaining);
        response.setHeader("X-RateLimit-Reset", reset);
        if (!decision.allowed() && decision.remaining() == 0) {
            response.setHeader("Retry-After", reset);
        }
    }

    private String message(String code, String fallback, HttpServletRequest request) {
        return messageSource.getMessage(code, null, fallback, request.getLocale());
    }
}
