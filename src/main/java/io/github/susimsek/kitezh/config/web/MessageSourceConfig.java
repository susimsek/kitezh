package io.github.susimsek.kitezh.config.web;

import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.context.MessageSourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(MessageSourceProperties.class)
public class MessageSourceConfig {

    @Bean(name = "bundledMessageSource")
    MessageSource bundledMessageSource(MessageSourceProperties properties) {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasenames(properties.getBasename().toArray(String[]::new));
        source.setDefaultEncoding(properties.getEncoding().name());
        source.setFallbackToSystemLocale(properties.isFallbackToSystemLocale());
        if (properties.getCacheDuration() != null) {
            source.setCacheMillis(properties.getCacheDuration().toMillis());
        }
        source.setAlwaysUseMessageFormat(properties.isAlwaysUseMessageFormat());
        source.setUseCodeAsDefaultMessage(properties.isUseCodeAsDefaultMessage());
        return source;
    }

    @Bean(name = "messageSource")
    @Primary
    MessageSource messageSource(
            @Qualifier("bundledMessageSource") MessageSource bundledMessageSource,
            LocalizationMessageOverrideRepository overrideRepository) {
        return new DatabaseMessageSource(bundledMessageSource, overrideRepository);
    }
}
