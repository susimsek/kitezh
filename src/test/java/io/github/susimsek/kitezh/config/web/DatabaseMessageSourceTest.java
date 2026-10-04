package io.github.susimsek.kitezh.config.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.LocalizationMessageOverrideEntity;
import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.context.support.StaticMessageSource;

@ExtendWith(MockitoExtension.class)
class DatabaseMessageSourceTest {

    @Mock private LocalizationMessageOverrideRepository overrideRepository;

    @Test
    void resolvesEmailOverridesFromEmailBundle() {
        LocalizationMessageOverrideEntity override = new LocalizationMessageOverrideEntity();
        override.setMessageValue("Test e-postası");
        when(overrideRepository.findByLocaleAndBundleAndMessageKey(
                        "tr", "email", "mail.test.subject"))
                .thenReturn(Optional.of(override));

        StaticMessageSource bundled = new StaticMessageSource();
        bundled.addMessage("mail.test.subject", Locale.forLanguageTag("tr"), "Bundled");

        var source = new DatabaseMessageSource(bundled, overrideRepository);

        assertThat(source.getMessage("mail.test.subject", null, Locale.forLanguageTag("tr")))
                .isEqualTo("Test e-postası");
    }

    @Test
    void fallsBackToBundledMessagesAndFormatsOverrides() {
        StaticMessageSource bundled = new StaticMessageSource();
        bundled.addMessage("app.greeting", Locale.ENGLISH, "Bundled {0}");
        bundled.addMessage("app.fallback", Locale.ENGLISH, "Fallback");
        when(overrideRepository.findByLocaleAndBundleAndMessageKey("en", "backend", "app.greeting"))
                .thenReturn(Optional.of(override("Override {0}")));
        when(overrideRepository.findByLocaleAndBundleAndMessageKey("en", "backend", "app.fallback"))
                .thenReturn(Optional.empty());

        DatabaseMessageSource source = new DatabaseMessageSource(bundled, overrideRepository);

        assertThat(source.getMessage("app.greeting", new Object[] {"Ada"}, Locale.ENGLISH))
                .isEqualTo("Override Ada");
        assertThat(
                        source.getMessage(
                                "app.fallback", new Object[] {"Ada"}, "Default", Locale.ENGLISH))
                .isEqualTo("Fallback");
        assertThat(source.getMessage("missing", null, "Default", null)).isEqualTo("Default");
    }

    @Test
    void resolvesResolvableOverridesAndHandlesMissingCodes() {
        StaticMessageSource bundled = new StaticMessageSource();
        bundled.addMessage("app.default", Locale.ENGLISH, "Bundled");
        when(overrideRepository.findByLocaleAndBundleAndMessageKey("en", "backend", "app.override"))
                .thenReturn(Optional.of(override("Changed")));
        when(overrideRepository.findByLocaleAndBundleAndMessageKey("en", "backend", "missing"))
                .thenReturn(Optional.empty());

        DatabaseMessageSource source = new DatabaseMessageSource(bundled, overrideRepository);

        assertThat(
                        source.getMessage(
                                new DefaultMessageSourceResolvable(
                                        new String[] {"missing", "app.override"}),
                                Locale.ENGLISH))
                .isEqualTo("Changed");
        assertThat(
                        source.getMessage(
                                new DefaultMessageSourceResolvable(new String[] {"app.default"}),
                                Locale.ENGLISH))
                .isEqualTo("Bundled");
    }

    private static LocalizationMessageOverrideEntity override(String value) {
        LocalizationMessageOverrideEntity entity = new LocalizationMessageOverrideEntity();
        entity.setMessageValue(value);
        return entity;
    }
}
