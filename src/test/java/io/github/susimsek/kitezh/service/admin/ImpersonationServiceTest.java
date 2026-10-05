package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.ImpersonationTicketEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminImpersonationDTO;
import io.github.susimsek.kitezh.mapper.AdminImpersonationMapper;
import io.github.susimsek.kitezh.mapper.AdminImpersonationTicketMapper;
import io.github.susimsek.kitezh.repository.ImpersonationTicketRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class ImpersonationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserDetailsService userDetailsService;
    @Mock private ImpersonationTicketRepository ticketRepository;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private AdminImpersonationMapper impersonationMapper;
    @Mock private AdminImpersonationTicketMapper ticketMapper;

    @Test
    void issuesSingleUseTicketForNonAdminUser() {
        UserEntity target = user(7L, "alice");
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(User.withUsername("alice").password("password").roles("USER").build());
        when(ticketMapper.toEntity(
                        anyString(),
                        anyString(),
                        any(UserEntity.class),
                        any(Instant.class),
                        any(Instant.class)))
                .thenAnswer(
                        invocation -> {
                            ImpersonationTicketEntity ticket = new ImpersonationTicketEntity();
                            ticket.setTicketHash(invocation.getArgument(0));
                            ticket.setActorUsername(invocation.getArgument(1));
                            ticket.setTargetUser(invocation.getArgument(2));
                            ticket.setIssuedAt(invocation.getArgument(3));
                            ticket.setExpiresAt(invocation.getArgument(4));
                            return ticket;
                        });
        when(impersonationMapper.toDTO(anyString(), anyString(), anyString()))
                .thenAnswer(
                        invocation ->
                                new AdminImpersonationDTO(
                                        invocation.getArgument(0),
                                        invocation.getArgument(1),
                                        invocation.getArgument(2)));

        var result = service().issue(7L, authentication("operator", "ROLE_USER_IMPERSONATOR"));

        assertThat(result.url()).isEqualTo("/impersonation/accept");
        assertThat(result.username()).isEqualTo("alice");
        assertThat(result.ticket()).isNotBlank();
        verify(ticketRepository).save(any(ImpersonationTicketEntity.class));
        verify(auditEventService)
                .record(
                        "user.impersonation.started",
                        "user",
                        "7",
                        "actor=operator;targetUsername=alice;result=success");
    }

    @Test
    void rejectsAdministratorTargetEvenWhenRoleComesFromEffectiveAuthorities() {
        UserEntity target = user(7L, "alice");
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(
                        User.withUsername("alice")
                                .password("password")
                                .authorities("ROLE_ADMIN")
                                .build());

        assertThatThrownBy(() -> service().issue(7L, authentication("admin", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Administrators cannot be impersonated");
    }

    @Test
    void rejectsSelfImpersonation() {
        UserEntity target = user(7L, "admin");
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service().issue(7L, authentication("admin", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cannot impersonate yourself");
    }

    @Test
    void rejectsDisabledTarget() {
        UserEntity target = user(7L, "alice");
        target.setEnabled(false);
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service().issue(7L, authentication("admin", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Disabled users cannot be impersonated");
    }

    @Test
    void rejectsMissingTarget() {
        when(userRepository.findById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().issue(7L, authentication("admin", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void allowsDedicatedImpersonatorAuthority() {
        UserEntity target = user(7L, "alice");
        when(userRepository.findById(7L)).thenReturn(Optional.of(target));
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(User.withUsername("alice").password("password").roles("USER").build());
        when(ticketMapper.toEntity(
                        anyString(),
                        anyString(),
                        any(UserEntity.class),
                        any(Instant.class),
                        any(Instant.class)))
                .thenReturn(new ImpersonationTicketEntity());
        when(impersonationMapper.toDTO(anyString(), anyString(), anyString()))
                .thenReturn(new AdminImpersonationDTO("/impersonation/accept", "alice", "ticket"));

        assertThat(service().issue(7L, authentication("operator", "ROLE_USER_IMPERSONATOR")))
                .isNotNull();
    }

    @Test
    void rejectsNullActor() {
        assertThatThrownBy(() -> service().issue(7L, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("impersonation permission");
    }

    @Test
    void consumesValidTicketAndMarksItUsed() {
        ImpersonationTicketEntity ticket = ticket("operator", Instant.now().plusSeconds(30));
        when(ticketRepository.findByTicketHash(anyString())).thenReturn(Optional.of(ticket));

        UserEntity result =
                service().consume("raw-ticket", authentication("operator", "ROLE_ADMIN"));

        assertThat(result).isSameAs(ticket.getTargetUser());
        assertThat(ticket.getConsumedAt()).isNotNull();
    }

    @Test
    void rejectsMissingTicketValue() {
        assertThatThrownBy(() -> service().consume("  ", authentication("operator", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is required");
    }

    @Test
    void rejectsUnknownTicket() {
        when(ticketRepository.findByTicketHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service()
                                        .consume(
                                                "raw-ticket",
                                                authentication("operator", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is invalid");
    }

    @Test
    void rejectsTicketOwnedByAnotherActor() {
        ImpersonationTicketEntity ticket =
                ticket("another-operator", Instant.now().plusSeconds(30));
        when(ticketRepository.findByTicketHash(anyString())).thenReturn(Optional.of(ticket));

        assertThatThrownBy(
                        () ->
                                service()
                                        .consume(
                                                "raw-ticket",
                                                authentication("operator", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is invalid");
    }

    @Test
    void rejectsAlreadyConsumedTicket() {
        ImpersonationTicketEntity ticket = ticket("operator", Instant.now().plusSeconds(30));
        ticket.setConsumedAt(Instant.now().minusSeconds(1));
        when(ticketRepository.findByTicketHash(anyString())).thenReturn(Optional.of(ticket));

        assertThatThrownBy(
                        () ->
                                service()
                                        .consume(
                                                "raw-ticket",
                                                authentication("operator", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is invalid");
    }

    @Test
    void rejectsExpiredTicket() {
        ImpersonationTicketEntity ticket = ticket("operator", Instant.now().minusSeconds(1));
        when(ticketRepository.findByTicketHash(anyString())).thenReturn(Optional.of(ticket));

        assertThatThrownBy(
                        () ->
                                service()
                                        .consume(
                                                "raw-ticket",
                                                authentication("operator", "ROLE_ADMIN")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("ticket is invalid");
    }

    @Test
    void rejectsNullActorWhenConsuming() {
        assertThatThrownBy(() -> service().consume("raw-ticket", null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("impersonation permission");
    }

    @Test
    void rejectsActorWithoutImpersonationPermission() {
        assertThatThrownBy(() -> service().issue(7L, authentication("viewer", "ROLE_USER_VIEWER")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("impersonation permission");
    }

    private static Authentication authentication(String username, String authority) {
        return UsernamePasswordAuthenticationToken.authenticated(
                username, "ignored", java.util.List.of(new SimpleGrantedAuthority(authority)));
    }

    private ImpersonationService service() {
        return new ImpersonationService(
                userRepository,
                userDetailsService,
                ticketRepository,
                auditEventService,
                impersonationMapper,
                ticketMapper);
    }

    private static UserEntity user(Long id, String username) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setPassword("password");
        user.setEnabled(true);
        return user;
    }

    private static ImpersonationTicketEntity ticket(String actor, Instant expiresAt) {
        ImpersonationTicketEntity ticket = new ImpersonationTicketEntity();
        ticket.setActorUsername(actor);
        ticket.setTargetUser(user(7L, "alice"));
        ticket.setIssuedAt(Instant.now().minusSeconds(10));
        ticket.setExpiresAt(expiresAt);
        return ticket;
    }
}
