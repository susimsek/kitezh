package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SocialProviderIconKeysTest {

    @Test
    void normalizesAllowedAndBuiltInIcons() {
        assertThat(SocialProviderIconKeys.normalize(" GITHUB ", "oidc")).isEqualTo("github");
        assertThat(SocialProviderIconKeys.normalize(null, "microsoft")).isEqualTo("microsoft");
    }

    @Test
    void fallsBackToGenericForUnknownIcons() {
        assertThat(SocialProviderIconKeys.normalize("remote-url", "oidc")).isEqualTo("generic");
        assertThat(SocialProviderIconKeys.isAllowed("remote-url")).isFalse();
    }
}
