package io.github.susimsek.kitezh.security;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OAuth2ErrorLocalizer {

    private final MessageSource messageSource;

    public OAuth2Error localize(OAuth2Error error, Locale locale) {
        String description =
                messageSource.getMessage(
                        "app.oauth2.error." + error.getErrorCode(),
                        null,
                        error.getDescription(),
                        locale);
        return new OAuth2Error(error.getErrorCode(), description, error.getUri());
    }

    public String localize(String key, String defaultMessage, Locale locale) {
        return messageSource.getMessage(key, null, defaultMessage, locale);
    }
}
