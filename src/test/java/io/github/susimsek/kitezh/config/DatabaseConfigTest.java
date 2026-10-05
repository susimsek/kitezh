package io.github.susimsek.kitezh.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.security.SecurityAuditorAware;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;

class DatabaseConfigTest {

    @Test
    void createsSecurityAuditorAwareBean() {
        AuditorAware<String> auditorAware = new DatabaseConfig().auditorAware();

        assertThat(auditorAware).isInstanceOf(SecurityAuditorAware.class);
    }
}
