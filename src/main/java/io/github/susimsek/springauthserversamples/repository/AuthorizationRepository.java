package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.AuthorizationEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthorizationRepository extends JpaRepository<AuthorizationEntity, String> {

    @Query(
            """
            select a
            from AuthorizationEntity a
            where a.state = :token
               or a.authorizationCodeValue = :token
               or a.accessTokenValue = :token
               or a.refreshTokenValue = :token
               or a.oidcIdTokenValue = :token
               or a.userCodeValue = :token
               or a.deviceCodeValue = :token
            """)
    Optional<AuthorizationEntity> findByToken(@Param("token") String token);

    Optional<AuthorizationEntity> findByState(String state);

    Optional<AuthorizationEntity> findByAuthorizationCodeValue(String authorizationCodeValue);

    Optional<AuthorizationEntity> findByAccessTokenValue(String accessTokenValue);

    boolean existsByAccessTokenValue(String accessTokenValue);

    @Query("select a.sessionId from AuthorizationEntity a where a.id = :id")
    Optional<String> findSessionIdById(@Param("id") String id);

    Optional<AuthorizationEntity> findByRefreshTokenValue(String refreshTokenValue);

    Optional<AuthorizationEntity> findByOidcIdTokenValue(String oidcIdTokenValue);

    Optional<AuthorizationEntity> findByUserCodeValue(String userCodeValue);

    Optional<AuthorizationEntity> findByDeviceCodeValue(String deviceCodeValue);

    long deleteByPrincipalName(String principalName);

    long deleteByPrincipalNameAndSessionIdNot(String principalName, String sessionId);

    long deleteByRegisteredClientId(String registeredClientId);

    long deleteBySessionId(String sessionId);

    long deleteBySessionIdIn(Collection<String> sessionIds);

    List<AuthorizationEntity> findAllBySessionIdOrderByAccessTokenIssuedAtDesc(String sessionId);

    List<AuthorizationEntity> findAllBySessionIdInOrderByAccessTokenIssuedAtDesc(
            Collection<String> sessionIds);

    @Query(
            "select distinct a.sessionId from AuthorizationEntity a where a.registeredClientId ="
                    + " :registeredClientId and a.sessionId is not null")
    List<String> findDistinctSessionIdsByRegisteredClientId(
            @Param("registeredClientId") String registeredClientId);

    @Query(
            "select a.sessionId as sessionId, count(a) as authorizationCount "
                    + "from AuthorizationEntity a where a.sessionId in :sessionIds "
                    + "group by a.sessionId")
    List<SessionAuthorizationCount> countBySessionIdIn(
            @Param("sessionIds") Collection<String> sessionIds);

    long deleteByPrincipalNameAndRegisteredClientId(
            String principalName, String registeredClientId);

    interface SessionAuthorizationCount {
        String getSessionId();

        long getAuthorizationCount();
    }
}
