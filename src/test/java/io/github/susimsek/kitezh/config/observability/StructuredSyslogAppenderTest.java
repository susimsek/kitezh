package io.github.susimsek.kitezh.config.observability;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.core.Layout;
import ch.qos.logback.core.LayoutBase;
import ch.qos.logback.core.spi.ContextAware;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;

class StructuredSyslogAppenderTest {

    @Test
    void buildsStructuredLayoutWithSyslogPrefix() {
        LoggerContext context = new LoggerContext();
        context.putObject(Environment.class.getName(), new MockEnvironment());
        StructuredSyslogAppender appender = new StructuredSyslogAppender("ecs");
        appender.setContext(context);
        appender.setFacility("USER");
        Layout<?> layout = appender.buildLayout();

        assertThat(layout).isInstanceOf(LayoutBase.class).isInstanceOf(ContextAware.class);
        LoggingEvent event = new LoggingEvent();
        event.setLevel(Level.INFO);
        event.setLoggerName("test");
        event.setMessage("message");
        event.setLoggerContext(context);
        event.setMDCPropertyMap(Map.of());
        String output = ((Layout<LoggingEvent>) layout).doLayout(event);
        assertThat(output).contains("{", "}");

        layout.stop();
        context.stop();
    }
}
