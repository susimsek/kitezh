package io.github.susimsek.springauthserversamples.service.ciba;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class CibaNotificationServiceTest {

    @Test
    void sendsPingAndPushNotifications() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        CibaNotificationService service = new CibaNotificationService(builder.build());
        CibaAuthenticationRequestEntity request = request("https://client.example/ciba", "token");

        server.expect(requestTo("https://client.example/ciba"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer token"))
                .andExpect(header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE))
                .andExpect(content().json("{\"auth_req_id\":\"request id\"}"))
                .andRespond(withSuccess());
        server.expect(requestTo("https://client.example/ciba"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer token"))
                .andRespond(withSuccess());
        assertThat(service.notifyPing(request)).isTrue();
        assertThat(service.deliverPush(request, Map.of("access_token", "value"))).isTrue();

        server.verify();
    }

    @Test
    void returnsFalseForInvalidConfigurationAndDeliveryFailures() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        CibaNotificationService service = new CibaNotificationService(builder.build());

        assertThat(service.notifyPing(request(null, "token"))).isFalse();
        assertThat(service.deliverPush(request("not a uri", "token"), Map.of())).isFalse();
        assertThat(service.notifyPing(request("", "token"))).isFalse();
        assertThat(service.deliverPush(request("https://client.example/ciba", ""), Map.of()))
                .isFalse();
        assertThat(service.notifyPing(request("ftp://client.example/ciba", "token"))).isFalse();
        assertThat(service.deliverPush(request("://", "token"), Map.of())).isFalse();

        server.expect(requestTo("https://client.example/ciba")).andRespond(withServerError());
        server.expect(requestTo("https://client.example/ciba")).andRespond(withServerError());
        assertThat(service.notifyPing(request("https://client.example/ciba", "token"))).isFalse();
        assertThat(service.deliverPush(request("https://client.example/ciba", "token"), Map.of()))
                .isFalse();
    }

    @Test
    void decryptsEncryptedCallbackTokensAndKeepsLegacyTokens() {
        SocialLoginSecretCipher cipher = Mockito.mock(SocialLoginSecretCipher.class);
        Mockito.when(cipher.decrypt("v1:encrypted")).thenReturn("decrypted-token");
        CibaNotificationService service = new CibaNotificationService(cipher);

        CibaAuthenticationRequestEntity encrypted =
                request("https://client.example/ciba", "v1:encrypted");
        assertThat(
                        (Object)
                                org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                                        service, "notificationToken", encrypted))
                .isEqualTo("decrypted-token");
        CibaAuthenticationRequestEntity legacy = request("https://client.example/ciba", "legacy");
        assertThat(
                        (Object)
                                org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                                        service, "notificationToken", legacy))
                .isEqualTo("legacy");
        CibaAuthenticationRequestEntity missing = request("https://client.example/ciba", null);
        assertThat(
                        (Object)
                                org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                                        service, "notificationToken", missing))
                .isNull();
    }

    private static CibaAuthenticationRequestEntity request(String endpoint, String token) {
        CibaAuthenticationRequestEntity request = new CibaAuthenticationRequestEntity();
        request.setAuthReqId("request id");
        request.setNotificationEndpoint(endpoint);
        request.setClientNotificationToken(token);
        request.setCreatedAt(Instant.now());
        request.setExpiresAt(Instant.now().plusSeconds(300));
        return request;
    }
}
