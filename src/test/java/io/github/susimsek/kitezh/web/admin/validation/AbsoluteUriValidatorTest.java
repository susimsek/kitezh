package io.github.susimsek.kitezh.web.admin.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AbsoluteUriValidatorTest {

    private final AbsoluteUriValidator validator = new AbsoluteUriValidator();

    @Test
    void acceptsAbsoluteHttpUriWithoutFragment() {
        assertThat(validator.isValid("https://example.test/callback", null)).isTrue();
        assertThat(validator.isValid("https://example.test/callback?code=123", null)).isTrue();
    }

    @Test
    void acceptsAbsoluteOpaqueUrisWithoutFragments() {
        assertThat(validator.isValid("mailto:test@example.com", null)).isTrue();
        assertThat(validator.isValid("urn:example:client", null)).isTrue();
    }

    @Test
    void rejectsNullBlankRelativeAndSchemeRelativeUris() {
        assertThat(validator.isValid(null, null)).isFalse();
        assertThat(validator.isValid(" ", null)).isFalse();
        assertThat(validator.isValid("/callback", null)).isFalse();
        assertThat(validator.isValid("//example.test/callback", null)).isFalse();
    }

    @Test
    void rejectsMalformedAndFragmentUris() {
        assertThat(validator.isValid("not-a-uri", null)).isFalse();
        assertThat(validator.isValid("https://exa mple.test/callback", null)).isFalse();
        assertThat(validator.isValid("https://example.test/callback#frag", null)).isFalse();
        assertThat(validator.isValid("urn:example:client#frag", null)).isFalse();
    }
}
