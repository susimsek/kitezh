package io.github.susimsek.kitezh.config.aot;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.web.admin.validation.AbsoluteUriValidator;
import io.github.susimsek.kitezh.web.admin.validation.AdminClientConfigurationValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalAbsoluteUriValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPasswordValidator;
import io.github.susimsek.kitezh.web.admin.validation.OptionalPemValidator;
import io.github.susimsek.kitezh.web.admin.validation.PositiveDurationValidator;
import org.junit.jupiter.api.Test;
import org.springframework.aot.hint.MemberCategory;
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

    @Test
    void registersCustomConstraintValidatorConstructorsForNativeImages() {
        RuntimeHints hints = new RuntimeHints();

        new NativeRuntimeHints().registerHints(hints, getClass().getClassLoader());

        assertValidatorConstructorRegistered(hints, AdminClientConfigurationValidator.class);
        assertValidatorConstructorRegistered(hints, AbsoluteUriValidator.class);
        assertValidatorConstructorRegistered(hints, OptionalAbsoluteUriValidator.class);
        assertValidatorConstructorRegistered(hints, OptionalPasswordValidator.class);
        assertValidatorConstructorRegistered(hints, OptionalPemValidator.class);
        assertValidatorConstructorRegistered(hints, PositiveDurationValidator.class);
    }

    private static void assertValidatorConstructorRegistered(
            RuntimeHints hints, Class<?> validatorType) {
        assertThat(hints.reflection().getTypeHint(validatorType).getMemberCategories())
                .contains(MemberCategory.INVOKE_DECLARED_CONSTRUCTORS);
    }
}
