package io.github.susimsek.kitezh.config.cache;

import static org.assertj.core.api.Assertions.assertThat;

import com.github.benmanes.caffeine.jcache.spi.CaffeineCachingProvider;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.AdminEventSettingsEntity;
import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.AuthorizationConsentEntity;
import io.github.susimsek.kitezh.domain.BrandingSettingsEntity;
import io.github.susimsek.kitezh.domain.CibaPolicyEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.EmailSettingsEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.LocalizationMessageOverrideEntity;
import io.github.susimsek.kitezh.domain.LocalizationSettingsEntity;
import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.domain.OfflineAccessPolicyEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.domain.UserEventSettingsEntity;
import io.github.susimsek.kitezh.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.kitezh.repository.AdminEventSettingsRepository;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.BrandingSettingsRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.repository.EmailSettingsRepository;
import io.github.susimsek.kitezh.repository.GroupRepository;
import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import io.github.susimsek.kitezh.repository.LocalizationSettingsRepository;
import io.github.susimsek.kitezh.repository.LoginSettingsRepository;
import io.github.susimsek.kitezh.repository.OAuth2KeyRepository;
import io.github.susimsek.kitezh.repository.RequiredActionDefinitionRepository;
import io.github.susimsek.kitezh.repository.SocialProviderMapperRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.DesktopReleaseService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.cache.CacheManager;
import javax.cache.Caching;
import org.hibernate.cache.jcache.ConfigSettings;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.cache.autoconfigure.JCacheManagerCustomizer;
import org.springframework.boot.cache.metrics.CacheMetricsRegistrar;
import org.springframework.boot.cache.metrics.CaffeineCacheMeterBinderProvider;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.cache.Cache;
import org.springframework.cache.caffeine.CaffeineCacheManager;

@SuppressWarnings("java:S5961")
class CacheConfigTest {

    @AfterEach
    void tearDown() {
        Caching.getCachingProvider(CaffeineCachingProvider.class.getName()).close();
    }

    @Test
    void usesDefaultCaffeineProperties() {
        ApplicationProperties.Caffeine caffeine =
                new ApplicationProperties.Caffeine(Duration.ofHours(1), 500, 1000L, Map.of());

        assertThat(caffeine.ttl()).isEqualTo(Duration.ofHours(1));
        assertThat(caffeine.initialCapacity()).isEqualTo(500);
        assertThat(caffeine.maximumSize()).isEqualTo(1000L);
    }

    @Test
    void createsSpringCacheManagerFromApplicationProperties() {
        org.springframework.cache.CacheManager cacheManager =
                new CacheConfig(applicationProperties()).cacheManager();

        assertThat(cacheManager).isInstanceOf(CaffeineCacheManager.class);
        Cache cache = cacheManager.getCache(UserRepository.USER_BY_USERNAME_CACHE);
        assertThat(cache).isNotNull();
        assertThat(cacheManager.getCache(DesktopReleaseService.LATEST_DESKTOP_RELEASE_CACHE))
                .isNotNull();
        cache.put("key", "value");
        assertThat(cache.get("key", String.class)).isEqualTo("value");
    }

    @Test
    void appliesDesktopReleaseCacheTtlSeparately() {
        CaffeineCacheManager cacheManager =
                (CaffeineCacheManager) new CacheConfig(applicationProperties()).cacheManager();

        com.github.benmanes.caffeine.cache.Cache<?, ?> nativeCache =
                ((org.springframework.cache.caffeine.CaffeineCache)
                                cacheManager.getCache(
                                        DesktopReleaseService.LATEST_DESKTOP_RELEASE_CACHE))
                        .getNativeCache();

        assertThat(nativeCache.policy().expireAfterWrite()).isPresent();
        assertThat(
                        nativeCache
                                .policy()
                                .expireAfterWrite()
                                .orElseThrow()
                                .getExpiresAfter(java.util.concurrent.TimeUnit.MINUTES))
                .isEqualTo(15);
        assertThat(nativeCache.policy().eviction()).isPresent();
        assertThat(nativeCache.policy().eviction().orElseThrow().getMaximum()).isEqualTo(1);
    }

    @Test
    void bindsCaffeineCacheMetrics() {
        org.springframework.cache.CacheManager cacheManager =
                new CacheConfig(applicationProperties()).cacheManager();
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        CacheMetricsRegistrar registrar =
                new CacheMetricsRegistrar(
                        registry, List.of(new CaffeineCacheMeterBinderProvider()));
        Cache cache = cacheManager.getCache(UserRepository.USER_BY_USERNAME_CACHE);

        assertThat(cache).isNotNull();
        assertThat(registrar.bindCacheToRegistry(cache)).isTrue();

        cache.get("missing");
        cache.put("key", "value");
        cache.get("key");

        assertThat(
                        registry.get("cache.gets")
                                .tag("name", UserRepository.USER_BY_USERNAME_CACHE)
                                .tag("result", "hit")
                                .functionCounter()
                                .count())
                .isEqualTo(1);
        assertThat(
                        registry.get("cache.gets")
                                .tag("name", UserRepository.USER_BY_USERNAME_CACHE)
                                .tag("result", "miss")
                                .functionCounter()
                                .count())
                .isEqualTo(1);
    }

    @Test
    void bindsApplicationCacheMetricsAtStartup() {
        CacheConfig configuration = new CacheConfig(applicationProperties());
        CaffeineCacheManager cacheManager = configuration.cacheManager();
        SimpleMeterRegistry registry = new SimpleMeterRegistry();

        configuration.cacheMetricsRegistrar(registry, cacheManager);

        assertThat(
                        registry.get("cache.gets")
                                .tag("name", UserRepository.USER_BY_USERNAME_CACHE)
                                .tag("result", "hit")
                                .functionCounter()
                                .count())
                .isZero();
    }

    @Test
    void registersHibernateSecondLevelCacheRegions() {
        CacheConfig.HibernateSecondLevelCacheConfiguration configuration =
                new CacheConfig.HibernateSecondLevelCacheConfiguration(applicationProperties());
        JCacheManagerCustomizer customizer = configuration.cacheManagerCustomizer();

        CacheManager cacheManager = configuration.jcacheManager(customizer);
        assertThat(cacheManager.getCache(AdminEventSettingsEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(AuthorizationConsentEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(BrandingSettingsEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(AuthorityEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(AuthorityEntity.class.getName() + ".compositeRoles"))
                .isNotNull();
        assertThat(cacheManager.getCache(AuthorityEntity.class.getName() + ".compositeParents"))
                .isNotNull();
        assertThat(cacheManager.getCache(AuthorityEntity.class.getName() + ".compositeClientRoles"))
                .isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(CibaPolicyEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName() + ".groups")).isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName() + ".users")).isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName() + ".compositeRoles"))
                .isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName() + ".compositeParents"))
                .isNotNull();
        assertThat(cacheManager.getCache(ClientRoleEntity.class.getName() + ".compositeRealmRoles"))
                .isNotNull();
        assertThat(cacheManager.getCache(EmailSettingsEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(GroupEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(GroupEntity.class.getName() + ".authorities")).isNotNull();
        assertThat(cacheManager.getCache(GroupEntity.class.getName() + ".attributes")).isNotNull();
        assertThat(cacheManager.getCache(LoginSettingsEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(LocalizationMessageOverrideEntity.class.getName()))
                .isNotNull();
        assertThat(cacheManager.getCache(LocalizationSettingsEntity.class.getName())).isNotNull();
        assertThat(
                        cacheManager.getCache(
                                LocalizationMessageOverrideRepository
                                        .LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                LocalizationSettingsRepository.LOCALIZATION_SETTINGS_BY_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(OAuth2KeyEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(OfflineAccessPolicyEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(RegisteredClientEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(RequiredActionDefinitionEntity.class.getName()))
                .isNotNull();
        assertThat(cacheManager.getCache(SocialProviderEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(SocialProviderMapperEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(UserEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(UserEntity.class.getName() + ".authorities")).isNotNull();
        assertThat(cacheManager.getCache(UserEntity.class.getName() + ".groups")).isNotNull();
        assertThat(cacheManager.getCache(UserEventSettingsEntity.class.getName())).isNotNull();
        assertThat(cacheManager.getCache(UserEventSettingsEntity.class.getName() + ".eventTypes"))
                .isNotNull();
        assertThat(cacheManager.getCache(UserProfileAttributeDefinitionEntity.class.getName()))
                .isNotNull();
        assertThat(cacheManager.getCache(ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(AuthorityRepository.AUTHORITY_BY_NAME_CACHE)).isNotNull();
        assertThat(cacheManager.getCache(ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(OAuth2KeyRepository.OAUTH2_KEYS_CACHE)).isNotNull();
        assertThat(
                        cacheManager.getCache(
                                RequiredActionDefinitionRepository.ENABLED_REQUIRED_ACTIONS_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(UserRepository.USER_BY_USERNAME_CACHE)).isNotNull();
        assertThat(cacheManager.getCache(GroupRepository.DEFAULT_GROUPS_CACHE)).isNotNull();
        assertThat(
                        cacheManager.getCache(
                                AdminEventSettingsRepository.ADMIN_EVENT_SETTINGS_BY_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(BrandingSettingsRepository.BRANDING_SETTINGS_BY_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(EmailSettingsRepository.EMAIL_SETTINGS_BY_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(LoginSettingsRepository.LOGIN_SETTINGS_BY_ID_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                UserProfileAttributeDefinitionRepository
                                        .ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                UserProfileAttributeDefinitionRepository
                                        .ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                UserProfileAttributeDefinitionRepository
                                        .PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                SocialProviderRepository.SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE))
                .isNotNull();
        assertThat(cacheManager.getCache(SocialProviderRepository.SOCIAL_PROVIDER_BY_ALIAS_CACHE))
                .isNotNull();
        assertThat(
                        cacheManager.getCache(
                                SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE))
                .isNotNull();
    }

    @Test
    void exposesJCacheManagerToHibernate() {
        CacheConfig.HibernateSecondLevelCacheConfiguration configuration =
                new CacheConfig.HibernateSecondLevelCacheConfiguration(applicationProperties());
        CacheManager cacheManager =
                Caching.getCachingProvider(CaffeineCachingProvider.class.getName())
                        .getCacheManager();
        HibernatePropertiesCustomizer customizer =
                configuration.hibernatePropertiesCustomizer(cacheManager);
        Map<String, Object> properties = new HashMap<>();

        customizer.customize(properties);

        assertThat(properties).containsEntry(ConfigSettings.CACHE_MANAGER, cacheManager);
    }

    private static ApplicationProperties applicationProperties() {
        return new ApplicationProperties(
                new ApplicationProperties.Cache(
                        new ApplicationProperties.Caffeine(
                                Duration.ofMinutes(5),
                                10,
                                100,
                                Map.of(
                                        DesktopReleaseService.LATEST_DESKTOP_RELEASE_CACHE,
                                        new ApplicationProperties.CacheOverride(
                                                Duration.ofMinutes(15), 1, 1)))),
                new ApplicationProperties.Session("0 * * * * *"),
                new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                new ApplicationProperties.Mail(
                        false, "no-reply@localhost", "https://issuer.example"));
    }
}
