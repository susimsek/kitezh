package io.github.susimsek.kitezh.config.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.i18n.CookieLocaleResolver;

class LocaleConfigTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void supportsAndNormalizesConfiguredLanguages() {
        assertThat(new LocaleConfig(mock(LocalizationSettingsService.class))).isNotNull();
        assertThat(LocaleConfig.isSupported(Locale.forLanguageTag("TR"))).isTrue();
        assertThat(LocaleConfig.isSupported(Locale.GERMAN)).isFalse();
        assertThat(LocaleConfig.normalize(Locale.forLanguageTag("TR"))).isEqualTo(Locale.of("tr"));
    }

    @Test
    void resolverUsesRequestedLocaleThenConfiguredFallbackThenEnglish() {
        LocaleConfig config = localeConfig();
        WebProperties webProperties = new WebProperties();
        webProperties.setLocale(Locale.of("tr"));
        CookieLocaleResolver resolver = (CookieLocaleResolver) config.localeResolver(webProperties);

        MockHttpServletRequest supportedRequest = new MockHttpServletRequest();
        supportedRequest.addPreferredLocale(Locale.of("tr"));
        assertThat(resolver.resolveLocale(supportedRequest)).isEqualTo(Locale.of("tr"));

        MockHttpServletRequest unsupportedRequest = new MockHttpServletRequest();
        unsupportedRequest.addPreferredLocale(Locale.GERMAN);
        assertThat(resolver.resolveLocale(unsupportedRequest)).isEqualTo(Locale.of("tr"));
    }

    @Test
    void selectedCookieLocaleOverridesAuthenticatedUsersPreferredLocale() {
        LocalizationSettingsService settings = mock(LocalizationSettingsService.class);
        final UserRepository users = mock(UserRepository.class);
        UserEntity user = new UserEntity();
        user.setPreferredLocale("tr");
        when(settings.isInternationalizationEnabled()).thenReturn(true);
        when(settings.isSupported(Locale.of("en"))).thenReturn(true);
        when(settings.isSupported(Locale.of("tr"))).thenReturn(true);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new TestingAuthenticationToken("alice", "token", java.util.List.of()));

        CookieLocaleResolver resolver =
                (CookieLocaleResolver)
                        new LocaleConfig(settings, users).localeResolver(new WebProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("locale", "en"));
        request.addPreferredLocale(Locale.of("en"));

        assertThat(resolver.resolveLocale(request)).isEqualTo(Locale.of("en"));
    }

    @Test
    void authenticatedUsersPreferredLocaleOverridesExplicitUiLocales() {
        LocalizationSettingsService settings = mock(LocalizationSettingsService.class);
        final UserRepository users = mock(UserRepository.class);
        UserEntity user = new UserEntity();
        user.setPreferredLocale("tr");
        when(settings.isInternationalizationEnabled()).thenReturn(true);
        when(settings.isSupported(Locale.of("en"))).thenReturn(true);
        when(settings.isSupported(Locale.of("tr"))).thenReturn(true);
        when(users.findByUsername("alice")).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new TestingAuthenticationToken("alice", "token", java.util.List.of()));

        CookieLocaleResolver resolver =
                (CookieLocaleResolver)
                        new LocaleConfig(settings, users).localeResolver(new WebProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("ui_locales", "en tr");

        assertThat(resolver.resolveLocale(request)).isEqualTo(Locale.of("tr"));
    }

    @Test
    void handlesDisabledInternationalizationAndUnsupportedCookie() {
        LocalizationSettingsService settings = mock(LocalizationSettingsService.class);
        when(settings.isInternationalizationEnabled()).thenReturn(false);
        CookieLocaleResolver resolver =
                (CookieLocaleResolver)
                        new LocaleConfig(settings).localeResolver(new WebProperties());

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.GERMAN);

        assertThat(resolver.resolveLocale(request)).isEqualTo(Locale.ENGLISH);

        when(settings.isInternationalizationEnabled()).thenReturn(true);
        when(settings.isSupported(Locale.GERMAN)).thenReturn(false);
        request.setCookies(new jakarta.servlet.http.Cookie("locale", "de"));
        request.addPreferredLocale(Locale.ENGLISH);

        assertThat(resolver.resolveLocale(request)).isEqualTo(Locale.ENGLISH);
        verify(settings).isSupported(Locale.GERMAN);
    }

    @Test
    void resolvesFirstSupportedUiLocaleAndFallsBackForBlankOrUnsupportedValues() {
        LocalizationSettingsService settings = mock(LocalizationSettingsService.class);
        when(settings.isInternationalizationEnabled()).thenReturn(true);
        when(settings.isSupported(Locale.GERMAN)).thenReturn(false);
        when(settings.isSupported(Locale.of("tr"))).thenReturn(true);
        CookieLocaleResolver resolver =
                (CookieLocaleResolver)
                        new LocaleConfig(settings).localeResolver(new WebProperties());

        MockHttpServletRequest supported = new MockHttpServletRequest();
        supported.setParameter("ui_locales", "de tr");
        assertThat(resolver.resolveLocale(supported)).isEqualTo(Locale.of("tr"));

        MockHttpServletRequest blank = new MockHttpServletRequest();
        blank.setParameter("ui_locales", "   ");
        blank.addPreferredLocale(Locale.ENGLISH);
        assertThat(resolver.resolveLocale(blank)).isEqualTo(Locale.ENGLISH);

        MockHttpServletRequest unsupported = new MockHttpServletRequest();
        unsupported.setParameter("ui_locales", "de");
        unsupported.addPreferredLocale(Locale.ENGLISH);
        assertThat(resolver.resolveLocale(unsupported)).isEqualTo(Locale.ENGLISH);
    }

    @Test
    void ignoresUnauthenticatedUserPreferences() {
        LocalizationSettingsService settings = mock(LocalizationSettingsService.class);
        UserRepository users = mock(UserRepository.class);
        when(settings.isInternationalizationEnabled()).thenReturn(true);
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("alice", "token"));
        SecurityContextHolder.getContext().getAuthentication().setAuthenticated(false);

        CookieLocaleResolver resolver =
                (CookieLocaleResolver)
                        new LocaleConfig(settings, users).localeResolver(new WebProperties());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addPreferredLocale(Locale.ENGLISH);

        assertThat(resolver.resolveLocale(request)).isEqualTo(Locale.ENGLISH);
    }

    private static LocaleConfig localeConfig() {
        try {
            var constructor = LocaleConfig.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError(exception);
        }
    }
}
