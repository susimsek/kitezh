package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SecurityJacksonConfigTest {

    @Test
    void createsDedicatedSecurityJsonMapper() {
        SecurityJacksonConfig config = new SecurityJacksonConfig();

        SecurityJsonMapper mapper = config.securityJsonMapper();

        assertThat(mapper).isNotNull();
        assertThat(mapper.delegate()).isNotNull();
    }
}
