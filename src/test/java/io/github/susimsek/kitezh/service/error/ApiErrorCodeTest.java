package io.github.susimsek.kitezh.service.error;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ApiErrorCodeTest {

    @Test
    void everyCodeHasStableProblemDetailsMetadata() {
        Set<String> values = new HashSet<>();

        for (ApiErrorCode errorCode : ApiErrorCode.values()) {
            assertThat(values.add(errorCode.value()))
                    .as("API error code values must be unique")
                    .isTrue();
            assertThat(errorCode.defaultMessage()).isNotBlank();
            assertThat(errorCode.messageCode()).isEqualTo("app.api.problem." + errorCode.value());
            assertThat(errorCode.type()).isEqualTo("urn:problem:" + errorCode.value());
        }

        assertThat(values).hasSize(ApiErrorCode.values().length);
        assertThat(Arrays.stream(ApiErrorCode.values()))
                .allMatch(
                        errorCode ->
                                errorCode
                                        .value()
                                        .equals(errorCode.name().toLowerCase(Locale.ROOT)));
    }
}
