package io.github.susimsek.springauthserversamples.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/** Shared CORS configuration for packaged renderers and browser integrations. */
@Configuration(proxyBeanMethods = false)
public class CorsConfig {

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

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        FilterRegistrationBean<CorsFilter> registration =
                new FilterRegistrationBean<>(new CorsFilter(source));
        registration.setOrder(-100);
        return registration;
    }
}
