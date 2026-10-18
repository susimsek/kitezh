package io.github.susimsek.kitezh.web;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Serves the Android Digital Asset Links statement required for native passkeys. */
@RestController
public class AndroidAssetLinksController {

    private static final String PACKAGE_NAME = "io.github.susimsek.kitezh.mobile";
    private static final Pattern FINGERPRINT_PATTERN =
            Pattern.compile("(?:[A-F0-9]{2}:){31}[A-F0-9]{2}");

    @Value("${app.mobile.android-sha256-cert-fingerprint:}")
    private String certificateFingerprint;

    @GetMapping(path = "/.well-known/assetlinks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Map<String, Object>>> assetLinks() {
        if (certificateFingerprint == null
                || !FINGERPRINT_PATTERN.matcher(certificateFingerprint).matches()) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> statement =
                Map.of(
                        "relation",
                                List.of(
                                        "delegate_permission/common.handle_all_urls",
                                        "delegate_permission/common.get_login_creds"),
                        "target",
                                Map.of(
                                        "namespace",
                                        "android_app",
                                        "package_name",
                                        PACKAGE_NAME,
                                        "sha256_cert_fingerprints",
                                        List.of(certificateFingerprint)));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(List.of(statement));
    }
}
