package io.github.susimsek.kitezh.config.observability;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configures optional log handlers, asynchronous logging, and HTTP client diagnostics. */
@ConfigurationProperties(prefix = "app.logging")
@Getter
@Setter
public class LoggingProperties {

    private boolean fileEnabled;
    private String filePath = "logs/application.log";
    private boolean syslogEnabled;
    private String syslogHost = "localhost";
    private int syslogPort = 514;
    private String syslogFacility = "USER";
    private String syslogOutput = "default";
    private String syslogJsonFormat = "default";
    private boolean asyncEnabled = true;
    private int asyncQueueSize = 512;
    private boolean asyncNeverBlock;
    private int maxBodyBytes = 8192;
    private Obfuscate obfuscate = new Obfuscate();
    private HttpClient client = new HttpClient();
    private Server server = new Server();

    @Getter
    @Setter
    public static class HttpClient {

        private boolean enabled;
        private HttpLoggingLevel level = HttpLoggingLevel.BASIC;
        private List<String> excludePaths = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class Server {

        private boolean enabled = true;
        private HttpLoggingLevel level = HttpLoggingLevel.BASIC;
        private List<String> excludePaths = new ArrayList<>();
        private boolean fileEnabled;
        private String filePath = "logs/application-access.log";
    }

    @Getter
    @Setter
    public static class Obfuscate {

        private String replacement = "***";
        private List<String> headers = new ArrayList<>(List.of("Authorization", "Cookie"));
        private List<String> bodyFields =
                new ArrayList<>(
                        List.of(
                                "access_token",
                                "refresh_token",
                                "id_token",
                                "client_secret",
                                "password",
                                "authorization",
                                "cookie",
                                "token",
                                "secret",
                                "api_key",
                                "assertion",
                                "saml_response",
                                "private_key",
                                "code",
                                "code_verifier",
                                "captchaToken",
                                "response",
                                "siteKey",
                                "apiKey",
                                "auth_req_id",
                                "client_notification_token",
                                "id_token_hint",
                                "login_hint_token",
                                "user_code",
                                "dpop",
                                "dpop_proof",
                                "jwk"));
        private List<String> parameters =
                new ArrayList<>(
                        List.of(
                                "access_token",
                                "refresh_token",
                                "id_token",
                                "client_secret",
                                "client_assertion",
                                "password",
                                "authorization",
                                "token",
                                "secret",
                                "api_key",
                                "assertion",
                                "code",
                                "code_verifier",
                                "state",
                                "nonce",
                                "request",
                                "request_uri",
                                "id_token_hint",
                                "auth_req_id",
                                "client_notification_token",
                                "login_hint_token",
                                "user_code",
                                "captchaToken",
                                "response",
                                "key"));
        private List<String> cookies = new ArrayList<>(List.of("SESSION"));
    }
}
