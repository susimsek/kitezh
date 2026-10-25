package io.github.susimsek.kitezh.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AndroidAssetLinksControllerTest {

    @Test
    void publishesPasskeyCredentialRelationForTheConfiguredSigningCertificate() throws Exception {
        AndroidAssetLinksController controller = new AndroidAssetLinksController();
        ReflectionTestUtils.setField(
                controller,
                "certificateFingerprint",
                "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99");
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/.well-known/assetlinks.json"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$[0].relation[0]")
                                .value("delegate_permission/common.handle_all_urls"))
                .andExpect(
                        jsonPath("$[0].relation[1]")
                                .value("delegate_permission/common.get_login_creds"))
                .andExpect(
                        jsonPath("$[0].target.package_name")
                                .value("io.github.susimsek.kitezh.mobile"))
                .andExpect(jsonPath("$[0].target.sha256_cert_fingerprints[0]").isNotEmpty());
    }

    @Test
    void doesNotPublishAnAssociationWithoutAValidSigningCertificate() throws Exception {
        AndroidAssetLinksController controller = new AndroidAssetLinksController();
        ReflectionTestUtils.setField(controller, "certificateFingerprint", "");
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        mockMvc.perform(get("/.well-known/assetlinks.json")).andExpect(status().isNotFound());
    }
}
