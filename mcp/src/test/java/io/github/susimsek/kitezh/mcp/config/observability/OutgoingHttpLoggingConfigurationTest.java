package io.github.susimsek.kitezh.mcp.config.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OutgoingHttpLoggingConfigurationTest {

    private final Logger logger =
            (Logger) LoggerFactory.getLogger("io.github.susimsek.kitezh.http.client");
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    @BeforeEach
    void setUp() {
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
        appender.stop();
    }

    @Test
    void addsLoggingInterceptorWhenClientLoggingIsEnabled() {
        LoggingProperties properties = new LoggingProperties();
        properties.getClient().setEnabled(true);
        RestClient.Builder builder = RestClient.builder();
        new OutgoingHttpLoggingConfiguration()
                .outgoingHttpLoggingCustomizer(properties)
                .customize(builder);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://kitezh.test/api/admin/users"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        builder.build()
                .get()
                .uri("https://kitezh.test/api/admin/users")
                .retrieve()
                .toBodilessEntity();

        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .anySatisfy(message -> assertThat(message).contains("HTTP client request"));
        server.verify();
    }

    @Test
    void leavesLoggingInterceptorDisabledByDefault() {
        RestClient.Builder builder = RestClient.builder();
        new OutgoingHttpLoggingConfiguration()
                .outgoingHttpLoggingCustomizer(new LoggingProperties())
                .customize(builder);
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://kitezh.test/api/admin/users"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        builder.build()
                .get()
                .uri("https://kitezh.test/api/admin/users")
                .retrieve()
                .toBodilessEntity();

        assertThat(appender.list).isEmpty();
        server.verify();
    }
}
