package io.github.susimsek.kitezh.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/** Shared CORS configuration for packaged renderers and browser integrations. */
@Configuration(proxyBeanMethods = false)
public class CorsConfig {

    private static final Pattern SAML_FORM_PATH =
            Pattern.compile("/(?:login/saml2/sso|logout/saml2/slo)/[a-z0-9][a-z0-9_-]{0,49}");

    @Bean
    FilterRegistrationBean<CorsFilter> corsFilter(
            @Value("${app.desktop.renderer-origin:app://renderer}") String rendererOrigin) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(rendererOrigin));
        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(
                List.of("Authorization", "Content-Type", "Accept", "DPoP", "X-Requested-With"));
        configuration.setExposedHeaders(List.of("DPoP-Nonce", "Location"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        // SAML bindings use cross-origin document navigation, not cross-origin API reads.
        // No CORS permission is granted here; the SAML filter still validates every message.
        CorsConfigurationSource source =
                request -> isSamlFormNavigation(request) ? null : configuration;
        FilterRegistrationBean<CorsFilter> registration =
                new FilterRegistrationBean<>(new CorsFilter(source));
        registration.setOrder(-100);
        return registration;
    }

    private static boolean isSamlFormNavigation(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String contentType = request.getContentType();
        String mode = request.getHeader("Sec-Fetch-Mode");
        return SAML_FORM_PATH.matcher(path).matches()
                && contentType != null
                && MediaType.APPLICATION_FORM_URLENCODED_VALUE.equalsIgnoreCase(
                        contentType.split(";", 2)[0].trim())
                && (mode == null || "navigate".equals(mode));
    }
}
