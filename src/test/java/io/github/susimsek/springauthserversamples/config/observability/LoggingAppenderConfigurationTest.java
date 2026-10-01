package io.github.susimsek.springauthserversamples.config.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.util.ReflectionTestUtils.invokeMethod;

import ch.qos.logback.classic.AsyncAppender;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.AppenderBase;
import ch.qos.logback.core.OutputStreamAppender;
import ch.qos.logback.core.encoder.Encoder;
import ch.qos.logback.core.encoder.LayoutWrappingEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.env.MockEnvironment;

class LoggingAppenderConfigurationTest {

    @Test
    void resolvesStructuredAndSyslogFormats() {
        MockEnvironment environment =
                new MockEnvironment()
                        .withProperty("logging.structured.format.console", "json")
                        .withProperty("logging.structured.format.file", "ecs");
        LoggingProperties properties = new LoggingProperties();
        properties.setSyslogOutput("json");
        properties.setSyslogJsonFormat("ecs");
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, environment);

        String consoleFormat = invokeMethod(configuration, "structuredFormat", "console");
        String fileFormat = invokeMethod(configuration, "structuredFormat", "file");
        String syslogFormat = invokeMethod(configuration, "syslogFormat");
        assertThat(consoleFormat).isEqualTo("logstash");
        assertThat(fileFormat).isEqualTo("ecs");
        assertThat(syslogFormat).isEqualTo("ecs");

        properties.setSyslogOutput("default");
        String defaultSyslogFormat = invokeMethod(configuration, "syslogFormat");
        assertThat(defaultSyslogFormat).isEmpty();

        String defaultFormat = invokeMethod(configuration, "structuredFormat", "missing");
        assertThat(defaultFormat).isEmpty();
        MockEnvironment customEnvironment =
                new MockEnvironment().withProperty("logging.structured.format.console", "custom");
        LoggingAppenderConfiguration customConfiguration =
                new LoggingAppenderConfiguration(properties, customEnvironment);
        assertThat((String) invokeMethod(customConfiguration, "structuredFormat", "console"))
                .isEqualTo("custom");
    }

    @Test
    void createsAndStopsConfiguredAppenders() throws Exception {
        LoggerContext context = new LoggerContext();
        LoggingProperties properties = new LoggingProperties();
        Path directory = Files.createTempDirectory("logging-test");
        properties.setFilePath(directory.resolve("application.log").toString());
        properties.getServer().setFilePath(directory.resolve("access.log").toString());
        MockEnvironment environment = new MockEnvironment();
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, environment);

        Appender<ILoggingEvent> fileAppender = invokeMethod(configuration, "fileAppender", context);
        Appender<ILoggingEvent> accessAppender =
                invokeMethod(configuration, "accessFileAppender", context);
        Appender<ILoggingEvent> syslogAppender =
                invokeMethod(configuration, "syslogAppender", context);
        Encoder<ILoggingEvent> encoder = invokeMethod(configuration, "encoder", context, "file");

        assertThat(fileAppender.isStarted()).isTrue();
        assertThat(accessAppender.isStarted()).isTrue();
        assertThat(syslogAppender.isStarted()).isTrue();
        assertThat(encoder.isStarted()).isTrue();

        MockEnvironment structuredEnvironment =
                new MockEnvironment().withProperty("logging.structured.format.file", "json");
        context.putObject(
                org.springframework.core.env.Environment.class.getName(), structuredEnvironment);
        Encoder<ILoggingEvent> structuredEncoder =
                invokeMethod(
                        new LoggingAppenderConfiguration(properties, structuredEnvironment),
                        "encoder",
                        context,
                        "file");
        assertThat(structuredEncoder)
                .isInstanceOf(org.springframework.boot.logging.logback.StructuredLogEncoder.class);

        fileAppender.stop();
        accessAppender.stop();
        syslogAppender.stop();
        encoder.stop();
        structuredEncoder.stop();
        context.stop();
    }

    @Test
    void createsStructuredSyslogAppender() {
        LoggerContext context = new LoggerContext();
        context.putObject(
                org.springframework.core.env.Environment.class.getName(), new MockEnvironment());
        LoggingProperties properties = new LoggingProperties();
        properties.setSyslogOutput("json");
        properties.setSyslogJsonFormat("ecs");
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, new MockEnvironment());
        Appender<ILoggingEvent> appender = invokeMethod(configuration, "syslogAppender", context);

        assertThat(appender).isInstanceOf(StructuredSyslogAppender.class);
        appender.stop();
        context.stop();
    }

    @Test
    void wrapsAppenderAsynchronouslyAndListsRootAppenders() {
        LoggerContext context = new LoggerContext();
        final Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        AppenderBase<ILoggingEvent> delegate =
                new AppenderBase<>() {
                    @Override
                    protected void append(ILoggingEvent event) {
                        event.getMessage();
                    }
                };
        delegate.setContext(context);
        delegate.setName("DELEGATE");
        delegate.start();
        root.addAppender(delegate);

        LoggingProperties properties = new LoggingProperties();
        properties.setAsyncQueueSize(17);
        properties.setAsyncNeverBlock(true);
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, new MockEnvironment());
        List<Appender<ILoggingEvent>> appenders =
                invokeMethod(configuration, "rootAppenders", root);
        AsyncAppender async = invokeMethod(configuration, "asyncAppender", context, delegate);

        assertThat(appenders).containsExactly(delegate);
        assertThat(async.getQueueSize()).isEqualTo(17);
        boolean hasAsyncAppender = invokeMethod(configuration, "hasAsyncAppender", root);
        assertThat(hasAsyncAppender).isFalse();
        async.stop();
        root.detachAppender(delegate);
        delegate.stop();
        context.stop();
    }

    @Test
    void installsAsyncDelegatesAndConfiguresStructuredConsole() {
        LoggerContext context = new LoggerContext();
        MockEnvironment environment = new MockEnvironment();
        context.putObject(org.springframework.core.env.Environment.class.getName(), environment);
        final Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        OutputStreamAppender<ILoggingEvent> console = new OutputStreamAppender<>();
        console.setContext(context);
        console.setName("CONSOLE");
        LayoutWrappingEncoder<ILoggingEvent> encoder = new LayoutWrappingEncoder<>();
        encoder.setContext(context);
        console.setEncoder(encoder);
        console.start();
        root.addAppender(console);

        LoggingProperties properties = new LoggingProperties();
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(
                        properties,
                        environment.withProperty("logging.structured.format.console", "json"));
        invokeMethod(configuration, "configureConsole", root);

        AppenderBase<ILoggingEvent> delegate =
                new AppenderBase<>() {
                    @Override
                    protected void append(ILoggingEvent event) {
                        event.getMessage();
                    }
                };
        delegate.setContext(context);
        delegate.setName("ASYNC_DELEGATE");
        delegate.start();
        invokeMethod(configuration, "installAsyncRoot", context, root, List.of(console, delegate));

        assertThat(root.getAppender("APPLICATION_ASYNC_ASYNC_DELEGATE")).isNotNull();
        assertThat(root.getAppender("APPLICATION_ASYNC_CONSOLE")).isNotNull();

        root.detachAppender("APPLICATION_ASYNC_ASYNC_DELEGATE");
        root.detachAppender("APPLICATION_ASYNC_CONSOLE");
        console.stop();
        delegate.stop();
        context.stop();
    }

    @Test
    void detectsExistingAsyncAppenderAndKeepsExistingAccessFile() throws Exception {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        final Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        AsyncAppender existing = new AsyncAppender();
        existing.setContext(context);
        existing.setName("APPLICATION_ASYNC_EXISTING");
        existing.start();
        root.addAppender(existing);
        Path directory = Files.createTempDirectory("logging-existing");
        LoggingProperties properties = new LoggingProperties();
        properties.getServer().setFileEnabled(true);
        properties.getServer().setFilePath(directory.resolve("access.log").toString());
        properties.setAsyncEnabled(false);
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, new MockEnvironment());
        final Logger accessLogger =
                context.getLogger("io.github.susimsek.springauthserversamples.http.access");

        configuration.configure();

        assertThat((Boolean) invokeMethod(configuration, "hasAsyncAppender", root)).isTrue();

        invokeMethod(configuration, "installAccessFile", context);
        Appender<?> accessFile = accessLogger.getAppender("APPLICATION_ACCESS_FILE");
        invokeMethod(configuration, "installAccessFile", context);
        assertThat(accessFile).isNotNull();
        assertThat(accessLogger.getAppender("APPLICATION_ACCESS_FILE")).isSameAs(accessFile);
        accessLogger.detachAppender("APPLICATION_ACCESS_FILE");
        accessFile.stop();
        root.detachAppender(existing);
        existing.stop();
    }

    @Test
    void configuresOptionalHandlersAndAsyncRoot() throws Exception {
        final LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        final Logger root = context.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        final LoggingProperties properties = new LoggingProperties();
        final Path directory = Files.createTempDirectory("logging-config");
        properties.setFileEnabled(true);
        properties.setFilePath(directory.resolve("application.log").toString());
        properties.setSyslogEnabled(true);
        properties.getServer().setFileEnabled(true);
        properties.getServer().setFilePath(directory.resolve("access.log").toString());
        properties.setAsyncEnabled(false);
        LoggingAppenderConfiguration configuration =
                new LoggingAppenderConfiguration(properties, new MockEnvironment());

        configuration.configure();

        assertThat(root.getAppender("APPLICATION_FILE")).isNotNull();
        assertThat(root.getAppender("APPLICATION_SYSLOG")).isNotNull();
        final Logger accessLogger =
                context.getLogger("io.github.susimsek.springauthserversamples.http.access");
        assertThat(accessLogger.getAppender("APPLICATION_ACCESS_FILE")).isNotNull();

        final Appender<?> fileAppender = root.getAppender("APPLICATION_FILE");
        final Appender<?> syslogAppender = root.getAppender("APPLICATION_SYSLOG");
        final Appender<?> accessAppender = accessLogger.getAppender("APPLICATION_ACCESS_FILE");
        root.detachAppender("APPLICATION_FILE");
        root.detachAppender("APPLICATION_SYSLOG");
        accessLogger.detachAppender("APPLICATION_ACCESS_FILE");
        fileAppender.stop();
        syslogAppender.stop();
        accessAppender.stop();
    }
}
