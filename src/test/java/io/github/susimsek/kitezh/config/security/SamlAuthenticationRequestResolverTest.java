package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import java.lang.reflect.Method;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.opensaml.core.config.InitializationService;
import org.opensaml.core.xml.config.XMLObjectProviderRegistrySupport;
import org.opensaml.saml.saml2.core.AuthnRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.saml2.provider.service.authentication.AbstractSaml2AuthenticationRequest;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.security.saml2.provider.service.web.authentication.OpenSaml5AuthenticationRequestResolver;

class SamlAuthenticationRequestResolverTest {

    @Test
    void resolvesAndCustomizesForceAuthenticationAndLoginHint() throws Exception {
        InitializationService.initialize();
        final RelyingPartyRegistration registration = registration();
        final RelyingPartyRegistrationRepository registrations = id -> null;
        final SocialProviderRepository providers = mock(SocialProviderRepository.class);
        final SamlProviderConfigRepository configs = mock(SamlProviderConfigRepository.class);
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setProviderId(provider.getId());
        config.setForceAuthentication(true);
        config.setPassSubject(true);
        when(providers.findByAliasIgnoreCase("saml")).thenReturn(Optional.of(provider));
        when(configs.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        SamlAuthenticationRequestResolver resolver =
                new SamlAuthenticationRequestResolver(configs, providers, registrations);
        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/saml2/authenticate/saml");
        request.setParameter("login_hint", "ada@example.test");

        AbstractSaml2AuthenticationRequest resolved = resolver.resolve(request);
        assertThat(resolved).isNull();

        AuthnRequest authnRequest = authnRequest();
        OpenSaml5AuthenticationRequestResolver.AuthnRequestContext context =
                new OpenSaml5AuthenticationRequestResolver.AuthnRequestContext(
                        request, registration, authnRequest);
        invokeCustomize(resolver, context);

        assertThat(authnRequest.isForceAuthn()).isTrue();
        assertThat(authnRequest.getSubject().getNameID().getValue()).isEqualTo("ada@example.test");
    }

    @Test
    void doesNotForwardSubjectWhenItIsDisabledOrMissing() throws Exception {
        InitializationService.initialize();
        final RelyingPartyRegistration registration = registration();
        final SocialProviderRepository providers = mock(SocialProviderRepository.class);
        final SamlProviderConfigRepository configs = mock(SamlProviderConfigRepository.class);
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setProviderId(provider.getId());
        config.setPassSubject(false);
        when(providers.findByAliasIgnoreCase("saml")).thenReturn(Optional.of(provider));
        when(configs.findByProviderId(provider.getId())).thenReturn(Optional.of(config));
        SamlAuthenticationRequestResolver resolver =
                new SamlAuthenticationRequestResolver(configs, providers, id -> registration);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("login_hint", "ada@example.test");
        AuthnRequest authnRequest = authnRequest();
        invokeCustomize(
                resolver,
                new OpenSaml5AuthenticationRequestResolver.AuthnRequestContext(
                        request, registration, authnRequest));
        assertThat(authnRequest.getSubject()).isNull();

        config.setPassSubject(true);
        request.removeParameter("login_hint");
        invokeCustomize(
                resolver,
                new OpenSaml5AuthenticationRequestResolver.AuthnRequestContext(
                        request, registration, authnRequest));
        assertThat(authnRequest.getSubject()).isNull();
    }

    private static void invokeCustomize(
            SamlAuthenticationRequestResolver resolver,
            OpenSaml5AuthenticationRequestResolver.AuthnRequestContext context)
            throws Exception {
        Method method =
                SamlAuthenticationRequestResolver.class.getDeclaredMethod(
                        "customize",
                        OpenSaml5AuthenticationRequestResolver.AuthnRequestContext.class);
        method.setAccessible(true);
        method.invoke(resolver, context);
    }

    private static AuthnRequest authnRequest() {
        return (AuthnRequest)
                XMLObjectProviderRegistrySupport.getBuilderFactory()
                        .ensureBuilder(AuthnRequest.DEFAULT_ELEMENT_NAME)
                        .buildObject(AuthnRequest.DEFAULT_ELEMENT_NAME);
    }

    private static RelyingPartyRegistration registration() {
        return RelyingPartyRegistration.withRegistrationId("saml")
                .authnRequestsSigned(false)
                .assertingPartyMetadata(
                        party ->
                                party.entityId("https://idp.example.test/entity")
                                        .singleSignOnServiceLocation(
                                                "https://idp.example.test/sso"))
                .build();
    }

    private static SocialProviderEntity provider() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setAlias("saml");
        provider.setRegistrationId("saml");
        provider.setProviderType("saml");
        provider.setEnabled(true);
        return provider;
    }
}
