package io.github.susimsek.kitezh.security;

import java.security.KeyPair;
import java.security.KeyPairGenerator;

public final class TestKeySupport {

    private TestKeySupport() {}

    public static KeyPair generateRsaKey() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048);
            return keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
