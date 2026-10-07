package io.github.susimsek.kitezh;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryEntity;
import io.github.susimsek.kitezh.domain.EventListenerDeliveryStatus;
import io.github.susimsek.kitezh.domain.EventListenerEventType;
import io.github.susimsek.kitezh.repository.EventListenerDeliveryRepository;
import io.github.susimsek.kitezh.repository.EventListenerProviderRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class EventListenerEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private EventListenerProviderRepository providerRepository;
    @Autowired private EventListenerDeliveryRepository deliveryRepository;

    @Test
    void eventViewerCanReadProvidersAndDeliveriesButCannotMutateOrRetry() throws Exception {
        mockMvc.perform(get("/api/admin/event-listeners").with(eventViewer()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/event-listeners/deliveries").with(eventViewer()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/admin/event-listeners").with(eventViewer()))
                .andExpect(status().isForbidden());
        mockMvc.perform(
                        post("/api/admin/event-listeners/deliveries/missing/retry")
                                .with(eventViewer()))
                .andExpect(status().isForbidden());
    }

    @Test
    void eventManagerCanCreateUpdateReadAndDeleteProviderAndRetryDelivery() throws Exception {
        String providerId = null;
        String deliveryId = UUID.randomUUID().toString();
        try {
            mockMvc.perform(
                            post("/api/admin/event-listeners")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(requestBody("listener-one"))
                                    .with(eventManager()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("listener-one"));
            providerId =
                    providerRepository.findByNameIgnoreCase("listener-one").orElseThrow().getId();

            mockMvc.perform(get("/api/admin/event-listeners/{id}", providerId).with(eventViewer()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.endpointUrl").value("https://198.51.100.10/events"));
            mockMvc.perform(
                            put("/api/admin/event-listeners/{id}", providerId)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(requestBody("listener-updated"))
                                    .with(eventManager()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("listener-updated"));

            EventListenerDeliveryEntity delivery = new EventListenerDeliveryEntity();
            delivery.setId(deliveryId);
            delivery.setProviderId(providerId);
            delivery.setEventId(UUID.randomUUID().toString());
            delivery.setEventType(EventListenerEventType.ADMIN_EVENT);
            delivery.setPayload("{}");
            delivery.setStatus(EventListenerDeliveryStatus.FAILED);
            delivery.setCreatedAt(Instant.now());
            deliveryRepository.save(delivery);

            mockMvc.perform(
                            post("/api/admin/event-listeners/deliveries/{id}/retry", deliveryId)
                                    .with(eventManager()))
                    .andExpect(status().isNoContent());
            org.assertj.core.api.Assertions.assertThat(
                            deliveryRepository.findById(deliveryId).orElseThrow().getStatus())
                    .isEqualTo(EventListenerDeliveryStatus.PENDING);
        } finally {
            deliveryRepository.deleteById(deliveryId);
            if (providerId != null) {
                mockMvc.perform(
                                delete("/api/admin/event-listeners/{id}", providerId)
                                        .with(eventManager()))
                        .andExpect(status().isNoContent());
            }
        }
    }

    private static String requestBody(String name) {
        return "{\"name\":\""
                + name
                + "\",\"providerType\":\"WEBHOOK\",\"endpointUrl\":\"https://198.51.100.10/events\","
                + "\"enabled\":true,\"maxAttempts\":3,\"backoffSeconds\":30,"
                + "\"eventTypes\":[\"USER_EVENT\",\"ADMIN_EVENT\"]}";
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            eventViewer() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_EVENT_VIEWER"));
    }

    private static org.springframework.security.test.web.servlet.request
                    .SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor
            eventManager() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_EVENT_MANAGER"));
    }
}
