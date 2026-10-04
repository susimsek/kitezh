package io.github.susimsek.kitezh.config.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.security.autoconfigure.web.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@Profile("dev & !prod")
@ConditionalOnClass(
        name = "org.springframework.boot.h2console.autoconfigure.H2ConsoleAutoConfiguration")
@ConditionalOnBooleanProperty("spring.h2.console.enabled")
public class H2ConsoleSecurityConfig {

    @Bean
    @Order(0)
    SecurityFilterChain h2ConsoleSecurityFilterChain(HttpSecurity http) {
        http.securityMatcher(PathRequest.toH2Console())
                .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
                .csrf(
                        AbstractHttpConfigurer
                                ::disable) // NOSONAR - the optional local H2 console is isolated by
                // its dedicated matcher.
                .headers(
                        headers ->
                                headers.frameOptions(
                                        HeadersConfigurer.FrameOptionsConfig::sameOrigin));
        return http.build();
    }
}
