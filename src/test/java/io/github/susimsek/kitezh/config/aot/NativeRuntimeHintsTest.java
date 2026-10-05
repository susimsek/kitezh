package io.github.susimsek.kitezh.config.aot;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.predicate.RuntimeHintsPredicates;

class NativeRuntimeHintsTest {

    @Test
    void registersAllApplicationMessageBundles() {
        RuntimeHints hints = new RuntimeHints();

        new NativeRuntimeHints().registerHints(hints, getClass().getClassLoader());

        assertThat(RuntimeHintsPredicates.resource().forResource("i18n/messages.properties"))
                .accepts(hints);
        assertThat(RuntimeHintsPredicates.resource().forResource("i18n/messages_tr.properties"))
                .accepts(hints);
        assertThat(
                        RuntimeHintsPredicates.resource()
                                .forResource("templates/mail/emailVerification.html"))
                .accepts(hints);
        assertThat(
                        RuntimeHintsPredicates.resource()
                                .forResource("templates/mail/passwordReset.html"))
                .accepts(hints);
    }
}
