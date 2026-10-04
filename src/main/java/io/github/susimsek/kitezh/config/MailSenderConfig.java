package io.github.susimsek.kitezh.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Provides a sender bean for dependency wiring; SMTP settings are loaded from the database. */
@Configuration(proxyBeanMethods = false)
public class MailSenderConfig {

    @Bean
    @ConditionalOnMissingBean(JavaMailSender.class)
    JavaMailSender mailSender() {
        return new JavaMailSenderImpl();
    }
}
