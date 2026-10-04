package io.github.susimsek.kitezh.config.observability;

import org.springframework.boot.restclient.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Adds opt-in, redacted logging to the shared Spring HTTP client builder. */
@Configuration(proxyBeanMethods = false)
public class OutgoingHttpLoggingConfiguration {

    @Bean
    RestClientCustomizer outgoingHttpLoggingCustomizer(LoggingProperties properties) {
        LoggingProperties.HttpClient client = properties.getClient();
        if (!client.isEnabled()) {
            return builder -> {};
        }
        OutgoingHttpLoggingInterceptor interceptor =
                new OutgoingHttpLoggingInterceptor(
                        client, properties.getObfuscate(), properties.getMaxBodyBytes());
        return builder -> builder.requestInterceptor(interceptor);
    }
}
