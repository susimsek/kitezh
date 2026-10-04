package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class TotpServiceTest {

    private final TotpService service = new TotpService();

    @Test
    void matchesRfc6238Sha1Vector() {
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

        assertThat(
                        service.matchesAt(
                                secret, "94287082", "SHA1", 8, 30, 0, Instant.ofEpochSecond(59)))
                .isTrue();
        assertThat(service.matches(secret, "94287082", "SHA1", 8, 30, 0)).isFalse();
        assertThat(service.matchingCounter(secret, "94287082", "SHA1", 8, 30, 0)).isEmpty();
    }

    @Test
    void acceptsHyphenatedAlgorithmName() {
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

        assertThat(
                        service.matchesAt(
                                secret, "94287082", "SHA-1", 8, 30, 0, Instant.ofEpochSecond(59)))
                .isTrue();
    }

    @Test
    void rejectsCodesOutsideConfiguredLength() {
        assertThat(
                        service.matchesAt(
                                "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
                                "123456",
                                "SHA1",
                                8,
                                30,
                                0,
                                Instant.ofEpochSecond(59)))
                .isFalse();
    }

    @Test
    void rejectsIncorrectCodeWithConfiguredLength() {
        assertThat(
                        service.matchesAt(
                                "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
                                "00000000",
                                "SHA1",
                                8,
                                30,
                                0,
                                Instant.ofEpochSecond(59)))
                .isFalse();
    }

    @Test
    void acceptsOnlyCodesInsideConfiguredClockWindow() {
        String secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

        assertThat(
                        service.matchesAt(
                                secret, "94287082", "SHA1", 8, 30, 1, Instant.ofEpochSecond(89)))
                .isTrue();
        assertThat(
                        service.matchesAt(
                                secret, "94287082", "SHA1", 8, 30, 1, Instant.ofEpochSecond(119)))
                .isFalse();
    }

    @Test
    void generatesBackendQrCodeDataUri() {
        String dataUri = service.qrCodeDataUri("otpauth://totp/Authorization%20Server:admin");

        assertThat(dataUri).startsWith("data:image/png;base64,");
        byte[] png = Base64.getDecoder().decode(dataUri.substring(dataUri.indexOf(',') + 1));
        assertThat(png).startsWith((byte) 0x89, (byte) 0x50, (byte) 0x4e, (byte) 0x47);
    }

    @Test
    void generatesBase32SecretAndOtpUri() {
        String secret = service.newSecret();

        assertThat(secret).hasSize(32).matches("[A-Z2-7]+");
        assertThat(service.otpauthUri("Spring Server", "alice@example.test", secret, "SHA1", 6, 30))
                .isEqualTo(
                        "otpauth://totp/Spring%20Server:alice%40example.test?secret="
                                + secret
                                + "&issuer=Spring%20Server&algorithm=SHA1&digits=6&period=30");
    }

    @Test
    void rejectsInvalidInputAndSecrets() {
        assertThat(service.matchingCounterAt(null, "123456", "SHA1", 6, 30, 0, Instant.EPOCH))
                .isEmpty();
        assertThat(service.matchingCounterAt("INVALID!", "123456", "SHA1", 6, 30, 0, Instant.EPOCH))
                .isEmpty();
        assertThat(
                        service.matchingCounterAt(
                                "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
                                "123456",
                                "SHA256",
                                6,
                                30,
                                0,
                                Instant.EPOCH))
                .isEmpty();
        assertThat(
                        service.matchingCounterAt(
                                "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
                                "123456",
                                "SHA1",
                                6,
                                0,
                                0,
                                Instant.EPOCH))
                .isEmpty();
    }

    @Test
    void supportsSha256AndSha512Vectors() {
        String sha256Secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA";
        String sha512Secret =
                "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA";

        assertThat(
                        service.matchesAt(
                                sha256Secret,
                                "46119246",
                                "SHA256",
                                8,
                                30,
                                0,
                                Instant.ofEpochSecond(59)))
                .isTrue();
        assertThat(
                        service.matchesAt(
                                sha512Secret,
                                "90693936",
                                "SHA512",
                                8,
                                30,
                                0,
                                Instant.ofEpochSecond(59)))
                .isTrue();
    }
}
