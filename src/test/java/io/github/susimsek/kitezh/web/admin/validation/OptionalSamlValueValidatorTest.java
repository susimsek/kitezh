package io.github.susimsek.kitezh.web.admin.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class OptionalSamlValueValidatorTest {

    @Test
    void acceptsBlankAndAbsoluteUrisWithoutFragments() {
        OptionalAbsoluteUriValidator validator = new OptionalAbsoluteUriValidator();

        assertThat(validator.isValid(null, null)).isTrue();
        assertThat(validator.isValid(" ", null)).isTrue();
        assertThat(validator.isValid("https://idp.example.test/metadata", null)).isTrue();
        assertThat(validator.isValid("urn:example:idp", null)).isTrue();
        assertThat(validator.isValid("/relative/path", null)).isFalse();
        assertThat(validator.isValid("https://idp.example.test/metadata#fragment", null)).isFalse();
    }

    @Test
    void acceptsOnlyMatchingPemMarkers() {
        OptionalPemValidator validator = new OptionalPemValidator();
        OptionalPem certificate = mock(OptionalPem.class);
        when(certificate.label()).thenReturn("CERTIFICATE");
        validator.initialize(certificate);

        assertThat(validator.isValid(" ", null)).isTrue();
        assertThat(
                        validator.isValid(
                                "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
                                null))
                .isTrue();
        assertThat(
                        validator.isValid(
                                "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
                                null))
                .isFalse();
        assertThat(validator.isValid("not-pem", null)).isFalse();
    }
}
