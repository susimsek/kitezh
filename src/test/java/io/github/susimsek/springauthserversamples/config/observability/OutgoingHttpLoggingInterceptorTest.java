package io.github.susimsek.springauthserversamples.config.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.web.client.RestClient;

class OutgoingHttpLoggingInterceptorTest {

    private final Logger logger =
            (Logger)
                    LoggerFactory.getLogger(
                            "io.github.susimsek.springauthserversamples.http.client");
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
    void logsRedactedRequestAndResponseWithoutQueryOrBody() throws IOException {
        LoggingProperties.HttpClient properties = new LoggingProperties.HttpClient();
        properties.setLevel(HttpLoggingLevel.HEADERS);
        LoggingProperties.Obfuscate obfuscate = new LoggingProperties.Obfuscate();
        obfuscate.setHeaders(List.of("X-Secret"));
        OutgoingHttpLoggingInterceptor interceptor =
                new OutgoingHttpLoggingInterceptor(properties, obfuscate);
        MockClientHttpRequest request =
                new MockClientHttpRequest(
                        HttpMethod.POST, URI.create("https://idp.example/token?code=secret"));
        request.getHeaders().setBearerAuth("token");

        MockClientHttpResponse response = new MockClientHttpResponse(new byte[0], 200);
        response.getHeaders().add("X-Response", "visible");
        response.getHeaders().add("Set-Cookie", "secret-cookie");
        interceptor.intercept(
                request,
                "client_secret=secret".getBytes(),
                (ignoredRequest, ignoredBody) -> response);

        assertThat(appender.list).hasSize(2);
        assertThat(appender.list.get(0).getFormattedMessage())
                .contains("HTTP client request")
                .contains("POST")
                .contains("https://idp.example/token?code=***")
                .contains("Authorization=***")
                .doesNotContain("code=secret", "client_secret=secret");
        assertThat(appender.list.get(0).getKeyValuePairs())
                .anySatisfy(
                        pair -> {
                            assertThat(pair.key).isEqualTo("direction");
                            assertThat(pair.value).isEqualTo("outbound");
                        });
        assertThat(appender.list.get(0).getKeyValuePairs())
                .anySatisfy(
                        pair -> {
                            assertThat(pair.key).isEqualTo("type");
                            assertThat(pair.value).isEqualTo("request");
                        });
        assertThat(appender.list.get(1).getFormattedMessage())
                .contains("HTTP client response")
                .contains("status=200")
                .contains("X-Response=[visible]")
                .contains("Set-Cookie=***");
        assertThat(appender.list.get(1).getKeyValuePairs())
                .anySatisfy(
                        pair -> {
                            assertThat(pair.key).isEqualTo("http.response_headers");
                            assertThat(pair.value.toString())
                                    .contains("X-Response=[visible]")
                                    .contains("Set-Cookie=***");
                        });
    }

    @Test
    void logsOptInMaskedBodiesWithinLimitAndPreservesResponseBody() throws IOException {
        LoggingProperties.HttpClient properties = new LoggingProperties.HttpClient();
        properties.setLevel(HttpLoggingLevel.FULL);
        OutgoingHttpLoggingInterceptor interceptor =
                new OutgoingHttpLoggingInterceptor(
                        properties, new LoggingProperties.Obfuscate(), 1024);
        MockClientHttpRequest request =
                new MockClientHttpRequest(HttpMethod.POST, URI.create("https://idp.example/token"));
        request.getHeaders().setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        byte[] requestBody =
                "username=admin&password=secret&client_secret=client-secret"
                        .getBytes(StandardCharsets.UTF_8);
        byte[] responseBody =
                "{\"access_token\":\"access-secret\",\"name\":\"visible\"}"
                        .getBytes(StandardCharsets.UTF_8);
        MockClientHttpResponse response = new MockClientHttpResponse(responseBody, 200);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        response.getHeaders().setContentLength(responseBody.length);

        var returned =
                interceptor.intercept(
                        request, requestBody, (ignoredRequest, ignoredBody) -> response);

        assertThat(appender.list).hasSize(2);
        assertThat(appender.list.get(0).getFormattedMessage())
                .contains("password=***")
                .contains("client_secret=***")
                .doesNotContain("password=secret", "client_secret=client-secret");
        assertThat(appender.list.get(0).getKeyValuePairs())
                .anySatisfy(
                        pair ->
                                assertThat(pair.value.toString())
                                        .contains("password=***")
                                        .doesNotContain("client-secret"));
        assertThat(appender.list.get(1).getFormattedMessage())
                .contains("access_token\":\"***\"")
                .contains("name\":\"visible\"")
                .doesNotContain("access-secret");
        assertThat(returned.getBody().readAllBytes()).isEqualTo(responseBody);
    }

    @Test
    void omitsOversizedResponseBodyWithoutConsumingResponse() throws IOException {
        LoggingProperties.HttpClient properties = new LoggingProperties.HttpClient();
        properties.setLevel(HttpLoggingLevel.FULL);
        OutgoingHttpLoggingInterceptor interceptor =
                new OutgoingHttpLoggingInterceptor(
                        properties, new LoggingProperties.Obfuscate(), 4);
        MockClientHttpRequest request =
                new MockClientHttpRequest(HttpMethod.GET, URI.create("https://idp.example/user"));
        request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] responseBody = "{\"name\":\"visible\"}".getBytes(StandardCharsets.UTF_8);
        MockClientHttpResponse response = new MockClientHttpResponse(responseBody, 200);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        response.getHeaders().setContentLength(responseBody.length);

        var returned =
                interceptor.intercept(
                        request, new byte[0], (ignoredRequest, ignoredBody) -> response);

        assertThat(appender.list.get(1).getFormattedMessage())
                .contains("body=[omitted: exceeds-limit]");
        assertThat(returned.getBody().readAllBytes()).isEqualTo(responseBody);
    }

    @Test
    void logsNetworkFailuresWithoutLoggingExceptionDetails() {
        LoggingProperties.HttpClient properties = new LoggingProperties.HttpClient();
        OutgoingHttpLoggingInterceptor interceptor = new OutgoingHttpLoggingInterceptor(properties);
        MockClientHttpRequest request =
                new MockClientHttpRequest(HttpMethod.GET, URI.create("https://idp.example/user"));
        IOException failure = new IOException("secret response body");

        assertThatThrownBy(
                        () ->
                                interceptor.intercept(
                                        request,
                                        new byte[0],
                                        (ignoredRequest, ignoredBody) -> {
                                            throw failure;
                                        }))
                .isSameAs(failure);

        assertThat(appender.list).hasSize(2);
        assertThat(appender.list.get(1).getFormattedMessage())
                .contains("HTTP client failure")
                .contains("exception=IOException")
                .doesNotContain("secret response body");
    }

    @Test
    void onlyAddsInterceptorWhenEnabled() {
        RestClient.Builder disabledBuilder = mock(RestClient.Builder.class);
        new OutgoingHttpLoggingConfiguration()
                .outgoingHttpLoggingCustomizer(new LoggingProperties())
                .customize(disabledBuilder);
        verify(disabledBuilder, never()).requestInterceptor(any());

        LoggingProperties enabledProperties = new LoggingProperties();
        enabledProperties.getClient().setEnabled(true);
        RestClient.Builder enabledBuilder = mock(RestClient.Builder.class);
        new OutgoingHttpLoggingConfiguration()
                .outgoingHttpLoggingCustomizer(enabledProperties)
                .customize(enabledBuilder);
        verify(enabledBuilder).requestInterceptor(any());
    }
}
