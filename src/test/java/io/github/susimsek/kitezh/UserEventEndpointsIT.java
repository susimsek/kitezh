package io.github.susimsek.springauthserversamples;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.springauthserversamples.domain.UserEventEntity;
import io.github.susimsek.springauthserversamples.domain.UserEventType;
import io.github.susimsek.springauthserversamples.repository.UserEventRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class UserEventEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserEventRepository userEventRepository;

    @Test
    void eventViewerCanReadUserEventHistoryAndSettingsButCannotClear() throws Exception {
        String eventId = UUID.randomUUID().toString();
        userEventRepository.save(event(eventId));

        try {
            mockMvc.perform(get("/api/admin/user-events").with(eventViewer()))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/admin/user-events/{id}", eventId).with(eventViewer()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("user"));
            mockMvc.perform(get("/api/admin/users/{id}/user-events", 2).with(eventViewer()))
                    .andExpect(status().isOk());
            mockMvc.perform(get("/api/admin/user-events/config").with(eventViewer()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.eventTypes").isArray());
            mockMvc.perform(delete("/api/admin/user-events").with(eventViewer()))
                    .andExpect(status().isForbidden());
        } finally {
            userEventRepository.deleteById(eventId);
        }
    }

    @Test
    void eventManagerCanUpdateUserEventSettingsAndClearHistory() throws Exception {
        try {
            mockMvc.perform(
                            put("/api/admin/user-events/config")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"eventsEnabled\":true,\"eventTypes\":[\"LOGIN_SUCCESS\"],"
                                                + "\"eventsExpirationDays\":30}")
                                    .with(eventManager()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.eventTypes[0]").value("LOGIN_SUCCESS"));
            mockMvc.perform(delete("/api/admin/user-events").with(eventManager()))
                    .andExpect(status().isNoContent());
        } finally {
            mockMvc.perform(
                            put("/api/admin/user-events/config")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            "{\"eventsEnabled\":true,\"eventTypes\":[\"LOGIN_SUCCESS\","
                                                + "\"LOGIN_FAILURE\"],\"eventsExpirationDays\":0}")
                                    .with(eventManager()))
                    .andExpect(status().isOk());
        }
    }

    private static UserEventEntity event(String id) {
        UserEventEntity event = new UserEventEntity();
        event.setId(id);
        event.setUserId(2L);
        event.setUsername("user");
        event.setType(UserEventType.LOGIN_SUCCESS);
        event.setIpAddress("192.0.2.10");
        event.setOccurredAt(Instant.now());
        return event;
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
