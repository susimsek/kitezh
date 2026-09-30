package io.github.susimsek.springauthserversamples.config.observability;

import org.springframework.boot.restclient.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Adds opt-in, redacted logging to the shared Spring HTTP client builder. */
@Configuration(proxyBeanMethods = false)
public class OutgoingHttpLoggingConfiguration {

    @Bean
    RestClientCustomizer outgoingHttpLoggingCustomizer(LoggingProperties properties) {
        LoggingProperties.HttpClient httpClient = properties.getHttpClient();
        if (!httpClient.isEnabled()) {
            return builder -> {};
        }
        OutgoingHttpLoggingInterceptor interceptor = new OutgoingHttpLoggingInterceptor(httpClient);
        return builder -> builder.requestInterceptor(interceptor);
    }
}
