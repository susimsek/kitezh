package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SocialAccountLinkRequiredExceptionTest {

    @Test
    void keepsOnlySerializableBoundedPendingAttributes() {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("string", "value");
        attributes.put("number", 42);
        attributes.put("boolean", true);
        attributes.put("long", "x".repeat(2001));
        attributes.put("object", new Object());
        attributes.put("list", List.of("one", "two"));
        attributes.put("emptyList", List.of());

        SocialAccountLinkRequiredException exception =
                new SocialAccountLinkRequiredException("google", "subject", null, attributes);

        assertThat(exception.pendingLink())
                .containsEntry("provider", "google")
                .containsEntry("subject", "subject")
                .containsEntry("email", "")
                .extractingByKey("attributes")
                .isEqualTo(
                        Map.of(
                                "string",
                                "value",
                                "number",
                                42,
                                "boolean",
                                true,
                                "list",
                                List.of("one", "two")));
    }

    @Test
    void handlesNullAndEmptyAttributeMaps() {
        assertThat(
                        new SocialAccountLinkRequiredException(
                                        "github", "subject", "user@example.test", null)
                                .pendingLink())
                .containsEntry("attributes", Map.of());
        assertThat(
                        new SocialAccountLinkRequiredException(
                                        "github", "subject", "user@example.test", Map.of())
                                .pendingLink())
                .containsEntry("attributes", Map.of());
    }
}
