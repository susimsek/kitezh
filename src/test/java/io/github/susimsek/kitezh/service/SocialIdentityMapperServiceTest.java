package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.SocialProviderMapperRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SocialIdentityMapperServiceTest {

    @Mock private SocialProviderMapperRepository mapperRepository;
    @Mock private UserProfileService userProfileService;

    @Test
    void appliesInheritedMappersOnFirstLogin() {
        SocialProviderMapperEntity mapper = mapper("email", "email", "inherit");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service().apply("google", Map.of("email", "new@example.test"), user, true);

        assertThat(user.getEmail()).isEqualTo("new@example.test");
        verify(userProfileService).saveMappedUser(user, true);
    }

    @Test
    void doesNotApplyInheritedMapperToExistingUser() {
        SocialProviderMapperEntity mapper = mapper("email", "email", "inherit");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service().apply("google", Map.of("email", "new@example.test"), user, false);

        assertThat(user.getEmail()).isEqualTo("old@example.test");
    }

    @Test
    void appliesForceMapperToExistingUserAndMergesCustomAttributes() {
        SocialProviderMapperEntity email = mapper("email", "email", "force");
        SocialProviderMapperEntity department = mapper("department", "department", "force");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(email, department));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service()
                .apply(
                        "google",
                        Map.of("email", "new@example.test", "department", "Engineering"),
                        user,
                        false);

        assertThat(user.getEmail()).isEqualTo("new@example.test");
        verify(userProfileService)
                .mergeMappedAttributes(
                        user, Map.of("department", List.of("Engineering")), "social-login");
        verify(userProfileService).saveMappedUser(user, false);
    }

    @Test
    void inheritedMapperUsesProviderForceModeForExistingUser() {
        SocialProviderMapperEntity mapper = mapper("email", "email", "inherit");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service().apply("google", Map.of("email", "new@example.test"), user, false, false, "force");

        assertThat(user.getEmail()).isEqualTo("new@example.test");
    }

    @Test
    void inheritedMapperRespectsProviderReadOnlyModeForExistingUser() {
        SocialProviderMapperEntity mapper = mapper("email", "email", "inherit");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service()
                .apply(
                        "google",
                        Map.of("email", "new@example.test"),
                        user,
                        false,
                        false,
                        "read_only");

        assertThat(user.getEmail()).isEqualTo("old@example.test");
    }

    @Test
    void collectsConfiguredTokenClaims() {
        SocialProviderMapperEntity mapper = mapper("department", "department", "force");
        mapper.setMapperType("claim");
        mapper.setAddToIdToken(true);
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));

        Map<String, Map<String, Object>> mapped =
                service()
                        .apply(
                                "google",
                                Map.of("department", "Engineering"),
                                new UserEntity(),
                                true);

        assertThat(mapped).containsEntry("id_token", Map.of("department", "Engineering"));
    }

    @Test
    void normalizesMappedUsernameUnlessProviderPreservesCase() {
        SocialProviderMapperEntity mapper = mapper("login", "username", "force");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setUsername("generated");

        service().apply("google", Map.of("login", "MiXeD.User"), user, true, false);
        assertThat(user.getUsername()).isEqualTo("mixed.user");

        user.setUsername("generated");
        service().apply("google", Map.of("login", "MiXeD.User"), user, true, true);
        assertThat(user.getUsername()).isEqualTo("MiXeD.User");
    }

    @Test
    void ignoresMissingProviderOrMappers() {
        UserEntity user = new UserEntity();

        assertThat(service().apply(null, Map.of(), user, true)).isEmpty();
        assertThat(service().apply("", Map.of(), user, true)).isEmpty();
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google")).thenReturn(List.of());
        assertThat(service().apply("google", Map.of(), user, true)).isEmpty();
        verify(userProfileService, never()).saveMappedUser(user, true);
    }

    @Test
    void appliesAllBuiltInAttributesAndValidatesPictureAndEmailVerification() {
        List<SocialProviderMapperEntity> mappers =
                List.of(
                        mapper("email", "email", "force"),
                        mapper("first", "firstName", "force"),
                        mapper("last", "lastName", "force"),
                        mapper("picture", "pictureUrl", "force"),
                        mapper("verified", "emailVerified", "force"));
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google")).thenReturn(mappers);
        UserEntity user = new UserEntity();

        service()
                .apply(
                        "google",
                        Map.of(
                                "email", " Person@Example.TEST ",
                                "first", "Ada",
                                "last", "Lovelace",
                                "picture", "https://example.test/avatar",
                                "verified", "true"),
                        user,
                        true);

        assertThat(user.getEmail()).isEqualTo("person@example.test");
        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getLastName()).isEqualTo("Lovelace");
        assertThat(user.getPictureUrl()).isEqualTo("https://example.test/avatar");
        assertThat(user.isEmailVerified()).isTrue();
        verify(userProfileService).saveMappedUser(user, true);
    }

    @Test
    void ignoresInvalidBuiltInValuesAndDoesNotSaveUnchangedUser() {
        List<SocialProviderMapperEntity> mappers =
                List.of(
                        mapper("picture", "pictureUrl", "force"),
                        mapper("verified", "emailVerified", "force"),
                        mapper("email", "email", "force"));
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google")).thenReturn(mappers);
        UserEntity user = new UserEntity();
        user.setEmail("person@example.test");

        service()
                .apply(
                        "google",
                        Map.of(
                                "picture", "http://example.test/avatar#fragment",
                                "verified", "unknown",
                                "email", "PERSON@example.test"),
                        user,
                        true);

        assertThat(user.getPictureUrl()).isNull();
        assertThat(user.isEmailVerified()).isFalse();
        verify(userProfileService, never()).saveMappedUser(user, true);
    }

    @Test
    void mapsNestedAndCollectionValuesToProfileAndBothTokens() {
        SocialProviderMapperEntity mapper = mapper("profile.roles", "roles", "force");
        mapper.setMapperType("claim");
        mapper.setAddToIdToken(true);
        mapper.setAddToAccessToken(true);
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));

        Map<String, Map<String, Object>> mapped =
                service()
                        .apply(
                                "google",
                                Map.of(
                                        "profile",
                                        Map.of("roles", Arrays.asList("admin", "", null, "user"))),
                                new UserEntity(),
                                true);

        assertThat(mapped.get("id_token")).containsEntry("roles", List.of("admin", "user"));
        assertThat(mapped.get("access_token")).containsEntry("roles", List.of("admin", "user"));
    }

    @Test
    void skipsReservedClaimsEmptyTargetsAndMissingSourceClaims() {
        SocialProviderMapperEntity reserved = mapper("sub", "sub", "force");
        reserved.setMapperType("claim");
        reserved.setAddToIdToken(true);
        SocialProviderMapperEntity blank = mapper("email", " ", "force");
        SocialProviderMapperEntity missing = mapper("missing", "custom", "force");
        missing.setMapperType("claim");
        missing.setAddToIdToken(true);
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(reserved, blank, missing));

        assertThat(service().apply("google", Map.of("sub", "subject"), new UserEntity(), true))
                .isEmpty();
    }

    @Test
    void storesUnknownUserAttributesAndSupportsAccessTokenOnlyClaims() {
        SocialProviderMapperEntity attribute = mapper("groups", "department", "force");
        SocialProviderMapperEntity claim = mapper("groups", "groups", "force");
        claim.setMapperType("claim");
        claim.setAddToAccessToken(true);
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(attribute, claim));
        UserEntity user = new UserEntity();

        var result = service().apply("google", Map.of("groups", Set.of("engineering")), user, true);

        assertThat(result).containsEntry("access_token", Map.of("groups", "engineering"));
        verify(userProfileService)
                .mergeMappedAttributes(
                        user, Map.of("department", List.of("engineering")), "social-login");
    }

    @Test
    void fallsBackToFirstLoginForUnknownSyncModeAndBlankProviderMode() {
        SocialProviderMapperEntity mapper = mapper("email", "email", "unsupported");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));
        UserEntity user = new UserEntity();
        user.setEmail("old@example.test");

        service().apply("google", Map.of("email", "new@example.test"), user, true, false, " ");

        assertThat(user.getEmail()).isEqualTo("new@example.test");
    }

    @Test
    void coversMapperValueAndBuiltInValidationBoundaries() {
        SocialProviderMapperEntity blankSource = mapper(" ", "department", "force");
        SocialProviderMapperEntity scalarNested = mapper("profile.roles", "roles", "force");
        SocialProviderMapperEntity blankEmail = mapper("blankEmail", "email", "force");
        SocialProviderMapperEntity invalidPicture = mapper("picture", "pictureUrl", "force");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(blankSource, scalarNested, blankEmail, invalidPicture));

        UserEntity user = new UserEntity();
        user.setEmail("existing@example.test");
        service()
                .apply(
                        "google",
                        Map.of(
                                "profile", "not-a-map",
                                "blankEmail", " ",
                                "picture", "https://user:secret@example.test/avatar"),
                        user,
                        true);

        assertThat(user.getEmail()).isEqualTo("existing@example.test");
        assertThat(user.getPictureUrl()).isNull();
        verify(userProfileService, never()).saveMappedUser(user, true);
    }

    @Test
    void rejectsNonHttpsAndMalformedPictureUrls() {
        SocialProviderMapperEntity mapper = mapper("picture", "pictureUrl", "force");
        when(mapperRepository.findAllByProviderAliasIgnoreCase("google"))
                .thenReturn(List.of(mapper));

        for (String picture :
                List.of("http://example.test/avatar", "https:///avatar", "not a uri")) {
            UserEntity user = new UserEntity();
            service().apply("google", Map.of("picture", picture), user, true);
            assertThat(user.getPictureUrl()).isNull();
        }
    }

    private SocialIdentityMapperService service() {
        return new SocialIdentityMapperService(mapperRepository, userProfileService);
    }

    private static SocialProviderMapperEntity mapper(
            String sourceClaim, String target, String syncMode) {
        SocialProviderMapperEntity mapper = new SocialProviderMapperEntity();
        mapper.setProviderAlias("google");
        mapper.setSourceClaim(sourceClaim);
        mapper.setTarget(target);
        mapper.setMapperType("user-attribute");
        mapper.setSyncMode(syncMode);
        return mapper;
    }
}
