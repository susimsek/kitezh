package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SocialLoginPropertiesTest {

    @Test
    void bindsEncryptionKey() {
        final SocialLoginProperties properties = new SocialLoginProperties();
        properties.setEncryptionKey("key");

        assertThat(properties.encryptionKey()).isEqualTo("key");
    }
}
