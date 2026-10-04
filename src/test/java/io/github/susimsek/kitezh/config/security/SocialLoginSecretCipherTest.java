package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

@SuppressWarnings("java:S5778")
class SocialLoginSecretCipherTest {

    @Test
    void encryptsAndDecryptsSecretWithoutPersistingPlainText() {
        SocialLoginProperties properties = new SocialLoginProperties();
        properties.setEncryptionKey("test-encryption-key");
        SocialLoginSecretCipher cipher = new SocialLoginSecretCipher(properties);

        String encrypted = cipher.encrypt("client-secret");

        assertThat(encrypted).startsWith("v1:").doesNotContain("client-secret");
        assertThat(cipher.decrypt(encrypted)).isEqualTo("client-secret");
    }

    @Test
    void rejectsDecryptingWithAnotherKey() {
        SocialLoginProperties properties = new SocialLoginProperties();
        properties.setEncryptionKey("test-encryption-key");
        SocialLoginSecretCipher cipher = new SocialLoginSecretCipher(properties);
        String encrypted = cipher.encrypt("client-secret");

        properties.setEncryptionKey("another-key");

        assertThatThrownBy(() -> cipher.decrypt(encrypted))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social login secret could not be decrypted");
    }

    @Test
    void handlesEmptyUnsupportedAndMalformedCiphertexts() {
        SocialLoginProperties properties = new SocialLoginProperties();
        properties.setEncryptionKey("test-encryption-key");
        SocialLoginSecretCipher cipher = new SocialLoginSecretCipher(properties);

        assertThat(cipher.decrypt(null)).isEmpty();
        assertThat(cipher.decrypt(" ")).isEmpty();
        assertThatThrownBy(() -> cipher.decrypt("legacy-secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social login secret has an unsupported format");
        assertThatThrownBy(() -> cipher.decrypt("v1:AA"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social login secret is invalid");
        assertThatThrownBy(() -> cipher.decrypt("v1:" + "A".repeat(24)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The social login secret could not be decrypted");
    }

    @Test
    void rejectsEncryptionWithoutAConfiguredKey() {
        SocialLoginProperties properties = new SocialLoginProperties();
        SocialLoginSecretCipher cipher = new SocialLoginSecretCipher(properties);

        assertThatThrownBy(() -> cipher.encrypt("client-secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "SOCIAL_LOGIN_ENCRYPTION_KEY must be configured before saving social"
                                + " secrets");
    }
}
