package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.http.HttpServiceClientFactory;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService.ProviderCredentials;
import io.github.susimsek.kitezh.service.client.OidcDiscoveryClient;
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
    void fallsBackOnlyToProviderLogoutEndpointsWithSupportedRelyingPartyLogout() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("github");

        assertThat(new SocialProviderLogoutEndpointResolver().resolve(provider)).isNull();
    }

    @Test
    void doesNotUseLinkedInGlobalLogoutPage() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("linkedin");

        assertThat(new SocialProviderLogoutEndpointResolver().resolve(provider)).isNull();
    }

    @Test
    void handlesNullInvalidAndAllBuiltInProviderFallbacks() {
        SocialProviderLogoutEndpointResolver resolver = new SocialProviderLogoutEndpointResolver();
        assertThat(resolver.resolve(null)).isNull();
        ProviderCredentials credentials = mock(ProviderCredentials.class);
        when(credentials.providerType()).thenReturn("microsoft");
        when(credentials.issuerUri()).thenReturn(" ");
        assertThat(resolver.resolve(credentials)).isNotBlank();
        ProviderCredentials unknown = mock(ProviderCredentials.class);
        when(unknown.providerType()).thenReturn("custom");
        assertThat(resolver.resolve(unknown)).isNull();
    }

    @Test
    void ignoresInvalidDiscoveryWithoutUsingGoogleGlobalLogout() {
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
                .isNull();
        server.verify();
    }

    @Test
    void googleWithoutEndSessionMetadataUsesLocalLogout() {
        ProviderCredentials provider = new ProviderCredentials("google", "test-id", "test-secret");
        assertThat(new SocialProviderLogoutEndpointResolver().resolve(provider)).isNull();
    }

    @Test
    void googleDiscoveryWithoutEndSessionEndpointUsesLocalLogout() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("google");
        when(provider.issuerUri()).thenReturn("https://accounts.google.com");
        OidcDiscoveryClient discovery = mock(OidcDiscoveryClient.class);
        when(discovery.discover(
                        java.net.URI.create(
                                "https://accounts.google.com/.well-known/openid-configuration")))
                .thenReturn(java.util.Map.of("issuer", "https://accounts.google.com"));

        assertThat(new SocialProviderLogoutEndpointResolver(discovery).resolve(provider)).isNull();
    }

    @Test
    void cachesDiscoveredLogoutEndpointForRepeatedResolution() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("oidc");
        when(provider.issuerUri()).thenReturn("https://issuer.example");
        OidcDiscoveryClient discovery = mock(OidcDiscoveryClient.class);
        when(discovery.discover(
                        java.net.URI.create(
                                "https://issuer.example/.well-known/openid-configuration")))
                .thenReturn(
                        java.util.Map.of("end_session_endpoint", "https://issuer.example/logout"));
        var resolver = new SocialProviderLogoutEndpointResolver(discovery);

        assertThat(resolver.resolve(provider)).isEqualTo("https://issuer.example/logout");
        assertThat(resolver.resolve(provider)).isEqualTo("https://issuer.example/logout");

        verify(discovery)
                .discover(
                        java.net.URI.create(
                                "https://issuer.example/.well-known/openid-configuration"));
    }

    @Test
    void skipsNonHttpIssuerDiscoveryAndUsesSupportedFallback() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("microsoft");
        when(provider.issuerUri()).thenReturn("ftp://issuer.example");
        OidcDiscoveryClient discovery = mock(OidcDiscoveryClient.class);

        assertThat(new SocialProviderLogoutEndpointResolver(discovery).resolve(provider))
                .isEqualTo("https://login.microsoftonline.com/common/oauth2/v2.0/logout");
        verify(discovery, never()).discover(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void toleratesMissingDiscoveryMetadataAndUsesBuiltInFallback() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("microsoft");
        when(provider.issuerUri()).thenReturn("https://issuer.example");
        OidcDiscoveryClient discovery = mock(OidcDiscoveryClient.class);
        when(discovery.discover(
                        java.net.URI.create(
                                "https://issuer.example/.well-known/openid-configuration")))
                .thenReturn(null);

        assertThat(new SocialProviderLogoutEndpointResolver(discovery).resolve(provider))
                .isEqualTo("https://login.microsoftonline.com/common/oauth2/v2.0/logout");
    }

    @Test
    void defaultDiscoveryClientReturnsNoMetadataAndKeepsProviderFallback() {
        ProviderCredentials provider = mock(ProviderCredentials.class);
        when(provider.providerType()).thenReturn("microsoft");
        when(provider.issuerUri()).thenReturn("https://issuer.example");

        assertThat(new SocialProviderLogoutEndpointResolver().resolve(provider))
                .isEqualTo("https://login.microsoftonline.com/common/oauth2/v2.0/logout");
    }
}
