package io.github.susimsek.springauthserversamples.config.observability;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configures optional log handlers and asynchronous logging. */
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
    private Access access = new Access();

    @Getter
    @Setter
    public static class Access {

        private boolean enabled = true;
        private String pattern = "common";
        private List<String> excludePaths = new ArrayList<>();
        private List<String> maskedHeaders = new ArrayList<>(List.of("Authorization", "Cookie"));
        private List<String> maskedCookies = new ArrayList<>(List.of("SESSION"));
        private boolean fileEnabled;
        private String filePath = "logs/application-access.log";
    }
}
