package io.github.susimsek.kitezh.config.observability;

import ch.qos.logback.classic.PatternLayout;
import ch.qos.logback.classic.net.SyslogAppender;
import ch.qos.logback.classic.pattern.SyslogStartConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Layout;
import ch.qos.logback.core.LayoutBase;
import java.nio.charset.StandardCharsets;
import org.springframework.boot.logging.logback.StructuredLogEncoder;

/** Sends a structured JSON payload through Logback's Syslog handler. */
final class StructuredSyslogAppender extends SyslogAppender {

    private final String format;

    StructuredSyslogAppender(String format) {
        this.format = format;
        setThrowableExcluded(true);
    }

    @Override
    public Layout<ILoggingEvent> buildLayout() {
        StructuredLogEncoder encoder = new StructuredLogEncoder();
        encoder.setContext(getContext());
        encoder.setFormat(format);
        encoder.start();

        PatternLayout prefix = new PatternLayout();
        prefix.getInstanceConverterMap().put("syslogStart", SyslogStartConverter::new);
        prefix.setPattern("%syslogStart{" + getFacility() + "}%nopex{}");
        prefix.setContext(getContext());
        prefix.start();

        LayoutBase<ILoggingEvent> layout =
                new LayoutBase<>() {
                    @Override
                    public String doLayout(ILoggingEvent event) {
                        return prefix.doLayout(event)
                                + new String(encoder.encode(event), StandardCharsets.UTF_8);
                    }
                };
        layout.setContext(getContext());
        layout.start();
        return layout;
    }
}
