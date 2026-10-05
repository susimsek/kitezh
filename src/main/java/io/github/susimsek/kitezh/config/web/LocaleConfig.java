package io.github.susimsek.kitezh.config.web;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.CookieLocaleResolver;
import org.springframework.web.util.WebUtils;

@Configuration(proxyBeanMethods = false)
public class LocaleConfig {

    public static final String LOCALE_COOKIE_NAME = "locale";
    public static final Set<String> SUPPORTED_LANGUAGES = Set.of("en", "tr");

    private final LocalizationSettingsService localizationSettingsService;
    private final UserRepository userRepository;

    public LocaleConfig() {
        this(null, null);
    }

    public LocaleConfig(LocalizationSettingsService localizationSettingsService) {
        this(localizationSettingsService, null);
    }

    @Autowired
    public LocaleConfig(
            LocalizationSettingsService localizationSettingsService,
            UserRepository userRepository) {
        this.localizationSettingsService = localizationSettingsService;
        this.userRepository = userRepository;
    }

    @Bean
    LocaleResolver localeResolver(WebProperties webProperties) {
        CookieLocaleResolver resolver =
                new UserPreferenceCookieLocaleResolver(
                        LOCALE_COOKIE_NAME, localizationSettingsService, userRepository);
        resolver.setCookiePath("/");
        resolver.setCookieMaxAge(Duration.ofDays(365));
        resolver.setCookieSameSite("Lax");
        resolver.setDefaultLocaleFunction(
                request -> {
                    Locale requested = request.getLocale();
                    if (!isInternationalizationEnabled()) {
                        return Locale.ENGLISH;
                    }
                    if (isSupportedDynamic(requested)) {
                        return normalize(requested);
                    }

                    Locale configured = defaultLocale(webProperties.getLocale());
                    return isSupportedDynamic(configured) ? normalize(configured) : Locale.ENGLISH;
                });
        return resolver;
    }

    private static final class UserPreferenceCookieLocaleResolver extends CookieLocaleResolver {

        private final LocalizationSettingsService localizationSettingsService;
        private final UserRepository userRepository;

        private UserPreferenceCookieLocaleResolver(
                String cookieName,
                LocalizationSettingsService localizationSettingsService,
                UserRepository userRepository) {
            super(cookieName);
            this.localizationSettingsService = localizationSettingsService;
            this.userRepository = userRepository;
        }

        @Override
        public Locale resolveLocale(jakarta.servlet.http.HttpServletRequest request) {
            Locale selected = selectedCookieLocale(request);
            if (selected != null) {
                return selected;
            }
            Locale preferred = authenticatedUserLocale();
            if (preferred != null) {
                return preferred;
            }
            Locale requested = explicitUiLocale(request);
            return requested == null ? super.resolveLocale(request) : requested;
        }

        private Locale selectedCookieLocale(jakarta.servlet.http.HttpServletRequest request) {
            if (localizationSettingsService == null
                    || !localizationSettingsService.isInternationalizationEnabled()) {
                return null;
            }
            Cookie cookie = WebUtils.getCookie(request, LOCALE_COOKIE_NAME);
            if (cookie == null || !StringUtils.hasText(cookie.getValue())) {
                return null;
            }
            Locale selected = Locale.forLanguageTag(cookie.getValue());
            return localizationSettingsService.isSupported(selected)
                    ? LocaleConfig.normalize(selected)
                    : null;
        }

        private Locale explicitUiLocale(jakarta.servlet.http.HttpServletRequest request) {
            if (localizationSettingsService == null
                    || !localizationSettingsService.isInternationalizationEnabled()) {
                return null;
            }
            String uiLocales = request.getParameter("ui_locales");
            if (!StringUtils.hasText(uiLocales)) {
                return null;
            }
            return Arrays.stream(uiLocales.split("\\s+"))
                    .map(Locale::forLanguageTag)
                    .filter(localizationSettingsService::isSupported)
                    .findFirst()
                    .map(LocaleConfig::normalize)
                    .orElse(null);
        }

        private Locale authenticatedUserLocale() {
            if (userRepository == null
                    || localizationSettingsService == null
                    || !localizationSettingsService.isInternationalizationEnabled()) {
                return null;
            }
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null
                    || !authentication.isAuthenticated()
                    || authentication.getName() == null) {
                return null;
            }
            return userRepository
                    .findByUsername(authentication.getName())
                    .map(UserEntity::getPreferredLocale)
                    .filter(value -> value != null && !value.isBlank())
                    .map(Locale::forLanguageTag)
                    .filter(localizationSettingsService::isSupported)
                    .map(LocaleConfig::normalize)
                    .orElse(null);
        }
    }

    public static boolean isSupported(Locale locale) {
        return locale != null
                && SUPPORTED_LANGUAGES.contains(locale.getLanguage().toLowerCase(Locale.ROOT));
    }

    public static Locale normalize(Locale locale) {
        return Locale.forLanguageTag(locale.getLanguage().toLowerCase(Locale.ROOT));
    }

    private boolean isInternationalizationEnabled() {
        return localizationSettingsService == null
                || localizationSettingsService.isInternationalizationEnabled();
    }

    private boolean isSupportedDynamic(Locale locale) {
        return localizationSettingsService == null
                ? isSupported(locale)
                : localizationSettingsService.isSupported(locale);
    }

    private Locale defaultLocale(Locale fallback) {
        return localizationSettingsService == null
                ? fallback
                : localizationSettingsService.defaultLocale(fallback);
    }
}
