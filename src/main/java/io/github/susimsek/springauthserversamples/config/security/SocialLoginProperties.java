package io.github.susimsek.springauthserversamples.config.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration for encrypting OAuth2 social provider secrets. */
@ConfigurationProperties(prefix = "app.social-login")
public class SocialLoginProperties {

    private String encryptionKey = "";

    public String encryptionKey() {
        return encryptionKey;
    }

    public void setEncryptionKey(String encryptionKey) {
        this.encryptionKey = encryptionKey;
    }
}
