package io.github.susimsek.kitezh;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.aot.NativeRuntimeHints;
import io.github.susimsek.kitezh.config.observability.LoggingProperties;
import io.github.susimsek.kitezh.config.security.SocialLoginProperties;
import io.github.susimsek.kitezh.service.client.CibaNotificationClient;
import io.github.susimsek.kitezh.service.client.DesktopReleaseClient;
import io.github.susimsek.kitezh.service.client.OidcDiscoveryClient;
import io.github.susimsek.kitezh.service.client.RegistrationCaptchaClient;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ImportRuntimeHints;
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
@ImportHttpServices(group = "github-release", types = DesktopReleaseClient.class)
@ImportHttpServices(group = "oidc-discovery", types = OidcDiscoveryClient.class)
@ImportHttpServices(group = "registration-captcha", types = RegistrationCaptchaClient.class)
@EnableAsync
public class KitezhApplication {

    public static void main(String[] args) {
        SpringApplication.run(KitezhApplication.class, args);
    }
}
