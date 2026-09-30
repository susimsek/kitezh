package io.github.susimsek.springauthserversamples;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.config.aot.NativeRuntimeHints;
import io.github.susimsek.springauthserversamples.config.observability.LoggingProperties;
import io.github.susimsek.springauthserversamples.config.security.OidcDiscoveryClient;
import io.github.susimsek.springauthserversamples.config.security.SocialLoginProperties;
import io.github.susimsek.springauthserversamples.service.ciba.CibaNotificationClient;
import io.github.susimsek.springauthserversamples.service.security.RegistrationCaptchaClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.web.service.registry.ImportHttpServices;

@SpringBootApplication
@EnableConfigurationProperties({
    ApplicationProperties.class,
    SocialLoginProperties.class,
    LoggingProperties.class
})
@ImportRuntimeHints(NativeRuntimeHints.class)
@ImportHttpServices(group = "ciba", types = CibaNotificationClient.class)
@ImportHttpServices(group = "oidc-discovery", types = OidcDiscoveryClient.class)
@ImportHttpServices(group = "registration-captcha", types = RegistrationCaptchaClient.class)
@EnableAsync
@EnableSpringDataWebSupport(
        pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
public class SpringAuthorizationServerSamplesApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpringAuthorizationServerSamplesApplication.class, args);
    }
}
