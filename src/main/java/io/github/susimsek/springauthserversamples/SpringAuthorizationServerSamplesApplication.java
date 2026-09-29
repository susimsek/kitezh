package io.github.susimsek.springauthserversamples;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.config.aot.NativeRuntimeHints;
import io.github.susimsek.springauthserversamples.config.observability.LoggingProperties;
import io.github.susimsek.springauthserversamples.config.security.SocialLoginProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableConfigurationProperties({
    ApplicationProperties.class,
    SocialLoginProperties.class,
    LoggingProperties.class
})
@ImportRuntimeHints(NativeRuntimeHints.class)
@EnableAsync
@EnableSpringDataWebSupport(
        pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class SpringAuthorizationServerSamplesApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpringAuthorizationServerSamplesApplication.class, args);
    }
}
