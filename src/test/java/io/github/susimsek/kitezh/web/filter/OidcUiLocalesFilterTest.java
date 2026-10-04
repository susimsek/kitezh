package io.github.susimsek.kitezh.web.filter;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.config.web.LocaleConfig;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.LocaleResolver;

class OidcUiLocalesFilterTest {

    private final LocaleResolver localeResolver = mock(LocaleResolver.class);
    private final OidcUiLocalesFilter filter = new OidcUiLocalesFilter(localeResolver);
    private final FilterChain filterChain = mock(FilterChain.class);

    @ParameterizedTest
    @CsvSource({"en, tr", "tr, en", "en, en", "tr, tr"})
    void preservesBrowserSelectionOverSavedAuthorizationHint(String selected, String hint)
            throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setCookies(new Cookie(LocaleConfig.LOCALE_COOKIE_NAME, selected));
        request.setParameter("ui_locales", hint);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verifyNoInteractions(localeResolver);
        verify(filterChain).doFilter(request, response);
    }

    @ParameterizedTest
    @ValueSource(strings = {"de", "", "invalid"})
    void usesSupportedHintWhenCookieIsNotSupported(String value) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setCookies(new Cookie(LocaleConfig.LOCALE_COOKIE_NAME, value));
        request.setParameter("ui_locales", "de tr-TR en");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(localeResolver).setLocale(request, response, Locale.of("tr"));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void usesFirstSupportedUiLocale() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setParameter("ui_locales", "de tr-TR en");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(localeResolver).setLocale(request, response, Locale.forLanguageTag("tr"));
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void ignoresUnsupportedUiLocales() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorize");
        request.setParameter("ui_locales", "de fr");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(localeResolver, never()).setLocale(request, response, Locale.GERMAN);
        verify(filterChain).doFilter(request, response);
    }
}
