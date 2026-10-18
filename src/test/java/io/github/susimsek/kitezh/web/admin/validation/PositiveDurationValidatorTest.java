package io.github.susimsek.kitezh.web.admin.validation;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.validation.validator.PositiveDurationValidator;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class PositiveDurationValidatorTest {

    private final PositiveDurationValidator validator = new PositiveDurationValidator();

    @Test
    void allowsNullAndStrictlyPositiveDurations() {
        assertThat(validator.isValid(null, null)).isTrue();
        assertThat(validator.isValid(Duration.ofNanos(1), null)).isTrue();
    }

    @Test
    void rejectsZeroAndNegativeDurations() {
        assertThat(validator.isValid(Duration.ZERO, null)).isFalse();
        assertThat(validator.isValid(Duration.ofSeconds(-1), null)).isFalse();
    }
}
