package io.github.susimsek.kitezh.mcp.config.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

class HttpLogBodySanitizerTest {

    private static final String MASK = "[masked]";
    private static final Set<String> SENSITIVE_FIELDS = Set.of("password", "access_token");

    @Test
    void omitsEmptyBodiesDisabledBodiesBinaryBodiesAndOversizedBodies() {
        HttpHeaders jsonHeaders = headers(MediaType.APPLICATION_JSON);
        assertThat(sanitize(null, jsonHeaders, 100)).isEmpty();
        assertThat(sanitize(new byte[0], jsonHeaders, 100)).isEmpty();
        assertThat(sanitize(bytes("{}"), jsonHeaders, 0))
                .isEqualTo(HttpLogBodySanitizer.BODY_OMITTED);
        assertThat(sanitize(bytes("binary"), headers(MediaType.APPLICATION_OCTET_STREAM), 100))
                .isEqualTo(HttpLogBodySanitizer.BODY_OMITTED);
        assertThat(sanitize(bytes("too large"), jsonHeaders, 2))
                .isEqualTo(HttpLogBodySanitizer.BODY_TOO_LARGE);
    }

    @Test
    void masksSensitiveJsonFieldsRecursivelyIncludingArrayElements() {
        String body =
                "{\"password\":\"top-secret\",\"nested\":[{\"Access_Token\":\"secret\"}],"
                        + "\"visible\":\"ok\"}";

        String sanitized = sanitize(bytes(body), headers(MediaType.APPLICATION_JSON), 500);

        assertThat(sanitized)
                .isEqualTo(
                        "{\"password\":\"[masked]\",\"nested\":[{\"Access_Token\":\"[masked]\"}],"
                                + "\"visible\":\"ok\"}");
    }

    @Test
    void masksFormValuesAndTextLookingKeyValuePairs() {
        String form = "username=alice&password=secret&access_token=token&flag";
        assertThat(sanitize(bytes(form), headers(MediaType.APPLICATION_FORM_URLENCODED), 200))
                .isEqualTo("username=alice&password=[masked]&access_token=[masked]&flag");

        String text = "password: \"secret value\", access_token=token";
        assertThat(sanitize(bytes(text), headers(MediaType.TEXT_PLAIN), 200))
                .isEqualTo("password: [masked], access_token=[masked]");
    }

    @Test
    void truncatesSanitizedTextAtConfiguredByteLimit() {
        String sanitized =
                sanitize(
                        bytes("{\"password\":\"x\",\"note\":\"é\"}"),
                        headers(MediaType.APPLICATION_JSON),
                        32);

        assertThat(sanitized)
                .startsWith("{\"password\":\"[masked]\",\"note\":\"")
                .contains("�")
                .endsWith(HttpLogBodySanitizer.BODY_TRUNCATED);
    }

    @Test
    void recognizesTextJsonVendorJsonAndFormContentTypes() {
        assertThat(HttpLogBodySanitizer.isTextLike(headers(MediaType.TEXT_PLAIN))).isTrue();
        assertThat(HttpLogBodySanitizer.isTextLike(headers(MediaType.APPLICATION_JSON))).isTrue();
        assertThat(
                        HttpLogBodySanitizer.isTextLike(
                                headers(MediaType.parseMediaType("application/problem+json"))))
                .isTrue();
        assertThat(HttpLogBodySanitizer.isTextLike(headers(MediaType.APPLICATION_FORM_URLENCODED)))
                .isTrue();
        assertThat(HttpLogBodySanitizer.isTextLike(headers(MediaType.APPLICATION_OCTET_STREAM)))
                .isFalse();
        assertThat(HttpLogBodySanitizer.isTextLike(new HttpHeaders())).isFalse();
    }

    private static String sanitize(byte[] body, HttpHeaders headers, int maxBodyBytes) {
        return HttpLogBodySanitizer.sanitize(body, headers, maxBodyBytes, MASK, SENSITIVE_FIELDS);
    }

    private static HttpHeaders headers(MediaType contentType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(contentType);
        return headers;
    }

    private static byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
