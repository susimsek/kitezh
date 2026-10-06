package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.saml2.provider.service.authentication.Saml2AssertionAuthentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2ResponseAssertion;

class SamlAuthenticationSessionTest {

    @Test
    void persistsOnlyTheSamlSessionDataRequiredForLogout() throws Exception {
        Saml2ResponseAssertion assertion =
                Saml2ResponseAssertion.withResponseValue("")
                        .nameId("user1")
                        .sessionIndexes(new ArrayList<>(List.of("session-1")))
                        .attributes(new HashMap<>())
                        .build();
        Saml2AssertionAuthentication authentication =
                new Saml2AssertionAuthentication(
                        User.withUsername("saml-user")
                                .password("N/A")
                                .authorities(new SimpleGrantedAuthority("ROLE_USER"))
                                .build(),
                        assertion,
                        List.of(new SimpleGrantedAuthority("ROLE_USER")),
                        "saml-test");
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        mapper.writeSessionAttribute(authentication, output);

        Object restored =
                mapper.readSessionAttribute(new ByteArrayInputStream(output.toByteArray()));
        assertThat(restored).isInstanceOf(Saml2AssertionAuthentication.class);
        Saml2AssertionAuthentication restoredAuthentication =
                (Saml2AssertionAuthentication) restored;
        assertThat(restoredAuthentication.getRelyingPartyRegistrationId()).isEqualTo("saml-test");
        assertThat(restoredAuthentication.getCredentials().getResponseValue()).isEmpty();
        assertThat(restoredAuthentication.getCredentials().getNameId()).isEqualTo("user1");
        assertThat(restoredAuthentication.getCredentials().getSessionIndexes())
                .containsExactly("session-1");
    }
}
