package io.github.susimsek.kitezh.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Public mobile reCAPTCHA Enterprise key identifiers and app identities. */
@ConfigurationProperties(prefix = "app.mobile.captcha")
public record MobileCaptchaProperties(
        @DefaultValue("") String androidSiteKey,
        @DefaultValue("") String iosSiteKey,
        @DefaultValue("io.github.susimsek.kitezh.mobile") String androidPackageName,
        @DefaultValue("io.github.susimsek.kitezh.mobile") String iosBundleId) {

    @ConstructorBinding
    public MobileCaptchaProperties {}

    public MobileCaptchaProperties() {
        this("", "", "io.github.susimsek.kitezh.mobile", "io.github.susimsek.kitezh.mobile");
    }
}
