package io.github.susimsek.kitezh.service.ciba;

import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/** Typed HTTP client for CIBA notification endpoints. */
@HttpExchange
public interface CibaNotificationClient {

    @PostExchange(contentType = MediaType.APPLICATION_JSON_VALUE)
    void sendNotification(
            URI endpoint,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody Map<String, Object> body);
}
