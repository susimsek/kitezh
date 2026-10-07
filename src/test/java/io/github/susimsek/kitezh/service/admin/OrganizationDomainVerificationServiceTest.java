package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import io.github.susimsek.kitezh.domain.OrganizationDomainVerificationStatus;
import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.SecurityUtils;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.mail.MailService;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrganizationDomainVerificationServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationDomainRepository domainRepository;
    @Mock private UserRepository userRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private MailService mailService;

    @Test
    void verifiesValidTokenAndConsumesHash() {
        OrganizationEntity organization = organization(8L);
        OrganizationDomainEntity domain = domain(3L, organization);
        domain.setVerificationTokenHash(hash("token"));
        domain.setVerificationExpiresAt(Instant.now().plusSeconds(300));
        when(domainRepository.findByVerificationTokenHash(hash("token")))
                .thenReturn(Optional.of(domain));

        var result = service().verify("token");

        assertThat(result.status()).isEqualTo(OrganizationDomainVerificationStatus.VERIFIED);
        assertThat(domain.getVerificationTokenHash()).isNull();
        assertThat(domain.getVerifiedAt()).isNotNull();
        verify(auditEventService)
                .record("organization.domain.verified", "organization", "8", "domain=acme.com");
    }

    @Test
    void rejectsInvalidAndExpiredTokens() {
        assertThatThrownBy(() -> service().verify(" ")).isInstanceOf(ApiException.class);
        when(domainRepository.findByVerificationTokenHash(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().verify("missing")).isInstanceOf(ApiException.class);

        OrganizationDomainEntity expired = domain(3L, organization(8L));
        expired.setVerificationTokenHash(hash("expired"));
        expired.setVerificationExpiresAt(Instant.now().minusSeconds(1));
        when(domainRepository.findByVerificationTokenHash(hash("expired")))
                .thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service().verify("expired")).isInstanceOf(ApiException.class);
        assertThat(expired.getVerificationStatus())
                .isEqualTo(OrganizationDomainVerificationStatus.EXPIRED);
    }

    @Test
    void startsVerificationWithAdministratorEmail() {
        OrganizationEntity organization = organization(8L);
        OrganizationDomainEntity domain = domain(3L, organization);
        UserEntity admin = new UserEntity();
        admin.setUsername("admin");
        admin.setEmail("admin@example.com");
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(domainRepository.findById(3L)).thenReturn(Optional.of(domain));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
            security.when(SecurityUtils::getCurrentUserLogin).thenReturn(Optional.of("admin"));

            var result = service().start(8L, 3L);

            assertThat(result.status()).isEqualTo(OrganizationDomainVerificationStatus.PENDING);
            assertThat(domain.getVerificationTokenHash()).isNotBlank();
            assertThat(domain.getVerificationExpiresAt()).isAfter(Instant.now());
            verify(mailService)
                    .sendOrganizationDomainVerification(
                            eq("admin@example.com"),
                            eq("acme.com"),
                            any(String.class),
                            eq(Locale.ENGLISH));
        }
    }

    @Test
    void rejectsMissingOrganizationDomainAndAdministratorEmail() {
        when(organizationRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().start(99L, 3L)).isInstanceOf(ApiException.class);

        OrganizationEntity organization = organization(8L);
        when(organizationRepository.findById(8L)).thenReturn(Optional.of(organization));
        when(domainRepository.findById(3L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().start(8L, 3L)).isInstanceOf(ApiException.class);

        OrganizationDomainEntity domain = domain(3L, organization);
        UserEntity admin = new UserEntity();
        admin.setUsername("admin");
        when(domainRepository.findById(3L)).thenReturn(Optional.of(domain));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));
        try (MockedStatic<SecurityUtils> security = mockStatic(SecurityUtils.class)) {
            security.when(SecurityUtils::getCurrentUserLogin).thenReturn(Optional.of("admin"));
            assertThatThrownBy(() -> service().start(8L, 3L)).isInstanceOf(ApiException.class);
        }
    }

    private OrganizationDomainVerificationService service() {
        return new OrganizationDomainVerificationService(
                organizationRepository,
                domainRepository,
                userRepository,
                auditEventService,
                mailService);
    }

    private static OrganizationEntity organization(Long id) {
        OrganizationEntity organization = new OrganizationEntity();
        organization.setId(id);
        organization.setAlias("acme");
        organization.setName("Acme");
        return organization;
    }

    private static OrganizationDomainEntity domain(Long id, OrganizationEntity organization) {
        OrganizationDomainEntity domain = new OrganizationDomainEntity();
        domain.setId(id);
        domain.setOrganization(organization);
        domain.setDomain("acme.com");
        return domain;
    }

    private static String hash(String token) {
        try {
            return java.util.HexFormat.of()
                    .formatHex(
                            java.security.MessageDigest.getInstance("SHA-256")
                                    .digest(
                                            token.getBytes(
                                                    java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
