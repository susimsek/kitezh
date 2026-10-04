package io.github.susimsek.kitezh.config.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class SecurityJacksonConfig {

    @Bean
    SecurityJsonMapper securityJsonMapper() {
        return new SecurityJsonMapper(getClass().getClassLoader());
    }
}
