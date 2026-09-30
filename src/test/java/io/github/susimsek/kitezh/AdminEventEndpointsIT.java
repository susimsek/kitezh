package io.github.susimsek.kitezh;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.springauthserversamples.domain.AdminEventEntity;
import io.github.susimsek.springauthserversamples.repository.AdminEventRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AdminEventEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private AdminEventRepository adminEventRepository;

    @Test
    void eventViewerCanReadEventHistoryAndDetails() throws Exception {
        String eventId = UUID.randomUUID().toString();
        AdminEventEntity event = new AdminEventEntity();
        event.setId(eventId);
        event.setActor("admin");
        event.setAction("client.updated");
        event.setTargetType("client");
        event.setTargetId("demo-client");
        event.setDetails("enabled=true");
        event.setOccurredAt(Instant.now());
        adminEventRepository.save(event);

        try {
            mockMvc.perform(
                            get("/api/admin/events")
                                    .with(
                                            jwt().authorities(
                                                            new SimpleGrantedAuthority(
                                                                    "ROLE_EVENT_VIEWER"))))
                    .andExpect(status().isOk());

            mockMvc.perform(
                            get("/api/admin/events/{id}", eventId)
                                    .with(
                                            jwt().authorities(
                                                            new SimpleGrantedAuthority(
                                                                    "ROLE_EVENT_VIEWER"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(eventId))
                    .andExpect(jsonPath("$.details").value("enabled=true"));

            mockMvc.perform(
                            get("/api/admin/events/{id}", "missing-event")
                                    .with(
                                            jwt().authorities(
                                                            new SimpleGrantedAuthority(
                                                                    "ROLE_EVENT_VIEWER"))))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.errorCode").value("resource_not_found"));
        } finally {
            adminEventRepository.deleteById(eventId);
        }
    }

    @Test
    void eventViewerCanReadButCannotManageEvents() throws Exception {
        mockMvc.perform(
                        get("/api/admin/events/config")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_EVENT_VIEWER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventsEnabled").value(true));

        mockMvc.perform(
                        delete("/api/admin/events")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_EVENT_VIEWER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void eventManagerCanUpdateSettingsAndClearEvents() throws Exception {
        mockMvc.perform(
                        put("/api/admin/events/config")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"eventsEnabled\":true,\"adminEventsEnabled\":true,"
                                                + "\"adminEventsDetailsEnabled\":true,"
                                                + "\"eventsExpirationDays\":0}")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_EVENT_MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventsExpirationDays").value(0));

        mockMvc.perform(
                        delete("/api/admin/events")
                                .with(
                                        jwt().authorities(
                                                        new SimpleGrantedAuthority(
                                                                "ROLE_EVENT_MANAGER"))))
                .andExpect(status().isNoContent());
    }
}
