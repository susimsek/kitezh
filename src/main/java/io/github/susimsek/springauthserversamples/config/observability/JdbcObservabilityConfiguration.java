package io.github.susimsek.springauthserversamples.config.observability;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.jdbc.datasource.JdbcTelemetry;
import io.opentelemetry.instrumentation.jdbc.datasource.OpenTelemetryDataSource;
import java.util.Objects;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;

/** Adds OpenTelemetry JDBC child spans for connection acquisition and SQL statements. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(JdbcTelemetry.class)
public class JdbcObservabilityConfiguration {

    @Bean
    static BeanPostProcessor jdbcTelemetryDataSourcePostProcessor(
            ObjectProvider<OpenTelemetry> openTelemetryProvider) {
        return new JdbcTelemetryDataSourcePostProcessor(openTelemetryProvider);
    }

    private static final class JdbcTelemetryDataSourcePostProcessor implements BeanPostProcessor {

        private final ObjectProvider<OpenTelemetry> openTelemetryProvider;
        private volatile JdbcTelemetry jdbcTelemetry;

        private JdbcTelemetryDataSourcePostProcessor(
                ObjectProvider<OpenTelemetry> openTelemetryProvider) {
            this.openTelemetryProvider = Objects.requireNonNull(openTelemetryProvider);
        }

        @Override
        public Object postProcessAfterInitialization(@NonNull Object bean, @NonNull String name) {
            if (bean instanceof DataSource dataSource
                    && !(dataSource instanceof OpenTelemetryDataSource)) {
                return jdbcTelemetry().wrap(dataSource);
            }
            return bean;
        }

        private JdbcTelemetry jdbcTelemetry() {
            JdbcTelemetry value = jdbcTelemetry;
            if (value == null) {
                synchronized (this) {
                    value = jdbcTelemetry;
                    if (value == null) {
                        value =
                                JdbcTelemetry.builder(
                                                openTelemetryProvider.getIfAvailable(
                                                        OpenTelemetry::noop))
                                        .setQuerySanitizationEnabled(true)
                                        .setCaptureQueryParameters(false)
                                        .build();
                        jdbcTelemetry = value;
                    }
                }
            }
            return value;
        }
    }
}
