package io.github.susimsek.springauthserversamples.service.ciba;

import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.domain.CibaAuthenticationRequestEntity;
import java.net.URI;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Delivers CIBA ping notifications and push token responses to registered client endpoints. */
@Service
@RequiredArgsConstructor
public class CibaNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CibaNotificationService.class);

    private final CibaNotificationClient notificationClient;
    private final SocialLoginSecretCipher tokenCipher;

    /** Sends the CIBA ping notification. */
    public boolean notifyPing(CibaAuthenticationRequestEntity request) {
        if (!hasDeliveryConfiguration(request)) {
            return false;
        }
        try {
            String notificationToken = notificationToken(request);
            notificationClient.sendNotification(
                    URI.create(request.getNotificationEndpoint()),
                    "Bearer " + notificationToken,
                    Map.of("auth_req_id", request.getAuthReqId()));
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
            String notificationToken = notificationToken(request);
            notificationClient.sendNotification(
                    URI.create(request.getNotificationEndpoint()),
                    "Bearer " + notificationToken,
                    tokenResponse);
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

    private String notificationToken(CibaAuthenticationRequestEntity request) {
        String value = request.getClientNotificationToken();
        return tokenCipher == null || value == null || !value.startsWith("v1:")
                ? value
                : tokenCipher.decrypt(value);
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
}
