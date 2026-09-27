package io.github.susimsek.springauthserversamples.config.cache;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.jcache.configuration.CaffeineConfiguration;
import com.github.benmanes.caffeine.jcache.spi.CaffeineCachingProvider;
import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.AdminEventSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.EmailSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.LocalizationMessageOverrideEntity;
import io.github.susimsek.springauthserversamples.domain.LocalizationSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.OAuth2KeyEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.springauthserversamples.domain.SocialProviderEntity;
import io.github.susimsek.springauthserversamples.domain.SocialProviderMapperEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.springauthserversamples.repository.AdminEventSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.EmailSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.LocalizationMessageOverrideRepository;
import io.github.susimsek.springauthserversamples.repository.LocalizationSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.LoginSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.OAuth2KeyRepository;
import io.github.susimsek.springauthserversamples.repository.RequiredActionDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.SocialProviderMapperRepository;
import io.github.susimsek.springauthserversamples.repository.SocialProviderRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import java.util.OptionalLong;
import javax.cache.Cache;
import javax.cache.CacheManager;
import javax.cache.Caching;
import lombok.RequiredArgsConstructor;
import org.hibernate.cache.jcache.ConfigSettings;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.cache.autoconfigure.JCacheManagerCustomizer;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableCaching
@RequiredArgsConstructor
public class CacheConfig {

    private final ApplicationProperties applicationProperties;

    @Bean
    public CaffeineCacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(buildCaffeineConfig(cacheProperties()));
        return cacheManager;
    }

    private ApplicationProperties.Caffeine cacheProperties() {
        return applicationProperties.cache().caffeine();
    }

    private Caffeine<Object, Object> buildCaffeineConfig(ApplicationProperties.Caffeine config) {
        return Caffeine.newBuilder()
                .expireAfterWrite(config.ttl())
                .initialCapacity(config.initialCapacity())
                .maximumSize(config.maximumSize())
                .recordStats();
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(
            name = "spring.jpa.properties.hibernate.cache.use_second_level_cache",
            havingValue = "true")
    @RequiredArgsConstructor
    static class HibernateSecondLevelCacheConfiguration {

        private final ApplicationProperties applicationProperties;

        @Bean
        CacheManager jcacheManager(JCacheManagerCustomizer customizer) {
            CacheManager manager =
                    Caching.getCachingProvider(CaffeineCachingProvider.class.getName())
                            .getCacheManager();
            customizer.customize(manager);
            return manager;
        }

        @Bean
        HibernatePropertiesCustomizer hibernatePropertiesCustomizer(CacheManager jcacheManager) {
            return properties -> properties.put(ConfigSettings.CACHE_MANAGER, jcacheManager);
        }

        @Bean
        JCacheManagerCustomizer cacheManagerCustomizer() {
            return cacheManager -> {
                createCache(cacheManager, AdminEventSettingsEntity.class.getName());
                createCache(cacheManager, AuthorizationConsentEntity.class.getName());
                createCache(cacheManager, ClientScopeEntity.class.getName());
                createCache(cacheManager, ClientRoleEntity.class.getName());
                createCache(cacheManager, ClientRoleEntity.class.getName() + ".groups");
                createCache(cacheManager, ClientRoleEntity.class.getName() + ".users");
                createCache(cacheManager, EmailSettingsEntity.class.getName());
                createCache(cacheManager, GroupEntity.class.getName());
                createCache(cacheManager, GroupEntity.class.getName() + ".authorities");
                createCache(cacheManager, GroupEntity.class.getName() + ".attributes");
                createCache(cacheManager, LoginSettingsEntity.class.getName());
                createCache(cacheManager, LocalizationMessageOverrideEntity.class.getName());
                createCache(cacheManager, LocalizationSettingsEntity.class.getName());
                createCache(
                        cacheManager,
                        LocalizationMessageOverrideRepository
                                .LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE);
                createCache(
                        cacheManager,
                        LocalizationSettingsRepository.LOCALIZATION_SETTINGS_BY_ID_CACHE);
                createCache(cacheManager, AuthorityEntity.class.getName());
                createCache(cacheManager, OAuth2KeyEntity.class.getName());
                createCache(cacheManager, RegisteredClientEntity.class.getName());
                createCache(cacheManager, UserEntity.class.getName());
                createCache(cacheManager, UserEntity.class.getName() + ".authorities");
                createCache(cacheManager, UserEntity.class.getName() + ".groups");
                createCache(cacheManager, UserEntity.class.getName() + ".clientRoles");
                createCache(cacheManager, GroupEntity.class.getName() + ".clientRoles");
                createCache(cacheManager, UserProfileAttributeDefinitionEntity.class.getName());
                createCache(cacheManager, RequiredActionDefinitionEntity.class.getName());
                createCache(cacheManager, SocialProviderEntity.class.getName());
                createCache(cacheManager, SocialProviderMapperEntity.class.getName());
                createCache(cacheManager, ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE);
                createCache(cacheManager, AuthorityRepository.AUTHORITY_BY_NAME_CACHE);
                createCache(cacheManager, ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE);
                createCache(cacheManager, OAuth2KeyRepository.OAUTH2_KEYS_CACHE);
                createCache(
                        cacheManager,
                        RequiredActionDefinitionRepository.ENABLED_REQUIRED_ACTIONS_CACHE);
                createCache(cacheManager, UserRepository.USER_BY_USERNAME_CACHE);
                createCache(cacheManager, GroupRepository.DEFAULT_GROUPS_CACHE);
                createCache(
                        cacheManager,
                        AdminEventSettingsRepository.ADMIN_EVENT_SETTINGS_BY_ID_CACHE);
                createCache(cacheManager, EmailSettingsRepository.EMAIL_SETTINGS_BY_ID_CACHE);
                createCache(cacheManager, LoginSettingsRepository.LOGIN_SETTINGS_BY_ID_CACHE);
                createCache(
                        cacheManager,
                        UserProfileAttributeDefinitionRepository
                                .ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE);
                createCache(
                        cacheManager,
                        UserProfileAttributeDefinitionRepository
                                .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE);
                createCache(
                        cacheManager,
                        UserProfileAttributeDefinitionRepository
                                .PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE);
                createCache(
                        cacheManager,
                        SocialProviderRepository.SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE);
                createCache(cacheManager, SocialProviderRepository.SOCIAL_PROVIDER_BY_ALIAS_CACHE);
                createCache(
                        cacheManager,
                        SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE);
            };
        }

        private void createCache(CacheManager cacheManager, String cacheName) {
            Cache<Object, Object> cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
                return;
            }
            ApplicationProperties.Caffeine config = applicationProperties.cache().caffeine();
            CaffeineConfiguration<Object, Object> caffeineConfig = new CaffeineConfiguration<>();
            caffeineConfig.setMaximumSize(OptionalLong.of(config.maximumSize()));
            caffeineConfig.setExpireAfterWrite(OptionalLong.of(config.ttl().toNanos()));
            caffeineConfig.setStatisticsEnabled(true);
            cacheManager.createCache(cacheName, caffeineConfig);
        }
    }
}
