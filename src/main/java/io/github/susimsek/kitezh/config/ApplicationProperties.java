package io.github.susimsek.kitezh.config;

import java.time.Duration;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app")
public record ApplicationProperties(
        @DefaultValue Cache cache,
        @DefaultValue Session session,
        @DefaultValue AuthorizationServer authorizationServer,
        @DefaultValue Mail mail,
        @DefaultValue Security security,
        @DefaultValue WebAuthn webAuthn,
        @DefaultValue RegistrationCaptcha registrationCaptcha,
        @DefaultValue DPoP dpop) {

    private static final String DEFAULT_ISSUER = "http://127.0.0.1:9090";

    @ConstructorBinding
    public ApplicationProperties(
            Cache cache,
            Session session,
            AuthorizationServer authorizationServer,
            Mail mail,
            Security security,
            WebAuthn webAuthn,
            RegistrationCaptcha registrationCaptcha,
            DPoP dpop) {
        this.cache = cache == null ? new Cache() : cache;
        this.session = session == null ? new Session("0 * * * * *") : session;
        this.authorizationServer =
                authorizationServer == null ? new AuthorizationServer() : authorizationServer;
        this.mail =
                mail == null
                        ? new Mail(false, "Kitezh <no-reply@localhost>", DEFAULT_ISSUER)
                        : mail;
        this.security = security == null ? new Security() : security;
        this.webAuthn = webAuthn == null ? new WebAuthn() : webAuthn;
        this.registrationCaptcha =
                registrationCaptcha == null ? new RegistrationCaptcha() : registrationCaptcha;
        this.dpop = dpop == null ? new DPoP() : dpop;
    }

    public ApplicationProperties() {
        this(
                new Cache(new Caffeine(Duration.ofHours(1), 500, 1000)),
                new Session("0 * * * * *"),
                new AuthorizationServer(DEFAULT_ISSUER),
                new Mail(false, "Kitezh <no-reply@localhost>", DEFAULT_ISSUER),
                new Security(),
                new WebAuthn(),
                new RegistrationCaptcha(),
                new DPoP());
    }

    public ApplicationProperties(
            Cache cache, Session session, AuthorizationServer authorizationServer, Mail mail) {
        this(
                cache,
                session,
                authorizationServer,
                mail,
                new Security(),
                new WebAuthn(),
                new RegistrationCaptcha(),
                new DPoP());
    }

    public ApplicationProperties(
            Cache cache,
            Session session,
            AuthorizationServer authorizationServer,
            Mail mail,
            Security security) {
        this(
                cache,
                session,
                authorizationServer,
                mail,
                security,
                new WebAuthn(),
                new RegistrationCaptcha(),
                new DPoP());
    }

    public ApplicationProperties(
            Cache cache,
            Session session,
            AuthorizationServer authorizationServer,
            Mail mail,
            Security security,
            WebAuthn webAuthn,
            RegistrationCaptcha registrationCaptcha) {
        this(
                cache,
                session,
                authorizationServer,
                mail,
                security,
                webAuthn,
                registrationCaptcha,
                new DPoP());
    }

    public record Cache(@DefaultValue Caffeine caffeine) {

        public Cache() {
            this(new Caffeine());
        }
    }

    public record Caffeine(
            @DefaultValue("PT1H") Duration ttl,
            @DefaultValue("500") int initialCapacity,
            @DefaultValue("1000") long maximumSize,
            Map<String, CacheOverride> overrides) {

        public Caffeine() {
            this(Duration.ofHours(1), 500, 1000, Map.of());
        }

        public Caffeine(Duration ttl, int initialCapacity, long maximumSize) {
            this(ttl, initialCapacity, maximumSize, Map.of());
        }

        public Caffeine {
            overrides = overrides == null ? Map.of() : Map.copyOf(overrides);
        }
    }

    public record CacheOverride(
            @DefaultValue("PT1H") Duration ttl,
            @DefaultValue("500") int initialCapacity,
            @DefaultValue("1000") long maximumSize) {

        public CacheOverride() {
            this(Duration.ofHours(1), 500, 1000);
        }
    }

    public record Session(@DefaultValue("0 * * * * *") String cleanupCron) {}

    public record AuthorizationServer(
            @DefaultValue("http://127.0.0.1:9090") String issuer,
            @DefaultValue("P30D") Duration offlineSessionIdle) {

        public AuthorizationServer(String issuer) {
            this(issuer, Duration.ofDays(30));
        }

        public AuthorizationServer() {
            this(DEFAULT_ISSUER, Duration.ofDays(30));
        }
    }

    public record WebAuthn(
            @DefaultValue("Kitezh") String rpName,
            @DefaultValue("") String rpId,
            @DefaultValue("") String allowedOrigins,
            @DefaultValue("300") int timeoutSeconds,
            @DefaultValue("REQUIRED") String residentKey,
            @DefaultValue("REQUIRED") String userVerification,
            @DefaultValue("NONE") String attestation) {

        public WebAuthn() {
            this("Kitezh", "", "", 300, "REQUIRED", "REQUIRED", "NONE");
        }
    }

    public record RegistrationCaptcha(
            @DefaultValue("disabled") String provider,
            @DefaultValue("") String siteKey,
            @DefaultValue("") String secretKey,
            @DefaultValue("") String projectId,
            @DefaultValue("") String apiKey,
            @DefaultValue("register") String action,
            @DefaultValue("false") boolean recaptchaV3,
            @DefaultValue("0.7") double scoreThreshold,
            @DefaultValue("false") boolean useRecaptchaNet) {

        public RegistrationCaptcha() {
            this("disabled", "", "", "", "", "register", false, 0.7, false);
        }
    }

    public record DPoP(
            @DefaultValue("false") boolean nonceRequired, @DefaultValue("PT5M") Duration nonceTtl) {

        public DPoP() {
            this(false, Duration.ofMinutes(5));
        }
    }

    public record Mail(
            @DefaultValue("false") boolean enabled,
            @DefaultValue("Kitezh <no-reply@localhost>") String from,
            @DefaultValue("http://127.0.0.1:9090") String baseUrl) {}

    public record Security(
            @DefaultValue PasswordPolicy passwordPolicy, @DefaultValue BruteForce bruteForce) {

        public Security() {
            this(new PasswordPolicy(), new BruteForce());
        }
    }

    public record PasswordPolicy(
            @DefaultValue("12") int minimumLength,
            @DefaultValue("128") int maximumLength,
            @DefaultValue("1") int minimumUppercase,
            @DefaultValue("1") int minimumLowercase,
            @DefaultValue("1") int minimumDigits,
            @DefaultValue("1") int minimumSpecialCharacters,
            @DefaultValue("true") boolean rejectUsername,
            @DefaultValue("true") boolean rejectEmail,
            @DefaultValue("true") boolean rejectCommonPasswords,
            @DefaultValue("5") int historySize,
            @DefaultValue("90") int expirationDays,
            @DefaultValue("password,123456,12345678,qwerty,qwerty123,admin,letmein")
                    String commonPasswords) {

        public PasswordPolicy() {
            this(
                    12,
                    128,
                    1,
                    1,
                    1,
                    1,
                    true,
                    true,
                    true,
                    5,
                    90,
                    "password,123456,12345678,qwerty,qwerty123,admin,letmein");
        }
    }

    public record BruteForce(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("5") int maxFailures,
            @DefaultValue("PT1S") Duration quickLoginWindow,
            @DefaultValue("PT1M") Duration minimumQuickLoginWait,
            @DefaultValue("PT1M") Duration waitIncrement,
            @DefaultValue("PT15M") Duration maxWait,
            @DefaultValue("PT12H") Duration failureResetTime,
            @DefaultValue("3") int maxTemporaryLockouts,
            @DefaultValue("false") boolean permanentLockout,
            @DefaultValue("30") int ipRequestsPerMinute,
            @DefaultValue("5") int usernameIpRequestsPerMinute) {

        public BruteForce() {
            this(
                    true,
                    5,
                    Duration.ofSeconds(1),
                    Duration.ofMinutes(1),
                    Duration.ofMinutes(1),
                    Duration.ofMinutes(15),
                    Duration.ofHours(12),
                    3,
                    false,
                    30,
                    5);
        }
    }
}
