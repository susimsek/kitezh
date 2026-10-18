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

/** Serves Apple's Universal Links association document for the mobile application. */
@RestController
public class AppleAppSiteAssociationController {

    private static final String BUNDLE_ID = "io.github.susimsek.kitezh.mobile";
    private static final Pattern TEAM_ID_PATTERN = Pattern.compile("[A-Z0-9]{10}");
    private static final List<String> APP_LINK_PATHS =
            List.of(
                    "/verify-email",
                    "/confirm-email",
                    "/reset-password",
                    "/oauth/callback",
                    "/logout/callback",
                    "/admin/oauth/callback",
                    "/admin/logout/callback");

    @Value("${app.mobile.ios-team-id:}")
    private String iosTeamId;

    @GetMapping(
            path = {"/.well-known/apple-app-site-association", "/apple-app-site-association"},
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> association() {
        if (iosTeamId == null || !TEAM_ID_PATTERN.matcher(iosTeamId).matches()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> appDetails =
                Map.of(
                        "appIDs", List.of(iosTeamId + "." + BUNDLE_ID),
                        "components",
                                APP_LINK_PATHS.stream().map(path -> Map.of("/", path)).toList());
        Map<String, Object> association =
                Map.of(
                        "applinks", Map.of("details", List.of(appDetails)),
                        "webcredentials", Map.of("apps", List.of(iosTeamId + "." + BUNDLE_ID)));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(association);
    }
}
