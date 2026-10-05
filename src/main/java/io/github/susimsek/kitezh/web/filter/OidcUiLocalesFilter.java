package io.github.susimsek.kitezh.web.filter;

import io.github.susimsek.kitezh.config.web.LocaleConfig;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.util.WebUtils;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OidcUiLocalesFilter extends OncePerRequestFilter {

    private static final String UI_LOCALES_PARAMETER = "ui_locales";

    private final LocaleResolver localeResolver;
    private final LocalizationSettingsService localizationSettingsService;

    public OidcUiLocalesFilter(LocaleResolver localeResolver) {
        this(localeResolver, null);
    }

    @Autowired
    public OidcUiLocalesFilter(
            LocaleResolver localeResolver,
            LocalizationSettingsService localizationSettingsService) {
        this.localeResolver = localeResolver;
        this.localizationSettingsService = localizationSettingsService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // A saved authorization request can contain the locale from before form login.
        // Never overwrite a newer browser selection when that request is resumed.
        Cookie localeCookie = WebUtils.getCookie(request, LocaleConfig.LOCALE_COOKIE_NAME);
        if (localeCookie != null && isSupported(Locale.forLanguageTag(localeCookie.getValue()))) {
            filterChain.doFilter(request, response);
            return;
        }

        String uiLocales = request.getParameter(UI_LOCALES_PARAMETER);
        if (isInternationalizationEnabled() && StringUtils.hasText(uiLocales)) {
            Arrays.stream(uiLocales.split("\\s+"))
                    .map(Locale::forLanguageTag)
                    .filter(this::isSupported)
                    .findFirst()
                    .map(LocaleConfig::normalize)
                    .ifPresent(locale -> localeResolver.setLocale(request, response, locale));
        }

        filterChain.doFilter(request, response);
    }

    private boolean isSupported(Locale locale) {
        return localizationSettingsService == null
                ? LocaleConfig.isSupported(locale)
                : localizationSettingsService.isSupported(locale);
    }

    private boolean isInternationalizationEnabled() {
        return localizationSettingsService == null
                || localizationSettingsService.isInternationalizationEnabled();
    }
}
