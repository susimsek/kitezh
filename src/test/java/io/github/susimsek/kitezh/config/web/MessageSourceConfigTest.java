package io.github.susimsek.kitezh.config.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.context.MessageSourceProperties;
import org.springframework.context.MessageSource;

class MessageSourceConfigTest {

    @Test
    void createsBundledAndDatabaseBackedMessageSources() {
        MessageSourceConfig config = new MessageSourceConfig();
        MessageSourceProperties properties = new MessageSourceProperties();
        MessageSource bundled = config.bundledMessageSource(properties);
        assertThat(bundled).isNotNull();
        assertThat(config.messageSource(bundled, mock(LocalizationMessageOverrideRepository.class)))
                .isInstanceOf(DatabaseMessageSource.class);
    }
}
