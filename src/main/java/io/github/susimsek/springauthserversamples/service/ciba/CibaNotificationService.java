package io.github.susimsek.springauthserversamples.service.ciba;

import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Delivers CIBA ping notifications and push token responses to registered client endpoints. */
@Service
public class CibaNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CibaNotificationService.class);

    private final RestClient restClient;

    @Autowired
    public CibaNotificationService() {
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    CibaNotificationService(RestClient restClient) {
        this.restClient = restClient;
    }

    /** Sends the CIBA ping notification. */
    public boolean notifyPing(CibaAuthenticationRequestEntity request) {
        if (!hasDeliveryConfiguration(request)) {
            return false;
        }
        try {
            restClient
                    .post()
                    .uri(request.getNotificationEndpoint())
                    .headers(headers -> headers.setBearerAuth(request.getClientNotificationToken()))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body("auth_req_id=" + encode(request.getAuthReqId()))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RuntimeException exception) {
            LOGGER.warn(
                    "CIBA ping notification failed for auth_req_id {}",
                    request.getAuthReqId(),
                    exception);
            return false;
        }
    }

    /** Sends the final CIBA token response using the push delivery mode. */
    public boolean deliverPush(
            CibaAuthenticationRequestEntity request, Map<String, Object> tokenResponse) {
        if (!hasDeliveryConfiguration(request)) {
            return false;
        }
        try {
            restClient
                    .post()
                    .uri(request.getNotificationEndpoint())
                    .headers(headers -> headers.setBearerAuth(request.getClientNotificationToken()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(tokenResponse)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RuntimeException exception) {
            LOGGER.warn(
                    "CIBA push delivery failed for auth_req_id {}",
                    request.getAuthReqId(),
                    exception);
            return false;
        }
    }

    private static boolean hasDeliveryConfiguration(CibaAuthenticationRequestEntity request) {
        return request.getNotificationEndpoint() != null
                && !request.getNotificationEndpoint().isBlank()
                && request.getClientNotificationToken() != null
                && !request.getClientNotificationToken().isBlank()
                && isHttpUri(request.getNotificationEndpoint());
    }

    private static boolean isHttpUri(String value) {
        try {
            URI uri = URI.create(value);
            return uri.getHost() != null
                    && ("http".equalsIgnoreCase(uri.getScheme())
                            || "https".equalsIgnoreCase(uri.getScheme()));
        } catch (IllegalArgumentException _) {
            return false;
        }
    }

    private static String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
