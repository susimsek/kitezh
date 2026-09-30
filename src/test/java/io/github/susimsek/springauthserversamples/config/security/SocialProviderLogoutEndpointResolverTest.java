package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.config.http.HttpServiceClientFactory;
import io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService.ProviderCredentials;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class SocialProviderLogoutEndpointResolverTest {

    @Test
    void discoversGenericOidcEndSessionEndpoint() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(
                        request ->
                                assertThat(request.getURI())
                                        .hasToString(
                                                "https://issuer.example/.well-known/openid-configuration"))
                .andRespond(
                        org.springframework.test.web.client.response.MockRestResponseCreators
                                .withSuccess(
                                        "{\"end_session_endpoint\":\"https://issuer.example/logout\"}",
                                        MediaType.APPLICATION_JSON));

        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.issuerUri()).thenReturn("https://issuer.example");
        when(provider.providerType()).thenReturn("oidc");

        assertThat(
                        new SocialProviderLogoutEndpointResolver(
                                        HttpServiceClientFactory.create(
                                                OidcDiscoveryClient.class, restClient))
                                .resolve(provider))
                .isEqualTo("https://issuer.example/logout");
        server.verify();
    }

    @Test
    void fallsBackToProviderLogoutEndpoints() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("github");

        assertThat(new SocialProviderLogoutEndpointResolver().resolve(provider))
                .isEqualTo("https://github.com/logout");
    }

    @Test
    void handlesNullInvalidAndAllBuiltInProviderFallbacks() {
        SocialProviderLogoutEndpointResolver resolver = new SocialProviderLogoutEndpointResolver();
        assertThat(resolver.resolve(null)).isNull();
        for (String provider : new String[] {"google", "microsoft", "linkedin"}) {
            ProviderCredentials credentials = mock(ProviderCredentials.class);
            when(credentials.providerType()).thenReturn(provider);
            when(credentials.issuerUri()).thenReturn(" ");
            assertThat(resolver.resolve(credentials)).isNotBlank();
        }
        ProviderCredentials unknown = mock(ProviderCredentials.class);
        when(unknown.providerType()).thenReturn("custom");
        assertThat(resolver.resolve(unknown)).isNull();
    }

    @Test
    void ignoresInvalidDiscoveryAndUsesFallback() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restClientBuilder).build();
        RestClient restClient = restClientBuilder.build();
        server.expect(
                        request ->
                                assertThat(request.getURI().getPath())
                                        .endsWith("/.well-known/openid-configuration"))
                .andRespond(
                        org.springframework.test.web.client.response.MockRestResponseCreators
                                .withSuccess(
                                        "{\"end_session_endpoint\":\"javascript:bad\"}",
                                        MediaType.APPLICATION_JSON));
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.issuerUri()).thenReturn("https://issuer.example/");
        when(provider.providerType()).thenReturn("google");
        assertThat(
                        new SocialProviderLogoutEndpointResolver(
                                        HttpServiceClientFactory.create(
                                                OidcDiscoveryClient.class, restClient))
                                .resolve(provider))
                .isEqualTo("https://accounts.google.com/Logout");
        server.verify();
    }
}
