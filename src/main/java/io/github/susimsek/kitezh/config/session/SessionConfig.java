package io.github.susimsek.kitezh.config.session;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import io.github.susimsek.kitezh.session.JpaSessionMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.session.autoconfigure.SessionProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.support.GenericConversionService;
import org.springframework.core.serializer.Deserializer;
import org.springframework.core.serializer.Serializer;
import org.springframework.core.serializer.support.DeserializingConverter;
import org.springframework.core.serializer.support.SerializingConverter;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.session.MapSession;
import org.springframework.session.config.annotation.web.http.EnableSpringHttpSession;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SessionProperties.class)
@EnableSpringHttpSession
@EnableScheduling
public class SessionConfig {

    @Bean("springSessionConversionService")
    public ConversionService springSessionConversionService(SecurityJsonMapper securityJsonMapper) {
        GenericConversionService conversionService = new GenericConversionService();
        conversionService.addConverter(
                Object.class,
                byte[].class,
                new SerializingConverter(new JsonSerializer(securityJsonMapper)));
        conversionService.addConverter(
                byte[].class,
                Object.class,
                new DeserializingConverter(new JsonDeserializer(securityJsonMapper)));
        return conversionService;
    }

    @Bean
    JpaSessionMapper jpaSessionMapper(
            @Qualifier("springSessionConversionService") ConversionService conversionService) {
        return new JpaSessionMapper(conversionService);
    }

    @Bean
    JpaIndexedSessionRepository sessionRepository(
            UserSessionRepository userSessionRepository,
            PlatformTransactionManager transactionManager,
            JpaSessionMapper jpaSessionMapper) {
        return new JpaIndexedSessionRepository(
                userSessionRepository, transactionManager, jpaSessionMapper);
    }

    @Bean
    SessionCleanupScheduler sessionCleanupScheduler(
            JpaIndexedSessionRepository sessionRepository,
            TaskScheduler taskScheduler,
            SessionProperties sessionProperties,
            ApplicationProperties applicationProperties,
            LoginSettingsService loginSettingsService) {
        Duration timeout = sessionProperties.getTimeout();
        if (loginSettingsService != null) {
            timeout =
                    Duration.ofMinutes(
                            loginSettingsService.adminLoginSettings().sessionTimeoutMinutes());
        }
        return configureSessionCleanupScheduler(
                sessionRepository, taskScheduler, applicationProperties, timeout);
    }

    SessionCleanupScheduler sessionCleanupScheduler(
            JpaIndexedSessionRepository sessionRepository,
            TaskScheduler taskScheduler,
            SessionProperties sessionProperties,
            ApplicationProperties applicationProperties) {
        return configureSessionCleanupScheduler(
                sessionRepository,
                taskScheduler,
                applicationProperties,
                sessionProperties.getTimeout());
    }

    private static SessionCleanupScheduler configureSessionCleanupScheduler(
            JpaIndexedSessionRepository sessionRepository,
            TaskScheduler taskScheduler,
            ApplicationProperties applicationProperties,
            Duration timeout) {
        sessionRepository.setDefaultMaxInactiveInterval(
                timeout != null ? timeout : MapSession.DEFAULT_MAX_INACTIVE_INTERVAL);
        return createSessionCleanupScheduler(
                sessionRepository, taskScheduler, applicationProperties.session().cleanupCron());
    }

    private static SessionCleanupScheduler createSessionCleanupScheduler(
            JpaIndexedSessionRepository sessionRepository,
            TaskScheduler taskScheduler,
            String cleanupCron) {
        return new SessionCleanupScheduler(sessionRepository, taskScheduler, cleanupCron);
    }

    private static final class JsonSerializer implements Serializer<Object> {

        private final SecurityJsonMapper securityJsonMapper;

        private JsonSerializer(SecurityJsonMapper securityJsonMapper) {
            this.securityJsonMapper = securityJsonMapper;
        }

        @Override
        public void serialize(Object object, OutputStream outputStream) throws IOException {
            securityJsonMapper.writeSessionAttribute(object, outputStream);
        }
    }

    private static final class JsonDeserializer implements Deserializer<Object> {

        private final SecurityJsonMapper securityJsonMapper;

        private JsonDeserializer(SecurityJsonMapper securityJsonMapper) {
            this.securityJsonMapper = securityJsonMapper;
        }

        @Override
        public Object deserialize(InputStream inputStream) throws IOException {
            return securityJsonMapper.readSessionAttribute(inputStream);
        }
    }
}
