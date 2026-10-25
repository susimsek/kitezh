package io.github.susimsek.kitezh.validation.validator;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OptionalPasswordValidatorTest {

    private final OptionalPasswordValidator validator = new OptionalPasswordValidator();

    @Test
    void acceptsNullAndBlankValues() {
        assertThat(validator.isValid(null, null)).isTrue();
        assertThat(validator.isValid(" \t", null)).isTrue();
    }

    @Test
    void acceptsPasswordsAtLeastEightCharactersLong() {
        assertThat(validator.isValid("12345678", null)).isTrue();
        assertThat(validator.isValid("long-enough", null)).isTrue();
    }

    @Test
    void rejectsNonblankPasswordsShorterThanEightCharacters() {
        assertThat(validator.isValid("short7", null)).isFalse();
    }
}
