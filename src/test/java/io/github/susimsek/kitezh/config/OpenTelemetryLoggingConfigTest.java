package io.github.susimsek.kitezh.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.opentelemetry.api.OpenTelemetry;
import org.junit.jupiter.api.Test;

class OpenTelemetryLoggingConfigTest {

    @Test
    void createsLogbackAppenderInstaller() {
        OpenTelemetryLoggingConfig configuration = new OpenTelemetryLoggingConfig();

        assertThat(configuration.installOpenTelemetryLogbackAppender(OpenTelemetry.noop()))
                .isNotNull();
    }
}
