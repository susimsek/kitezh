package io.github.susimsek.kitezh.service.security;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Locale;
import java.util.OptionalLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;

/** Small RFC 6238 TOTP implementation used for account MFA. */
@Service
@SuppressWarnings("java:S3457")
public class TotpService {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    public String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return encode(bytes);
    }

    public boolean matches(
            String secret,
            String code,
            String algorithm,
            int digits,
            int periodSeconds,
            int lookAheadWindow) {
        return matchingCounter(secret, code, algorithm, digits, periodSeconds, lookAheadWindow)
                .isPresent();
    }

    /** Returns the time-step represented by a valid code, or empty when the code is invalid. */
    public OptionalLong matchingCounter(
            String secret,
            String code,
            String algorithm,
            int digits,
            int periodSeconds,
            int lookAheadWindow) {
        return matchingCounterAt(
                secret, code, algorithm, digits, periodSeconds, lookAheadWindow, Instant.now());
    }

    boolean matchesAt(
            String secret,
            String code,
            String algorithm,
            int digits,
            int periodSeconds,
            int lookAheadWindow,
            Instant now) {
        return matchingCounterAt(
                        secret, code, algorithm, digits, periodSeconds, lookAheadWindow, now)
                .isPresent();
    }

    OptionalLong matchingCounterAt(
            String secret,
            String code,
            String algorithm,
            int digits,
            int periodSeconds,
            int lookAheadWindow,
            Instant now) {
        if (secret == null
                || code == null
                || (digits != 6 && digits != 8)
                || periodSeconds <= 0
                || lookAheadWindow < 0
                || !code.matches("\\d{" + digits + "}")) {
            return OptionalLong.empty();
        }
        long counter = now.getEpochSecond() / periodSeconds;
        for (long offset = -lookAheadWindow; offset <= lookAheadWindow; offset++) {
            try {
                String generated = generate(secret, counter + offset, algorithm, digits);
                if (MessageDigest.isEqual(
                        generated.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                        code.getBytes(java.nio.charset.StandardCharsets.US_ASCII))) {
                    return OptionalLong.of(counter + offset);
                }
            } catch (IllegalArgumentException _) {
                return OptionalLong.empty();
            }
        }
        return OptionalLong.empty();
    }

    public String otpauthUri(
            String issuer,
            String account,
            String secret,
            String algorithm,
            int digits,
            int periodSeconds) {
        String label = urlEncode(issuer) + ":" + urlEncode(account);
        return "otpauth://totp/"
                + label
                + "?secret="
                + secret
                + "&issuer="
                + urlEncode(issuer)
                + "&algorithm="
                + algorithm
                + "&digits="
                + digits
                + "&period="
                + periodSeconds;
    }

    public String qrCodeDataUri(String value) {
        try {
            var hints = new EnumMap<EncodeHintType, Object>(EncodeHintType.class);
            hints.put(EncodeHintType.MARGIN, 4);
            BitMatrix matrix =
                    new MultiFormatWriter().encode(value, BarcodeFormat.QR_CODE, 220, 220, hints);
            BufferedImage image =
                    new BufferedImage(
                            matrix.getWidth(), matrix.getHeight(), BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < matrix.getHeight(); y++) {
                for (int x = 0; x < matrix.getWidth(); x++) {
                    image.setRGB(x, y, matrix.get(x, y) ? 0xFF000000 : 0xFFFFFFFF);
                }
            }
            try (var output = new ByteArrayOutputStream()) {
                if (!ImageIO.write(image, "PNG", output)) {
                    throw new IllegalStateException("PNG writer is unavailable");
                }
                return "data:image/png;base64,"
                        + Base64.getEncoder().encodeToString(output.toByteArray());
            }
        } catch (WriterException | IOException ex) {
            throw new IllegalStateException("TOTP QR code could not be generated", ex);
        }
    }

    private static String generate(String secret, long counter, String algorithm, int digits) {
        try {
            byte[] hash =
                    hmac(
                            algorithm,
                            decode(secret),
                            ByteBuffer.allocate(8).putLong(counter).array());
            int offset = hash[hash.length - 1] & 0xf;
            int binary =
                    ((hash[offset] & 0x7f) << 24)
                            | ((hash[offset + 1] & 0xff) << 16)
                            | ((hash[offset + 2] & 0xff) << 8)
                            | (hash[offset + 3] & 0xff);
            int modulo = digits == 8 ? 100_000_000 : 1_000_000;
            return String.format(Locale.ROOT, "%0" + digits + "d", binary % modulo);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("TOTP algorithm is unavailable", ex);
        }
    }

    private static byte[] hmac(String algorithm, byte[] secret, byte[] counter)
            throws GeneralSecurityException {
        String normalizedAlgorithm = algorithm.replace("-", "").toUpperCase(Locale.ROOT);
        Mac mac = Mac.getInstance("Hmac" + normalizedAlgorithm);
        mac.init(new SecretKeySpec(secret, mac.getAlgorithm()));
        return mac.doFinal(counter);
    }

    private static String encode(byte[] bytes) {
        StringBuilder result = new StringBuilder((bytes.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte value : bytes) {
            buffer = (buffer << 8) | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                bits -= 5;
                result.append(BASE32.charAt((buffer >> bits) & 31));
            }
        }
        if (bits > 0) {
            result.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        }
        return result.toString();
    }

    private static byte[] decode(String value) {
        String normalized = value.replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        byte[] result = new byte[normalized.length() * 5 / 8];
        int buffer = 0;
        int bits = 0;
        int index = 0;
        for (char character : normalized.toCharArray()) {
            int digit = BASE32.indexOf(character);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid Base32 secret");
            }
            buffer = (buffer << 5) | digit;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                result[index++] = (byte) ((buffer >> bits) & 0xff);
            }
        }
        return result;
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
