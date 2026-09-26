package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.LoginSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AccountSecurityEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private LoginSettingsRepository loginSettingsRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void accountMfaAndRecoveryStatusAreAvailableForAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/account/mfa").with(account("user")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.available").value(false));

        mockMvc.perform(get("/api/account/mfa/recovery-codes").with(account("user")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remaining").value(0))
                .andExpect(jsonPath("$.warningThreshold").isNumber());
    }

    @Test
    void mfaSetupAndRecoveryGenerationRequireEnabledOtp() throws Exception {
        mockMvc.perform(post("/api/account/mfa/setup").with(account("user")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/account/mfa/recovery-codes").with(account("user")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                        post("/api/account/mfa/enable")
                                .with(account("user"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"code\":\"bad\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void mfaCanBeEnabledWithRecoveryCodesAndDisabledAgain() throws Exception {
        LoginSettingsEntity settings = loginSettingsRepository.findById(1L).orElseThrow();
        boolean previousOtpEnabled = settings.isOtpEnabled();
        boolean previousReusable = settings.isOtpCodeReusable();
        String username = "mfa-it-" + UUID.randomUUID();
        UserEntity user = new UserEntity(null, username, "{noop}Mfa-test12!", true, Set.of());
        user = userRepository.save(user);
        try {
            settings.setOtpEnabled(true);
            settings.setOtpCodeReusable(false);
            loginSettingsRepository.save(settings);

            String setup =
                    mockMvc.perform(post("/api/account/mfa/setup").with(account(username)))
                            .andExpect(status().isOk())
                            .andExpect(jsonPath("$.secret").isString())
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
            String secret = JsonSupport.read(setup);
            String enableCode = totp(secret, Instant.now().getEpochSecond() / 30);

            mockMvc.perform(
                            post("/api/account/mfa/enable")
                                    .with(account(username))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"code\":\"" + enableCode + "\"}"))
                    .andExpect(status().isNoContent());

            mockMvc.perform(post("/api/account/mfa/recovery-codes").with(account(username)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.codes").isArray())
                    .andExpect(jsonPath("$.codes.length()").value(12));

            String disableCode = totp(secret, Instant.now().getEpochSecond() / 30 + 1);
            mockMvc.perform(
                            post("/api/account/mfa/disable")
                                    .with(account(username))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"code\":\"" + disableCode + "\"}"))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/account/mfa").with(account(username)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(false));
        } finally {
            userRepository.deleteById(user.getId());
            settings.setOtpEnabled(previousOtpEnabled);
            settings.setOtpCodeReusable(previousReusable);
            loginSettingsRepository.save(settings);
        }
    }

    @Test
    void webAuthnEndpointsReturnEmptyPageAndRejectUnknownCredential() throws Exception {
        mockMvc.perform(get("/api/account/webauthn/credentials").with(account("user")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page.totalElements").value(0));

        mockMvc.perform(
                        get("/api/account/webauthn/credentials/not-a-credential")
                                .with(account("user")))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        put("/api/account/webauthn/credentials/not-a-credential")
                                .with(account("user"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"label\":\"Laptop\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        delete("/api/account/webauthn/credentials/not-a-credential")
                                .with(account("user")))
                .andExpect(status().isNotFound());
    }

    @Test
    void passwordAndEmailVerificationContractsRejectInvalidRequests() throws Exception {
        mockMvc.perform(
                        put("/api/account/password")
                                .with(account("user"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"currentPassword\":\"wrong\",\"newPassword\":\"Valid-new12!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("currentPassword"));

        mockMvc.perform(
                        put("/api/account/password")
                                .with(account("user"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"currentPassword\":\"user\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/account/send-verify-email").with(account("user")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void accountPasswordCanBeChangedAndStoredEncoded() throws Exception {
        String username = "password-it-" + UUID.randomUUID();
        userRepository.save(
                new UserEntity(null, username, "{noop}Current-test12!", true, Set.of()));
        try {
            mockMvc.perform(
                            put("/api/account/password")
                                    .with(account(username))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"currentPassword\":\"Current-test12!\",\"newPassword\":\"Changed-test12!\"}"))
                    .andExpect(status().isNoContent());

            UserEntity changed = userRepository.findByUsername(username).orElseThrow();
            assertThat(passwordEncoder.matches("Changed-test12!", changed.getPassword())).isTrue();
        } finally {
            userRepository
                    .findByUsername(username)
                    .ifPresent(user -> userRepository.deleteById(user.getId()));
        }
    }

    @Test
    void accountProfileAttributesCanBeUpdatedAndInvalidRequestIsRejected() throws Exception {
        mockMvc.perform(
                        put("/api/account/profile/attributes")
                                .with(account("user2"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"attributes\":{\"department\":[\"IT\"],\"employeeNumber\":[\"IT-001\"]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attributes.department[0]").value("IT"));

        mockMvc.perform(
                        put("/api/account/profile/attributes")
                                .with(account("user2"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"attributes\":null}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(
                put("/api/account/profile/attributes")
                        .with(account("user2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                "{\"attributes\":{\"department\":[\"Design\"],\"employeeNumber\":[\"USR-002\"]}}"));
    }

    @Test
    void accountCanBeDeletedAfterPasswordConfirmation() throws Exception {
        String username = "delete-it-" + UUID.randomUUID();
        userRepository.save(new UserEntity(null, username, "{noop}Delete-test12!", true, Set.of()));
        mockMvc.perform(
                        delete("/api/account")
                                .with(account(username))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"currentPassword\":\"Delete-test12!\"}"))
                .andExpect(status().isNoContent());
        assertThat(userRepository.findByUsername(username)).isEmpty();
    }

    private static JwtRequestPostProcessor account(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }

    private static String totp(String secret, long counter) throws GeneralSecurityException {
        byte[] key = base32(secret);
        byte[] hash;
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(key, "HmacSHA1"));
        hash = mac.doFinal(ByteBuffer.allocate(8).putLong(counter).array());
        int offset = hash[hash.length - 1] & 0xf;
        int binary =
                ((hash[offset] & 0x7f) << 24)
                        | ((hash[offset + 1] & 0xff) << 16)
                        | ((hash[offset + 2] & 0xff) << 8)
                        | (hash[offset + 3] & 0xff);
        return "%06d".formatted(binary % 1_000_000);
    }

    private static byte[] base32(String value) {
        String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        String normalized = value.replace("=", "").toUpperCase();
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char character : normalized.toCharArray()) {
            buffer = (buffer << 5) | alphabet.indexOf(character);
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                output.write((buffer >> bits) & 0xff);
            }
        }
        return output.toByteArray();
    }

    private static final class JsonSupport {
        private static String read(String json) {
            int start = json.indexOf('"' + "secret" + '"');
            int colon = json.indexOf(':', start);
            int quote = json.indexOf('"', colon + 1);
            int end = json.indexOf('"', quote + 1);
            return json.substring(quote + 1, end);
        }
    }
}
