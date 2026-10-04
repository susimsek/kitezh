package io.github.susimsek.kitezh.dto.account;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class MfaCodeRequestDTOTest {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "12345", "123456789", "12ab56"})
    void rejectsMissingAndMalformedCodes(String code) {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            assertThat(validatorFactory.getValidator().validate(new MfaCodeRequestDTO(code)))
                    .isNotEmpty();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"123456", "12345678"})
    void acceptsSupportedCodeLengths(String code) {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            assertThat(validatorFactory.getValidator().validate(new MfaCodeRequestDTO(code)))
                    .isEmpty();
        }
    }
}
