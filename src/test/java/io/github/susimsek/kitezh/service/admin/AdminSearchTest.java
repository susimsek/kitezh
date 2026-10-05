package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.susimsek.kitezh.service.error.ApiException;
import org.junit.jupiter.api.Test;

@SuppressWarnings("java:S5778")
class AdminSearchTest {

    @Test
    void normalizesBlankSearchTerms() {
        assertThat(AdminSearch.normalize(null)).isEmpty();
        assertThat(AdminSearch.normalize("  client  ")).isEqualTo("client");
    }

    @Test
    void rejectsSearchTermsOverTheLimit() {
        assertThatThrownBy(() -> AdminSearch.normalize("a".repeat(101)))
                .isInstanceOf(ApiException.class)
                .hasMessage("Search query must not exceed 100 characters");
    }
}
