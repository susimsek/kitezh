package io.github.susimsek.kitezh.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.MessageSource;
import org.springframework.security.oauth2.core.OAuth2Error;

@ExtendWith(MockitoExtension.class)
class OAuth2ErrorLocalizerTest {

    @Mock private MessageSource messageSource;

    @Test
    void localizesOAuth2ErrorDescription() {
        OAuth2Error error = new OAuth2Error("invalid_scope", "default", "urn:test");
        when(messageSource.getMessage(
                        "app.oauth2.error.invalid_scope",
                        null,
                        "default",
                        Locale.forLanguageTag("tr")))
                .thenReturn("Yerel aciklama");

        OAuth2Error localized =
                new OAuth2ErrorLocalizer(messageSource)
                        .localize(error, Locale.forLanguageTag("tr"));

        assertThat(localized.getErrorCode()).isEqualTo("invalid_scope");
        assertThat(localized.getDescription()).isEqualTo("Yerel aciklama");
        assertThat(localized.getUri()).isEqualTo("urn:test");
    }

    @Test
    void localizesPlainMessageKey() {
        when(messageSource.getMessage("app.security.unauthorized", null, "default", Locale.ENGLISH))
                .thenReturn("Localized");

        String localized =
                new OAuth2ErrorLocalizer(messageSource)
                        .localize("app.security.unauthorized", "default", Locale.ENGLISH);

        assertThat(localized).isEqualTo("Localized");
    }
}
