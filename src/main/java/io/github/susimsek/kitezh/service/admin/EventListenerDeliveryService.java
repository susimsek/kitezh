package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryEntity;
import io.github.susimsek.kitezh.domain.EventListenerDeliveryStatus;
import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.github.susimsek.kitezh.domain.EventListenerProviderEntity;
import io.github.susimsek.kitezh.repository.EventListenerDeliveryRepository;
import io.github.susimsek.kitezh.repository.EventListenerProviderRepository;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

/** Queues webhook deliveries and processes them asynchronously with bounded retries. */
@Service
public class EventListenerDeliveryService {
    private static final Logger LOGGER =
            LoggerFactory.getLogger(EventListenerDeliveryService.class);
    private final EventListenerProviderRepository providerRepository;
    private final EventListenerDeliveryRepository deliveryRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Value("${app.events.listener.allow-http:false}")
    private boolean allowHttp;

    @Autowired
    public EventListenerDeliveryService(
            EventListenerProviderRepository providerRepository,
            EventListenerDeliveryRepository deliveryRepository,
            ObjectMapper objectMapper) {
        this(providerRepository, deliveryRepository, objectMapper, buildRestClient());
    }

    EventListenerDeliveryService(
            EventListenerProviderRepository providerRepository,
            EventListenerDeliveryRepository deliveryRepository,
            ObjectMapper objectMapper,
            RestClient restClient) {
        this.providerRepository = providerRepository;
        this.deliveryRepository = deliveryRepository;
        this.objectMapper = objectMapper;
        this.restClient = restClient;
    }

    @Transactional
    public void dispatch(
            EventListenerEventType eventType, String eventId, Map<String, Object> payload) {
        String safePayload = sanitizePayload(writePayload(payload));
        providerRepository.findAll().stream()
                .filter(
                        provider ->
                                provider.isEnabled()
                                        && provider.getEventTypes().contains(eventType))
                .forEach(provider -> queue(provider, eventType, eventId, safePayload));
    }

    @Transactional
    public void retry(String deliveryId) {
        deliveryRepository
                .findById(deliveryId)
                .ifPresent(
                        delivery -> {
                            if (delivery.getStatus() != EventListenerDeliveryStatus.SUCCEEDED) {
                                delivery.setStatus(EventListenerDeliveryStatus.PENDING);
                                delivery.setNextAttemptAt(Instant.now());
                                deliveryRepository.save(delivery);
                            }
                        });
    }

    @Scheduled(fixedDelayString = "${app.events.listener-retry-delay-ms:30000}")
    @Transactional
    public void processDueDeliveries() {
        deliveryRepository
                .findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                        EventListenerDeliveryStatus.PENDING, Instant.now())
                .forEach(this::attempt);
    }

    private void queue(
            EventListenerProviderEntity provider,
            EventListenerEventType eventType,
            String eventId,
            String payload) {
        EventListenerDeliveryEntity delivery = new EventListenerDeliveryEntity();
        Instant now = Instant.now();
        delivery.setId(UUID.randomUUID().toString());
        delivery.setProviderId(provider.getId());
        delivery.setEventId(eventId);
        delivery.setEventType(eventType);
        delivery.setPayload(payload);
        delivery.setStatus(EventListenerDeliveryStatus.PENDING);
        delivery.setNextAttemptAt(now);
        delivery.setCreatedAt(now);
        deliveryRepository.save(delivery);
    }

    private void attempt(EventListenerDeliveryEntity delivery) {
        EventListenerProviderEntity provider =
                delivery.getProviderId() == null
                        ? null
                        : providerRepository.findById(delivery.getProviderId()).orElse(null);
        if (provider == null || !provider.isEnabled()) {
            markFailed(delivery, "Provider is missing or disabled");
        } else if (!isAllowedEndpoint(provider.getEndpointUrl(), allowHttp)) {
            markFailed(delivery, "Endpoint failed SSRF validation");
        } else {
            delivery.setAttempts(delivery.getAttempts() + 1);
            try {
                restClient
                        .post()
                        .uri(provider.getEndpointUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(delivery.getPayload())
                        .retrieve()
                        .toBodilessEntity();
                delivery.setStatus(EventListenerDeliveryStatus.SUCCEEDED);
                delivery.setLastError(null);
                delivery.setNextAttemptAt(null);
                delivery.setCompletedAt(Instant.now());
            } catch (RuntimeException exception) {
                LOGGER.warn("Event listener delivery failed for {}", delivery.getId(), exception);
                delivery.setLastError(safeMessage(exception));
                if (delivery.getAttempts() < provider.getMaxAttempts()) {
                    delivery.setStatus(EventListenerDeliveryStatus.PENDING);
                    long delay =
                            provider.getBackoffSeconds()
                                    * (1L << Math.min(delivery.getAttempts() - 1, 10));
                    delivery.setNextAttemptAt(Instant.now().plusSeconds(Math.min(delay, 86400L)));
                } else {
                    markFailed(delivery, delivery.getLastError());
                }
            }
        }
        deliveryRepository.save(delivery);
    }

    private static void markFailed(EventListenerDeliveryEntity delivery, String error) {
        delivery.setStatus(EventListenerDeliveryStatus.FAILED);
        delivery.setLastError(error);
        delivery.setNextAttemptAt(null);
        delivery.setCompletedAt(Instant.now());
    }

    private String writePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (RuntimeException exception) {
            return "{\"eventType\":\"unknown\"}";
        }
    }

    static String sanitizePayload(String payload) {
        String redacted =
                payload.replaceAll(
                        "(?i)(\\\"[^\\\"]*(?:password|secret|token|authorization|credential)[^\\\"]*\\\"\\s*:\\s*\\\")[^\\\"]*(\\\")",
                        "$1[REDACTED]$2");
        return redacted.length() > 10000 ? redacted.substring(0, 10000) : redacted;
    }

    static boolean isAllowedEndpoint(String value) {
        return isAllowedEndpoint(value, false);
    }

    static boolean isAllowedEndpoint(String value, boolean allowHttp) {
        try {
            URI uri = URI.create(value);
            if (uri.getHost() == null
                    || uri.getUserInfo() != null
                    || uri.getRawQuery() != null
                    || !("https".equalsIgnoreCase(uri.getScheme())
                            || (allowHttp && "http".equalsIgnoreCase(uri.getScheme())))) {
                return false;
            }
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            if (Set.of("localhost", "metadata", "metadata.google.internal", "instance-data")
                    .contains(host)) {
                return false;
            }
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress()
                        || address.isLoopbackAddress()
                        || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress()
                        || address.isMulticastAddress()
                        || isMetadataAddress(address)) {
                    return false;
                }
            }
            return true;
        } catch (IllegalArgumentException | UnknownHostException _) {
            return false;
        }
    }

    private static boolean isMetadataAddress(InetAddress address) {
        return address.getHostAddress().equals("169.254.169.254")
                || address.getHostAddress().equals("100.100.100.200");
    }

    private static RestClient buildRestClient() {
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(requestFactory).build();
    }

    private static String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.length() > 1000 ? "Delivery failed" : message;
    }
}
