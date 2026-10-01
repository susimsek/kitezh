package io.github.susimsek.springauthserversamples.config.observability;

import ch.qos.logback.classic.AsyncAppender;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.classic.net.SyslogAppender;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.OutputStreamAppender;
import ch.qos.logback.core.rolling.RollingFileAppender;
import ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy;
import ch.qos.logback.core.util.FileSize;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.logging.logback.StructuredLogEncoder;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/** Installs optional file and Syslog handlers and wraps root logging in an async appender. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(LoggerContext.class)
public class LoggingAppenderConfiguration {

    private static final String ASYNC_APPENDER_PREFIX = "APPLICATION_ASYNC_";
    private static final String ACCESS_LOGGER_NAME =
            "io.github.susimsek.springauthserversamples.http.access";
    private static final String LOG_PATTERN =
            "%d{yyyy-MM-dd'T'HH:mm:ss.SSSXXX} %-5level [%thread] %logger{36} - %msg%n%ex";

    private final LoggingProperties properties;
    private final Environment environment;

    public LoggingAppenderConfiguration(LoggingProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @PostConstruct
    void configure() {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        if (hasAsyncAppender(root)) {
            return;
        }

        configureConsole(root);
        List<Appender<ILoggingEvent>> appenders = rootAppenders(root);
        if (properties.isFileEnabled()) {
            appenders.add(fileAppender(context));
        }
        if (properties.isSyslogEnabled()) {
            appenders.add(syslogAppender(context));
        }
        if (properties.getServer().isFileEnabled()) {
            installAccessFile(context);
        }
        if (properties.isAsyncEnabled()) {
            installAsyncRoot(context, root, appenders);
        } else {
            appenders.stream()
                    .filter(appender -> root.getAppender(appender.getName()) == null)
                    .forEach(root::addAppender);
        }
    }

    private static List<Appender<ILoggingEvent>> rootAppenders(Logger root) {
        List<Appender<ILoggingEvent>> appenders = new ArrayList<>();
        var iterator = root.iteratorForAppenders();
        iterator.forEachRemaining(appenders::add);
        return appenders;
    }

    private void installAsyncRoot(
            LoggerContext context, Logger root, List<Appender<ILoggingEvent>> appenders) {
        appenders.forEach(root::detachAppender);
        appenders.stream()
                .map(appender -> asyncAppender(context, appender))
                .forEach(root::addAppender);
    }

    private AsyncAppender asyncAppender(
            LoggerContext context, Appender<ILoggingEvent> delegateAppender) {
        AsyncAppender asyncAppender = new AsyncAppender();
        asyncAppender.setContext(context);
        asyncAppender.setName(ASYNC_APPENDER_PREFIX + delegateAppender.getName());
        asyncAppender.setQueueSize(properties.getAsyncQueueSize());
        asyncAppender.setNeverBlock(properties.isAsyncNeverBlock());
        asyncAppender.addAppender(delegateAppender);
        asyncAppender.start();
        return asyncAppender;
    }

    private static boolean hasAsyncAppender(Logger root) {
        var iterator = root.iteratorForAppenders();
        while (iterator.hasNext()) {
            if (iterator.next().getName().startsWith(ASYNC_APPENDER_PREFIX)) {
                return true;
            }
        }
        return false;
    }

    private Appender<ILoggingEvent> fileAppender(LoggerContext context) {
        RollingFileAppender<ILoggingEvent> fileAppender = new RollingFileAppender<>();
        fileAppender.setContext(context);
        fileAppender.setName("APPLICATION_FILE");
        fileAppender.setFile(properties.getFilePath());

        var encoder = encoder(context, "file");
        fileAppender.setEncoder(encoder);

        SizeAndTimeBasedRollingPolicy<ILoggingEvent> rollingPolicy =
                new SizeAndTimeBasedRollingPolicy<>();
        rollingPolicy.setContext(context);
        rollingPolicy.setParent(fileAppender);
        rollingPolicy.setFileNamePattern(properties.getFilePath() + ".%d{yyyy-MM-dd}.%i.gz");
        rollingPolicy.setMaxFileSize(FileSize.valueOf("10MB"));
        rollingPolicy.setMaxHistory(7);
        rollingPolicy.setTotalSizeCap(FileSize.valueOf("100MB"));
        rollingPolicy.start();
        fileAppender.setRollingPolicy(rollingPolicy);
        fileAppender.start();
        return fileAppender;
    }

    private void installAccessFile(LoggerContext context) {
        Logger accessLogger = context.getLogger(ACCESS_LOGGER_NAME);
        if (accessLogger.getAppender("APPLICATION_ACCESS_FILE") != null) {
            return;
        }
        Appender<ILoggingEvent> accessFile = accessFileAppender(context);
        accessLogger.setAdditive(false);
        accessLogger.addAppender(
                properties.isAsyncEnabled() ? asyncAppender(context, accessFile) : accessFile);
    }

    private Appender<ILoggingEvent> accessFileAppender(LoggerContext context) {
        LoggingProperties.Server access = properties.getServer();
        RollingFileAppender<ILoggingEvent> fileAppender = new RollingFileAppender<>();
        fileAppender.setContext(context);
        fileAppender.setName("APPLICATION_ACCESS_FILE");
        fileAppender.setFile(access.getFilePath());
        fileAppender.setEncoder(encoder(context, "file"));

        SizeAndTimeBasedRollingPolicy<ILoggingEvent> rollingPolicy =
                new SizeAndTimeBasedRollingPolicy<>();
        rollingPolicy.setContext(context);
        rollingPolicy.setParent(fileAppender);
        rollingPolicy.setFileNamePattern(access.getFilePath() + ".%d{yyyy-MM-dd}.%i.gz");
        rollingPolicy.setMaxFileSize(FileSize.valueOf("10MB"));
        rollingPolicy.setMaxHistory(7);
        rollingPolicy.setTotalSizeCap(FileSize.valueOf("100MB"));
        rollingPolicy.start();
        fileAppender.setRollingPolicy(rollingPolicy);
        fileAppender.start();
        return fileAppender;
    }

    private void configureConsole(Logger root) {
        String format = structuredFormat("console");
        if (format.isBlank()) {
            return;
        }
        Appender<?> appender = root.getAppender("CONSOLE");
        if (appender instanceof OutputStreamAppender<?> outputStreamAppender) {
            @SuppressWarnings("unchecked")
            OutputStreamAppender<ILoggingEvent> console =
                    (OutputStreamAppender<ILoggingEvent>) outputStreamAppender;
            if (console.getEncoder() != null) {
                console.getEncoder().stop();
            }
            console.setEncoder(structuredEncoder(root.getLoggerContext(), format));
        }
    }

    private ch.qos.logback.core.encoder.Encoder<ILoggingEvent> encoder(
            LoggerContext context, String output) {
        String format = structuredFormat(output);
        if (!format.isBlank()) {
            return structuredEncoder(context, format);
        }
        PatternLayoutEncoder encoder = new PatternLayoutEncoder();
        encoder.setContext(context);
        encoder.setPattern(LOG_PATTERN);
        encoder.start();
        return encoder;
    }

    private static StructuredLogEncoder structuredEncoder(LoggerContext context, String format) {
        StructuredLogEncoder encoder = new StructuredLogEncoder();
        encoder.setContext(context);
        encoder.setFormat(format);
        encoder.start();
        return encoder;
    }

    private String structuredFormat(String output) {
        String configured =
                environment.getProperty("logging.structured.format." + output, "").trim();
        return switch (configured.toLowerCase()) {
            case "", "default" -> "";
            case "json" -> "logstash";
            default -> configured;
        };
    }

    private Appender<ILoggingEvent> syslogAppender(LoggerContext context) {
        String format = syslogFormat();
        SyslogAppender syslogAppender =
                format.isBlank() ? new SyslogAppender() : new StructuredSyslogAppender(format);
        syslogAppender.setContext(context);
        syslogAppender.setName("APPLICATION_SYSLOG");
        syslogAppender.setSyslogHost(properties.getSyslogHost());
        syslogAppender.setPort(properties.getSyslogPort());
        syslogAppender.setFacility(properties.getSyslogFacility());
        syslogAppender.setSuffixPattern("%logger{36}: %msg");
        syslogAppender.start();
        return syslogAppender;
    }

    private String syslogFormat() {
        if (!"json".equalsIgnoreCase(properties.getSyslogOutput())) {
            return "";
        }
        String format = properties.getSyslogJsonFormat();
        return "ecs".equalsIgnoreCase(format) ? "ecs" : "logstash";
    }
}
