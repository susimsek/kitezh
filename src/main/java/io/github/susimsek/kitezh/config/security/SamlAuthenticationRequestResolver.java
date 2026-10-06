package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import org.opensaml.core.config.ConfigurationService;
import org.opensaml.core.xml.XMLObjectBuilderFactory;
import org.opensaml.core.xml.config.XMLObjectProviderRegistry;
import org.opensaml.saml.saml2.core.NameID;
import org.opensaml.saml.saml2.core.Subject;
import org.springframework.security.saml2.provider.service.authentication.AbstractSaml2AuthenticationRequest;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.security.saml2.provider.service.web.authentication.OpenSaml5AuthenticationRequestResolver;
import org.springframework.security.saml2.provider.service.web.authentication.Saml2AuthenticationRequestResolver;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Applies provider-specific Keycloak-style AuthnRequest options. */
@Component
public final class SamlAuthenticationRequestResolver implements Saml2AuthenticationRequestResolver {

    private final SamlProviderConfigRepository configRepository;
    private final SocialProviderRepository providerRepository;
    private final OpenSaml5AuthenticationRequestResolver delegate;

    public SamlAuthenticationRequestResolver(
            SamlProviderConfigRepository configRepository,
            SocialProviderRepository providerRepository,
            RelyingPartyRegistrationRepository registrationRepository) {
        this.configRepository = configRepository;
        this.providerRepository = providerRepository;
        this.delegate = new OpenSaml5AuthenticationRequestResolver(registrationRepository);
        this.delegate.setAuthnRequestCustomizer(this::customize);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T extends AbstractSaml2AuthenticationRequest> T resolve(
            jakarta.servlet.http.HttpServletRequest request) {
        return (T) delegate.resolve(request);
    }

    private void customize(OpenSaml5AuthenticationRequestResolver.AuthnRequestContext context) {
        providerRepository
                .findByAliasIgnoreCase(context.getRelyingPartyRegistration().getRegistrationId())
                .or(
                        () ->
                                providerRepository.findByRegistrationId(
                                        context.getRelyingPartyRegistration().getRegistrationId()))
                .flatMap(provider -> configRepository.findByProviderId(provider.getId()))
                .ifPresent(config -> customize(context, config));
    }

    private static void customize(
            OpenSaml5AuthenticationRequestResolver.AuthnRequestContext context,
            SamlProviderConfigEntity config) {
        context.getAuthnRequest().setForceAuthn(config.isForceAuthentication());
        if (!config.isPassSubject()) {
            return;
        }
        String loginHint = context.getRequest().getParameter("login_hint");
        if (!StringUtils.hasText(loginHint)) {
            return;
        }
        XMLObjectBuilderFactory factory =
                ConfigurationService.get(XMLObjectProviderRegistry.class).getBuilderFactory();
        NameID nameId =
                (NameID)
                        factory.ensureBuilder(NameID.DEFAULT_ELEMENT_NAME)
                                .buildObject(NameID.DEFAULT_ELEMENT_NAME);
        nameId.setValue(loginHint);
        Subject subject =
                (Subject)
                        factory.ensureBuilder(Subject.DEFAULT_ELEMENT_NAME)
                                .buildObject(Subject.DEFAULT_ELEMENT_NAME);
        subject.setNameID(nameId);
        context.getAuthnRequest().setSubject(subject);
    }
}
