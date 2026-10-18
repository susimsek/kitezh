package io.github.susimsek.kitezh.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AppleAppSiteAssociationControllerTest {

    @Test
    void servesOnlyRegisteredMobileRoutesForTheConfiguredAppleTeam() throws Exception {
        AppleAppSiteAssociationController controller = new AppleAppSiteAssociationController();
        ReflectionTestUtils.setField(controller, "iosTeamId", "ABCDE12345");
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/.well-known/apple-app-site-association"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.applinks.details[0].appIDs[0]")
                                .value("ABCDE12345.io.github.susimsek.kitezh.mobile"))
                .andExpect(
                        jsonPath("$.applinks.details[0].components[0]['/']").value("/verify-email"))
                .andExpect(jsonPath("$.applinks.details[0].components.length()").value(7))
                .andExpect(
                        jsonPath("$.webcredentials.apps[0]")
                                .value("ABCDE12345.io.github.susimsek.kitezh.mobile"));
    }

    @Test
    void doesNotPublishAnInvalidOrMissingAppleTeamAssociation() throws Exception {
        AppleAppSiteAssociationController controller = new AppleAppSiteAssociationController();
        ReflectionTestUtils.setField(controller, "iosTeamId", "");
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/.well-known/apple-app-site-association"))
                .andExpect(status().isNotFound());
    }
}
