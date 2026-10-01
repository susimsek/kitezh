package io.github.susimsek.springauthserversamples.dto.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AdminClientScopeRequestDTOTest {

    @Test
    void appliesDefaultAndFallbackValues() {
        AdminClientScopeRequestDTO defaults =
                new AdminClientScopeRequestDTO("scope", "Display", "Description");
        AdminClientScopeRequestDTO configured =
                new AdminClientScopeRequestDTO(
                        "scope", "Display", "Description", true, " teams ", false);
        AdminClientScopeRequestDTO nullable =
                new AdminClientScopeRequestDTO(
                        "scope", null, null, null, null, null, null, null, null);

        assertThat(defaults.groupMapperEnabledValue()).isFalse();
        assertThat(defaults.groupMapperEnabledValue(true)).isFalse();
        assertThat(defaults.groupMapperFullPathValue()).isTrue();
        assertThat(defaults.groupMapperFullPathValue(false)).isTrue();
        assertThat(defaults.groupClaimNameValue()).isEqualTo("groups");
        assertThat(defaults.groupClaimNameValue("fallback")).isEqualTo("groups");
        assertThat(defaults.displayOnConsentScreenValue()).isFalse();
        assertThat(defaults.displayOnConsentScreenValue(true)).isFalse();
        assertThat(defaults.includeInTokenScopeValue()).isTrue();
        assertThat(defaults.includeInTokenScopeValue(false)).isTrue();
        assertThat(defaults.consentScreenTextValue()).isNull();
        assertThat(defaults.consentScreenTextValue("fallback")).isEqualTo("fallback");

        assertThat(configured.groupMapperEnabledValue()).isTrue();
        assertThat(configured.groupMapperEnabledValue(false)).isTrue();
        assertThat(configured.groupMapperFullPathValue()).isFalse();
        assertThat(configured.groupMapperFullPathValue(true)).isFalse();
        assertThat(configured.groupClaimNameValue()).isEqualTo("teams");
        assertThat(configured.groupClaimNameValue("fallback")).isEqualTo("teams");

        assertThat(nullable.groupMapperEnabledValue(true)).isTrue();
        assertThat(nullable.groupMapperFullPathValue(false)).isFalse();
        assertThat(nullable.groupClaimNameValue("fallback")).isEqualTo("fallback");
        assertThat(nullable.displayOnConsentScreenValue(true)).isTrue();
        assertThat(nullable.includeInTokenScopeValue(false)).isFalse();
        assertThat(nullable.consentScreenTextValue("fallback")).isEqualTo("fallback");

        AdminClientScopeRequestDTO blank =
                new AdminClientScopeRequestDTO("scope", null, null, false, " ", true);
        assertThat(blank.groupClaimNameValue()).isEqualTo("groups");
        assertThat(blank.groupClaimNameValue("fallback")).isEqualTo("fallback");
        assertThat(blank.consentScreenTextValue()).isNull();
    }
}
