package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.config.http.HttpServiceClientFactory;
import io.github.susimsek.kitezh.service.client.RegistrationCaptchaClient;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RegistrationCaptchaServiceTest {

    @Test
    void disabledCaptchaDoesNotRequireAConversationWithGoogle() {
        RegistrationCaptchaService service =
                service(
                        configuration(
                                false, "disabled", "", "", "", "", "register", false, 0.7, false));

        service.verifyOrThrow(null, org.mockito.Mockito.mock(HttpServletRequest.class));

        assertThat(service.publicSettings().enabled()).isFalse();
    }

    @Test
    void verifiesStandardV2ResponseAndSendsRemoteAddress() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(
                        withSuccess(
                                "{\"success\":true}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        new RegistrationCaptchaConfiguration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                false,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClient));
        HttpServletRequest request = org.mockito.Mockito.mock(HttpServletRequest.class);
        org.mockito.Mockito.when(request.getRemoteAddr()).thenReturn("192.0.2.10");

        service.verifyOrThrow("token", request);

        server.verify();
    }

    @Test
    void rejectsAnInvalidEnterpriseActionOrScore() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(
                        requestTo(
                                org.hamcrest.Matchers.containsString(
                                        "recaptchaenterprise.googleapis.com")))
                .andExpect(method(HttpMethod.POST))
                .andRespond(
                        withSuccess(
                                "{\"tokenProperties\":{\"valid\":true,\"action\":\"login\"},"
                                        + "\"riskAnalysis\":{\"score\":0.99},"
                                        + "\"event\":{\"expectedAction\":\"register\"}}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        new RegistrationCaptchaConfiguration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "api-key",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClient));

        assertThatThrownBy(
                        () ->
                                service.verifyOrThrow(
                                        "token",
                                        org.mockito.Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        server.verify();
    }

    @Test
    void hidesAnIncompleteConfigurationFromThePublicPageAndFailsClosed() {
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "",
                                "register",
                                true,
                                0.7,
                                false));

        assertThat(service.publicSettings().enabled()).isFalse();
        assertThatThrownBy(
                        () ->
                                service.verifyOrThrow(
                                        "token",
                                        org.mockito.Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
    }

    @Test
    void verifiesSuccessfulStandardV3ResponseWithoutRemoteAddress() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(requestTo("https://www.recaptcha.net/recaptcha/api/siteverify"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(
                        withSuccess(
                                "{\"success\":true,\"score\":0.9,\"action\":\"register\"}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                true,
                                0.7,
                                true),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClient));
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        Mockito.when(request.getRemoteAddr()).thenReturn(" ");

        service.verifyOrThrow("token", request);

        assertThat(service.publicSettings().enabled()).isTrue();
        assertThat(service.publicSettings().useRecaptchaNet()).isTrue();
        server.verify();
    }

    @Test
    void rejectsFailedStandardResponseAndCatchesRemoteErrors() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(
                        withSuccess(
                                "{\"success\":true,\"score\":0.2,\"action\":\"other\"}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClient));

        assertThatThrownBy(
                        () ->
                                service.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        server.verify();

        RestClient.Builder errorBuilder = RestClient.builder();
        MockRestServiceServer errorServer = MockRestServiceServer.bindTo(errorBuilder).build();
        errorServer
                .expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(withServerError());
        RegistrationCaptchaService errorService =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                false,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, errorBuilder.build()));

        assertThatThrownBy(
                        () ->
                                errorService.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        errorServer.verify();
    }

    @Test
    void rejectsMissingTokensAndNullStandardResponses() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                false,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClientBuilder.build()));
        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);

        assertThatThrownBy(() -> service.verifyOrThrow(null, request))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        assertThatThrownBy(() -> service.verifyOrThrow(" ", request))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");

        server.expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(
                        withSuccess("null", org.springframework.http.MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.verifyOrThrow("token", request))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        server.verify();
    }

    @Test
    void usesDefaultActionAndRejectsIncompleteEnterpriseResponses() {
        RestClient.Builder standardBuilder = RestClient.builder();
        MockRestServiceServer standardServer =
                MockRestServiceServer.bindTo(standardBuilder).build();
        standardServer
                .expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(
                        withSuccess(
                                "{\"success\":true,\"score\":0.9,\"action\":\"register\"}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService standardService =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                " ",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, standardBuilder.build()));
        assertThat(standardService.publicSettings().action()).isEqualTo("register");
        standardService.verifyOrThrow("token", Mockito.mock(HttpServletRequest.class));
        standardServer.verify();

        RestClient.Builder enterpriseBuilder = RestClient.builder();
        MockRestServiceServer enterpriseServer =
                MockRestServiceServer.bindTo(enterpriseBuilder).build();
        enterpriseServer
                .expect(
                        requestTo(
                                org.hamcrest.Matchers.containsString(
                                        "recaptchaenterprise.googleapis.com")))
                .andRespond(
                        withSuccess(
                                "{\"tokenProperties\":null,\"riskAnalysis\":null,\"event\":null}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService enterpriseService =
                service(
                        configuration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "api-key",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, enterpriseBuilder.build()));

        assertThatThrownBy(
                        () ->
                                enterpriseService.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        enterpriseServer.verify();
    }

    @Test
    void coversCaptchaResponseVariantsAndConfigurationBoundaries() {
        RestClient.Builder standardBuilder = RestClient.builder();
        MockRestServiceServer standardServer =
                MockRestServiceServer.bindTo(standardBuilder).build();
        standardServer
                .expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(
                        withSuccess(
                                "{\"success\":false}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService standardService =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                false,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, standardBuilder.build()));
        assertThatThrownBy(
                        () ->
                                standardService.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        standardServer.verify();

        RestClient.Builder v3Builder = RestClient.builder();
        MockRestServiceServer v3Server = MockRestServiceServer.bindTo(v3Builder).build();
        v3Server.expect(requestTo("https://www.google.com/recaptcha/api/siteverify"))
                .andRespond(
                        withSuccess(
                                "{\"success\":true,\"action\":\"register\"}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService v3Service =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, v3Builder.build()));
        assertThatThrownBy(
                        () ->
                                v3Service.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        v3Server.verify();

        assertEnterpriseFailure(
                "{\"tokenProperties\":null,\"riskAnalysis\":{\"score\":0.9},"
                        + "\"event\":{\"expectedAction\":\"register\"}}");
        assertEnterpriseFailure(
                "{\"tokenProperties\":{\"valid\":true,\"action\":\"register\"},"
                        + "\"riskAnalysis\":null,\"event\":{\"expectedAction\":\"register\"}}");
        assertEnterpriseFailure(
                "{\"tokenProperties\":{\"valid\":true,\"action\":\"register\"},"
                        + "\"riskAnalysis\":{\"score\":0.9},\"event\":null}");
        assertEnterpriseFailure(
                "{\"tokenProperties\":{\"valid\":false,\"action\":\"register\"},"
                        + "\"riskAnalysis\":{\"score\":0.9},"
                        + "\"event\":{\"expectedAction\":\"register\"}}");
        assertEnterpriseFailure(
                "{\"tokenProperties\":{\"valid\":true,\"action\":\"other\"},"
                        + "\"riskAnalysis\":{\"score\":0.9},"
                        + "\"event\":{\"expectedAction\":\"register\"}}");
        assertEnterpriseFailure(
                "{\"tokenProperties\":{\"valid\":true,\"action\":\"register\"},"
                        + "\"riskAnalysis\":{\"score\":0.1},"
                        + "\"event\":{\"expectedAction\":\"register\"}}");

        assertThat(
                        service(
                                        configuration(
                                                true,
                                                "recaptcha",
                                                "site-key",
                                                "secret",
                                                "",
                                                "",
                                                "register",
                                                true,
                                                0.0,
                                                false))
                                .publicSettings()
                                .enabled())
                .isTrue();
        assertThat(
                        service(
                                        configuration(
                                                true,
                                                "recaptcha",
                                                "site-key",
                                                "secret",
                                                "",
                                                "",
                                                "register",
                                                true,
                                                1.0,
                                                false))
                                .publicSettings()
                                .enabled())
                .isTrue();
        assertThat(
                        service(
                                        configuration(
                                                false,
                                                "recaptcha",
                                                "site-key",
                                                "secret",
                                                "",
                                                "",
                                                "register",
                                                false,
                                                0.7,
                                                false))
                                .publicSettings()
                                .enabled())
                .isFalse();
        assertThat(
                        service(
                                        configuration(
                                                true,
                                                "recaptcha",
                                                "",
                                                "secret",
                                                "",
                                                "",
                                                "register",
                                                false,
                                                0.7,
                                                false))
                                .publicSettings()
                                .enabled())
                .isFalse();
        assertThat(
                        service(
                                        configuration(
                                                true,
                                                "recaptcha",
                                                "site-key",
                                                "",
                                                "",
                                                "",
                                                "register",
                                                false,
                                                0.7,
                                                false))
                                .publicSettings()
                                .enabled())
                .isFalse();
    }

    @Test
    void verifiesSuccessfulEnterpriseResponse() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(
                        requestTo(
                                org.hamcrest.Matchers.containsString(
                                        "recaptchaenterprise.googleapis.com")))
                .andRespond(
                        withSuccess(
                                "{\"tokenProperties\":{\"valid\":true,\"action\":\"register\"},"
                                        + "\"riskAnalysis\":{\"score\":0.95},"
                                        + "\"event\":{\"expectedAction\":\"register\"}}",
                                org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "api-key",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, restClient));

        service.verifyOrThrow("token", Mockito.mock(HttpServletRequest.class));

        server.verify();
    }

    @Test
    void rejectsInvalidCaptchaConfigurationBeforeCallingRemoteService() {
        RegistrationCaptchaService invalidRecaptcha =
                service(
                        configuration(
                                true,
                                "recaptcha",
                                "site-key",
                                "secret",
                                "",
                                "",
                                "bad action",
                                true,
                                1.2,
                                false));
        RegistrationCaptchaService invalidEnterprise =
                service(
                        configuration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "api-key",
                                "bad action",
                                false,
                                -0.1,
                                false));

        assertThat(invalidRecaptcha.publicSettings().enabled()).isFalse();
        assertThat(invalidEnterprise.publicSettings().enabled()).isFalse();
        assertThatThrownBy(
                        () ->
                                invalidRecaptcha.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        assertThatThrownBy(
                        () ->
                                invalidEnterprise.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
    }

    @Test
    void usesDynamicSettingsForRegistrationAndLoginEndpoints() {
        RegistrationCaptchaSettingsService settingsService =
                Mockito.mock(RegistrationCaptchaSettingsService.class);
        RegistrationCaptchaConfiguration publicConfiguration =
                configuration(
                        true,
                        "recaptcha",
                        "site-key",
                        "configured",
                        "",
                        "",
                        "register",
                        false,
                        0.7,
                        false);
        RegistrationCaptchaConfiguration loginConfiguration =
                configuration(false, "disabled", "", "", "", "", "login", false, 0.7, false);
        Mockito.when(settingsService.publicConfiguration()).thenReturn(publicConfiguration);
        Mockito.when(settingsService.loginPublicConfiguration()).thenReturn(loginConfiguration);
        Mockito.when(settingsService.verificationConfiguration()).thenReturn(loginConfiguration);
        Mockito.when(settingsService.loginVerificationConfiguration())
                .thenReturn(loginConfiguration);
        RegistrationCaptchaService service =
                new RegistrationCaptchaService(
                        settingsService, Mockito.mock(RegistrationCaptchaClient.class));

        assertThat(service.publicSettings().enabled()).isTrue();
        assertThat(service.publicLoginSettings().enabled()).isFalse();
        service.verifyOrThrow(null, Mockito.mock(HttpServletRequest.class));
        service.verifyLoginOrThrow(null, Mockito.mock(HttpServletRequest.class));
        Mockito.verify(settingsService).publicConfiguration();
        Mockito.verify(settingsService).loginPublicConfiguration();
        Mockito.verify(settingsService).verificationConfiguration();
        Mockito.verify(settingsService).loginVerificationConfiguration();
    }

    private static void assertEnterpriseFailure(String response) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(
                        requestTo(
                                org.hamcrest.Matchers.containsString(
                                        "recaptchaenterprise.googleapis.com")))
                .andRespond(
                        withSuccess(response, org.springframework.http.MediaType.APPLICATION_JSON));
        RegistrationCaptchaService service =
                service(
                        configuration(
                                true,
                                "enterprise",
                                "site-key",
                                "",
                                "project",
                                "api-key",
                                "register",
                                true,
                                0.7,
                                false),
                        HttpServiceClientFactory.create(
                                RegistrationCaptchaClient.class, builder.build()));

        assertThatThrownBy(
                        () ->
                                service.verifyOrThrow(
                                        "token", Mockito.mock(HttpServletRequest.class)))
                .hasFieldOrPropertyWithValue("errorCodeValue", "captcha_failed");
        server.verify();
    }

    private static RegistrationCaptchaService service(
            RegistrationCaptchaConfiguration configuration,
            RegistrationCaptchaClient captchaClient) {
        RegistrationCaptchaSettingsService settingsService =
                Mockito.mock(RegistrationCaptchaSettingsService.class);
        Mockito.when(settingsService.publicConfiguration()).thenReturn(configuration);
        Mockito.when(settingsService.verificationConfiguration()).thenReturn(configuration);
        Mockito.when(settingsService.loginPublicConfiguration()).thenReturn(configuration);
        Mockito.when(settingsService.loginVerificationConfiguration()).thenReturn(configuration);
        return new RegistrationCaptchaService(settingsService, captchaClient);
    }

    private static RegistrationCaptchaService service(
            RegistrationCaptchaConfiguration configuration) {
        return service(
                configuration,
                HttpServiceClientFactory.create(
                        RegistrationCaptchaClient.class, RestClient.builder().build()));
    }

    private static RegistrationCaptchaConfiguration configuration(
            boolean enabled,
            String provider,
            String siteKey,
            String secretKey,
            String projectId,
            String apiKey,
            String action,
            boolean recaptchaV3,
            double scoreThreshold,
            boolean useRecaptchaNet) {
        return new RegistrationCaptchaConfiguration(
                enabled,
                provider,
                siteKey,
                secretKey,
                projectId,
                apiKey,
                action,
                recaptchaV3,
                scoreThreshold,
                useRecaptchaNet);
    }
}
