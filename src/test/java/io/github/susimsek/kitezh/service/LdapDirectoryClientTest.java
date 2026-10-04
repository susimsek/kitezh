package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.observation.ObservationRegistry;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import javax.naming.AuthenticationException;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attributes;
import javax.naming.directory.BasicAttribute;
import javax.naming.directory.BasicAttributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.ModificationItem;
import javax.naming.directory.SearchControls;
import javax.naming.directory.SearchResult;
import javax.naming.ldap.LdapContext;
import javax.naming.ldap.PagedResultsResponseControl;
import javax.naming.ldap.StartTlsRequest;
import javax.naming.ldap.StartTlsResponse;
import javax.net.ssl.SSLSocketFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

class LdapDirectoryClientTest {

    @Test
    void exposesDefaultAndObservationRegistryConstructors() {
        assertThat(new LdapDirectoryClient()).isNotNull();
        assertThat(new LdapDirectoryClient(ObservationRegistry.NOOP)).isNotNull();
    }

    @Test
    void rejectsNonLdapConnectionUrlsBeforeOpeningAContext() {
        LdapDirectoryClient client = new LdapDirectoryClient();
        LdapDirectoryClient.Configuration configuration = invalidUrlConfiguration();

        assertThatThrownBy(() -> client.testConnection(configuration))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP URL must use ldap:// or ldaps://");
    }

    @Test
    void testsAConnectionAndConfiguresAServiceBind() throws NamingException {
        DirContext context = mock(DirContext.class);
        List<Hashtable<String, Object>> environments = new ArrayList<>();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            environments.add(environment);
                            return context;
                        });

        client.testConnection(configuration("SUBTREE"));

        assertThat(environments)
                .singleElement()
                .satisfies(LdapDirectoryClientTest::assertServiceBind);
        verify(context).close();
    }

    @Test
    void usesAnonymousBindWhenNoServiceCredentialsAreConfigured() {
        DirContext context = mock(DirContext.class);
        List<Hashtable<String, Object>> environments = new ArrayList<>();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            environments.add(environment);
                            return context;
                        });

        client.testConnection(
                new LdapDirectoryClient.Configuration(
                        "ldap://directory.example.com:389",
                        " ",
                        "ignored",
                        "ou=users,dc=example,dc=com",
                        "uid",
                        "entryUUID",
                        "mail",
                        "givenName",
                        "sn",
                        "uid",
                        "inetOrgPerson",
                        "SUBTREE"));

        assertThat(environments)
                .singleElement()
                .satisfies(
                        environment ->
                                assertThat(
                                                environment.containsKey(
                                                        "java.naming.security.authentication"))
                                        .isFalse());
    }

    @Test
    void wrapsConnectionFailures() {
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            throw new NamingException("connection refused");
                        });

        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");
        assertThatThrownBy(() -> client.testConnection(configuration))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP connection test failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void rejectsMissingCredentialsBeforeOpeningAContext() {
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> null);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        assertThatThrownBy(() -> client.authenticate(configuration, " ", "password"))
                .isInstanceOf(
                        org.springframework.security.authentication.BadCredentialsException.class);
        assertThatThrownBy(() -> client.authenticate(configuration, "alice", null))
                .isInstanceOf(
                        org.springframework.security.authentication.BadCredentialsException.class);
    }

    @Test
    void returnsNullWhenDirectorySearchHasNoResults() throws NamingException {
        DirContext context = mock(DirContext.class);
        NamingEnumeration<SearchResult> results = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        doThrow(new NamingException("close failed")).when(results).close();
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(client.authenticate(configuration("SUBTREE"), "alice", "password")).isNull();
        verify(context).close();
    }

    @Test
    void wrapsDirectorySearchFailures() throws NamingException {
        DirContext context = mock(DirContext.class);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenThrow(new NamingException("search failed"));
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        assertThatThrownBy(() -> client.authenticate(configuration, "alice", "password"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user search failed")
                .hasCauseInstanceOf(NamingException.class);
        verify(context).close();
    }

    @Test
    void authenticatesUserAndMapsDirectoryAttributes() throws NamingException {
        DirContext searchContext = mock(DirContext.class);
        DirContext userContext = mock(DirContext.class);
        NamingEnumeration<SearchResult> results =
                results(true, result("uid=alice", "uid=alice,ou=users,dc=example,dc=com"));
        when(searchContext.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client = new LdapDirectoryClient(contexts(searchContext, userContext));

        LdapDirectoryClient.LdapUser user =
                client.authenticate(configuration("SUBTREE"), "alice", "password");

        assertThat(user)
                .extracting(
                        LdapDirectoryClient.LdapUser::distinguishedName,
                        LdapDirectoryClient.LdapUser::externalId,
                        LdapDirectoryClient.LdapUser::username,
                        LdapDirectoryClient.LdapUser::email,
                        LdapDirectoryClient.LdapUser::firstName,
                        LdapDirectoryClient.LdapUser::lastName)
                .containsExactly(
                        "uid=alice,ou=users,dc=example,dc=com",
                        "AQI",
                        "alice",
                        "alice@example.com",
                        "",
                        "Example");
        verify(searchContext).close();
        verify(userContext).close();
    }

    @Test
    void fallsBackToSearchResultNameWhenNamespaceNameIsBlank() throws NamingException {
        DirContext searchContext = mock(DirContext.class);
        DirContext userContext = mock(DirContext.class);
        SearchResult result = result("uid=alice", " ");
        NamingEnumeration<SearchResult> results = results(true, result);
        when(searchContext.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client = new LdapDirectoryClient(contexts(searchContext, userContext));

        LdapDirectoryClient.LdapUser user =
                client.authenticate(configuration("SUBTREE"), "alice", "password");

        assertThat(user.distinguishedName()).isEqualTo("uid=alice,ou=users,dc=example,dc=com");
    }

    @Test
    void translatesUserAuthenticationFailuresToBadCredentials() throws NamingException {
        DirContext searchContext = mock(DirContext.class);
        SearchResult result = result("uid=alice", "uid=alice,ou=users,dc=example,dc=com");
        NamingEnumeration<SearchResult> results = results(true, result);
        when(searchContext.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        contexts(
                                searchContext,
                                environment -> {
                                    throw new AuthenticationException("invalid password");
                                }));
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        assertThatThrownBy(() -> client.authenticate(configuration, "alice", "password"))
                .isInstanceOf(
                        org.springframework.security.authentication.BadCredentialsException.class)
                .hasMessage("LDAP authentication failed")
                .hasCauseInstanceOf(AuthenticationException.class);
    }

    @Test
    void translatesUserDirectoryFailuresToIllegalState() throws NamingException {
        DirContext searchContext = mock(DirContext.class);
        SearchResult result = result("uid=alice", "uid=alice,ou=users,dc=example,dc=com");
        NamingEnumeration<SearchResult> results = results(true, result);
        when(searchContext.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        contexts(
                                searchContext,
                                environment -> {
                                    throw new NamingException("user bind failed");
                                }));
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        assertThatThrownBy(() -> client.authenticate(configuration, "alice", "password"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP authentication failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void passesIdentifierAsAFilterArgumentInsteadOfInterpolatingIt() throws NamingException {
        DirContext context = mock(DirContext.class);
        NamingEnumeration<SearchResult> results = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        String identifier = "alice*)(mail=*)";

        client.authenticate(
                configurationWithAttributes(
                        "SUBTREE", "cn=admin,dc=example,dc=com", "uid", ", inetOrgPerson, "),
                identifier,
                "password");

        ArgumentCaptor<String> filterCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> argumentsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(context)
                .search(
                        eq("ou=users,dc=example,dc=com"),
                        filterCaptor.capture(),
                        argumentsCaptor.capture(),
                        any(SearchControls.class));
        assertThat(filterCaptor.getValue()).doesNotContain(identifier);
        assertThat(argumentsCaptor.getValue())
                .containsExactly("inetOrgPerson", identifier, identifier);
    }

    @ParameterizedTest
    @ValueSource(strings = {"OBJECT", "ONE_LEVEL"})
    void supportsConfiguredSearchScopes(String scope) throws NamingException {
        DirContext context = mock(DirContext.class);
        NamingEnumeration<SearchResult> results = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(client.authenticate(configuration(scope), "alice", "password")).isNull();
    }

    @Test
    void searchesOnlyEntriesChangedSinceThePreviousSynchronization() throws NamingException {
        DirContext context = mock(DirContext.class);
        NamingEnumeration<SearchResult> results = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(results);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        client.searchUsers(configuration("SUBTREE"), Instant.parse("2026-09-27T10:11:12Z"));

        ArgumentCaptor<String> filterCaptor = ArgumentCaptor.forClass(String.class);
        verify(context)
                .search(
                        eq("ou=users,dc=example,dc=com"),
                        filterCaptor.capture(),
                        any(Object[].class),
                        any(SearchControls.class));
        assertThat(filterCaptor.getValue())
                .isEqualTo(
                        "(&(&(objectClass=inetOrgPerson))"
                                + "(|(modifyTimestamp>=20260927101112Z)"
                                + "(whenChanged>=20260927101112Z)))");
        verify(context).close();
    }

    @Test
    void mapsSynchronizedUsersAndWrapsAttributeMappingFailures() throws NamingException {
        DirContext context = mock(DirContext.class);
        SearchResult result = result("uid=alice", "uid=alice,ou=users,dc=example,dc=com");
        NamingEnumeration<SearchResult> searchResults = results(true, result);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(client.searchUsers(configuration("SUBTREE")))
                .singleElement()
                .extracting(LdapDirectoryClient.LdapUser::username)
                .isEqualTo("alice");

        SearchResult broken = mock(SearchResult.class);
        Attributes brokenAttributes = mock(Attributes.class);
        when(broken.getAttributes()).thenReturn(brokenAttributes);
        @SuppressWarnings("unchecked")
        NamingEnumeration<javax.naming.directory.Attribute> brokenAll =
                mock(NamingEnumeration.class);
        javax.naming.directory.Attribute brokenAttribute =
                mock(javax.naming.directory.Attribute.class);
        doReturn(brokenAll).when(brokenAttributes).getAll();
        when(brokenAll.hasMore()).thenReturn(true);
        when(brokenAll.next()).thenReturn(brokenAttribute);
        when(brokenAttribute.getAll()).thenThrow(new NamingException("attributes failed"));
        NamingEnumeration<SearchResult> brokenResults = results(true, broken);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(brokenResults);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");
        assertThatThrownBy(() -> client.searchUsers(configuration))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user mapping failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void wrapsDirectorySynchronizationSearchFailures() throws NamingException {
        DirContext context = mock(DirContext.class);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenThrow(new NamingException("search failed"));
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");
        assertThatThrownBy(() -> client.searchUsers(configuration))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user synchronization search failed")
                .hasCauseInstanceOf(NamingException.class);
        verify(context).close();
    }

    @Test
    void handlesPaginationControlAndContextCloseFailures() throws NamingException {
        LdapContext context = mock(LdapContext.class);
        doThrow(new NamingException("controls failed")).when(context).setRequestControls(any());
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration =
                advancedConfiguration("LDAP", "ldap://directory.example.com:389", false);

        assertThatThrownBy(() -> client.searchUsers(configuration))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user synchronization search failed")
                .hasCauseInstanceOf(NamingException.class);

        doThrow(new NamingException("close failed")).when(context).close();
        client.testConnection(
                advancedConfiguration("LDAP", "ldap://directory.example.com:389", false));
    }

    @Test
    void negotiatesStartTlsAndWrapsNegotiationFailures() throws Exception {
        LdapContext context = mock(LdapContext.class);
        StartTlsResponse response = mock(StartTlsResponse.class);
        when(context.extendedOperation(any(StartTlsRequest.class))).thenReturn(response);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration =
                advancedConfiguration("LDAP", "ldap://directory.example.com:389", true);

        client.testConnection(configuration);
        verify(response).negotiate();

        doThrow(new java.io.IOException("TLS failed")).when(response).negotiate();
        assertThatThrownBy(() -> client.testConnection(configuration))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP connection test failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void loadsConfiguredTrustStoreAndRejectsMissingTrustStore() throws Exception {
        Path trustStore = Files.createTempFile("ldap-test", ".jks");
        try {
            KeyStore keyStore = KeyStore.getInstance("JKS");
            keyStore.load(null, "changeit".toCharArray());
            try (OutputStream output = Files.newOutputStream(trustStore)) {
                keyStore.store(output, "changeit".toCharArray());
            }
            LdapContext context = mock(LdapContext.class);
            StartTlsResponse response = mock(StartTlsResponse.class);
            when(context.extendedOperation(any(StartTlsRequest.class))).thenReturn(response);
            List<Hashtable<String, Object>> environments = new ArrayList<>();
            LdapDirectoryClient client =
                    new LdapDirectoryClient(
                            environment -> {
                                environments.add(environment);
                                return context;
                            });

            client.testConnection(withTrustStore(trustStore.toString(), "changeit"));
            assertThat(environments)
                    .singleElement()
                    .satisfies(
                            environment ->
                                    assertThat(environment)
                                            .containsEntry(
                                                    "java.naming.ldap.factory.socket",
                                                    LdapDirectoryClient.ConfiguredSslSocketFactory
                                                            .class
                                                            .getName()));

            client.testConnection(
                    withTrustStore(
                            trustStore.toString(),
                            "changeit",
                            "ldap://directory.example.com:389",
                            true));
            verify(response).negotiate(any(SSLSocketFactory.class));

            LdapDirectoryClient.Configuration missingTrustStore =
                    withTrustStore(trustStore.resolveSibling("missing.jks").toString(), "changeit");
            assertThatThrownBy(() -> client.testConnection(missingTrustStore))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("LDAP truststore could not be loaded");
        } finally {
            Files.deleteIfExists(trustStore);
        }
    }

    @Test
    void handlesEmptyObjectClassesAndInvalidConnectionSettings() throws NamingException {
        DirContext context = mock(DirContext.class);
        NamingEnumeration<SearchResult> emptyResults = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(emptyResults);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration emptyAttributes =
                configurationWithAttributes("SUBTREE", " ", "uid", " ");
        LdapDirectoryClient.Configuration invalidScope =
                configurationWithAttributes("INVALID", "cn=admin,dc=example,dc=com", "uid", " ");
        LdapDirectoryClient.Configuration invalidAttribute =
                new LdapDirectoryClient.Configuration(
                        "ldap://directory.example.com:389",
                        "cn=admin,dc=example,dc=com",
                        "secret",
                        "ou=users,dc=example,dc=com",
                        "uid)",
                        "entryUUID",
                        "mail",
                        "givenName",
                        "sn",
                        "uid",
                        "inetOrgPerson",
                        "SUBTREE");

        assertThat(client.searchUsers(emptyAttributes)).isEmpty();
        assertThatThrownBy(() -> client.searchUsers(invalidScope))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported LDAP search scope");
        assertThatThrownBy(() -> client.authenticate(invalidAttribute, "alice", "password"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid LDAP attribute name");
    }

    @Test
    void usesPagedSearchControlsForLdapContexts() throws NamingException {
        LdapContext context = mock(LdapContext.class);
        NamingEnumeration<SearchResult> searchResults = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        when(context.getResponseControls()).thenReturn(null);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(
                        client.searchUsers(
                                advancedConfiguration(
                                        "LDAP", "ldap://directory.example.com:389", false)))
                .isEmpty();

        verify(context, times(2)).setRequestControls(any());
        verify(context).close();
    }

    @Test
    void followsPagedSearchCookiesUntilTheDirectoryIsExhausted() throws Exception {
        LdapContext context = mock(LdapContext.class);
        NamingEnumeration<SearchResult> firstResults = results(false, null);
        NamingEnumeration<SearchResult> secondResults = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(firstResults, secondResults);
        PagedResultsResponseControl firstResponse = mock(PagedResultsResponseControl.class);
        PagedResultsResponseControl lastResponse = mock(PagedResultsResponseControl.class);
        when(firstResponse.getCookie()).thenReturn(new byte[] {1});
        when(lastResponse.getCookie()).thenReturn(new byte[0]);
        javax.naming.ldap.Control[] firstControls = {firstResponse};
        javax.naming.ldap.Control[] lastControls = {lastResponse};
        when(context.getResponseControls()).thenReturn(firstControls, lastControls);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(
                        client.searchUsers(
                                advancedConfiguration(
                                        "LDAP", "ldap://directory.example.com:389", false)))
                .isEmpty();

        verify(context, times(2))
                .search(anyString(), anyString(), any(Object[].class), any(SearchControls.class));
        verify(context, times(3)).setRequestControls(any());
    }

    @Test
    void searchesOnlyUsersChangedSinceTheRequestedInstant() throws NamingException {
        LdapContext context = mock(LdapContext.class);
        NamingEnumeration<SearchResult> searchResults = results(false, null);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        when(context.getResponseControls()).thenReturn(null);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        client.searchUsers(
                advancedConfiguration("LDAP", "ldap://directory.example.com:389", false),
                Instant.parse("2026-01-02T03:04:05Z"));

        verify(context)
                .search(
                        anyString(),
                        org.mockito.ArgumentMatchers.contains("modifyTimestamp>=20260102030405Z"),
                        any(Object[].class),
                        any(SearchControls.class));
    }

    @Test
    void rejectsUnsupportedSearchScopes() throws NamingException {
        DirContext context = mock(DirContext.class);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration = configuration("INVALID");

        assertThatThrownBy(() -> client.authenticate(configuration, "alice", "password"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unsupported LDAP search scope");
        verify(context).close();
    }

    @Test
    void rejectsInvalidAttributeNames() throws NamingException {
        DirContext context = mock(DirContext.class);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration =
                configurationWithAttributes(
                        "SUBTREE", "cn=admin,dc=example,dc=com", "uid)", "inetOrgPerson");

        assertThatThrownBy(() -> client.authenticate(configuration, "alice", "password"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid LDAP attribute name");
        verify(context).close();
    }

    @Test
    void updatesChangedAndRemovedAttributes() throws NamingException {
        DirContext context = mock(DirContext.class);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        Map<String, String> changes = new LinkedHashMap<>();
        changes.put("mail", "new@example.com");
        changes.put("givenName", " ");

        client.updateUser(configuration("SUBTREE"), "uid=alice", changes);

        ArgumentCaptor<ModificationItem[]> captor =
                ArgumentCaptor.forClass(ModificationItem[].class);
        verify(context).modifyAttributes(eq("uid=alice"), captor.capture());
        assertThat(captor.getValue()).hasSize(2);
        assertThat(captor.getValue())
                .extracting(ModificationItem::getModificationOp)
                .containsExactlyInAnyOrder(
                        DirContext.REMOVE_ATTRIBUTE, DirContext.REPLACE_ATTRIBUTE);
        verify(context).close();
    }

    @Test
    void findsNonBlankGroupsAndSkipsIncompleteGroupConfiguration() throws NamingException {
        SearchResult result = mock(SearchResult.class);
        Attributes attributes = new BasicAttributes(true);
        attributes.put("cn", "engineering");
        when(result.getAttributes()).thenReturn(attributes);
        @SuppressWarnings("unchecked")
        NamingEnumeration<SearchResult> searchResults = mock(NamingEnumeration.class);
        when(searchResults.hasMore()).thenReturn(true, false);
        when(searchResults.next()).thenReturn(result);
        DirContext context = mock(DirContext.class);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(
                        client.findGroups(
                                configuration("SUBTREE"),
                                "uid=alice",
                                "ou=groups,dc=example,dc=com",
                                "groupOfNames",
                                "cn",
                                "member"))
                .containsExactly("engineering");
        assertThat(
                        client.findGroups(
                                configuration("SUBTREE"),
                                "uid=alice",
                                " ",
                                "groupOfNames",
                                "cn",
                                "member"))
                .isEmpty();
        verify(context).close();
    }

    @Test
    void skipsGroupsWhenTheObjectClassIsMissingAndHandlesMissingGroupAttributes()
            throws NamingException {
        SearchResult result = mock(SearchResult.class);
        when(result.getAttributes()).thenReturn(new BasicAttributes(true));
        @SuppressWarnings("unchecked")
        NamingEnumeration<SearchResult> searchResults = mock(NamingEnumeration.class);
        when(searchResults.hasMore()).thenReturn(true, false);
        when(searchResults.next()).thenReturn(result);
        DirContext context = mock(DirContext.class);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(
                        client.findGroups(
                                configuration("SUBTREE"),
                                "uid=alice",
                                "ou=groups,dc=example,dc=com",
                                null,
                                "cn",
                                "member"))
                .isEmpty();
        assertThat(
                        client.findGroups(
                                configuration("SUBTREE"),
                                "uid=alice",
                                "ou=groups,dc=example,dc=com",
                                "groupOfNames",
                                "cn",
                                "member"))
                .isEmpty();
    }

    @Test
    void skipsBlankGroupNamesAndWrapsGroupSearchFailures() throws NamingException {
        SearchResult blankResult = mock(SearchResult.class);
        Attributes blankAttributes = new BasicAttributes(true);
        blankAttributes.put("cn", " ");
        when(blankResult.getAttributes()).thenReturn(blankAttributes);
        @SuppressWarnings("unchecked")
        NamingEnumeration<SearchResult> searchResults = mock(NamingEnumeration.class);
        when(searchResults.hasMore()).thenReturn(true, false);
        when(searchResults.next()).thenReturn(blankResult);
        DirContext context = mock(DirContext.class);
        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenReturn(searchResults);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);

        assertThat(
                        client.findGroups(
                                configuration("SUBTREE"),
                                "uid=alice",
                                "ou=groups,dc=example,dc=com",
                                "groupOfNames",
                                "cn",
                                "member"))
                .isEmpty();

        when(context.search(
                        anyString(), anyString(), any(Object[].class), any(SearchControls.class)))
                .thenThrow(new NamingException("group search failed"));
        LdapDirectoryClient.Configuration groupConfiguration = configuration("SUBTREE");
        assertThatThrownBy(
                        () ->
                                client.findGroups(
                                        groupConfiguration,
                                        "uid=alice",
                                        "ou=groups,dc=example,dc=com",
                                        "groupOfNames",
                                        "cn",
                                        "member"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP group search failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void ignoresEmptyUpdatesWithoutOpeningAContext() {
        AtomicInteger openedContexts = new AtomicInteger();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            openedContexts.incrementAndGet();
                            return mock(DirContext.class);
                        });

        client.updateUser(configuration("SUBTREE"), "uid=alice", null);
        client.updateUser(configuration("SUBTREE"), "uid=alice", Map.of());

        assertThat(openedContexts).hasValue(0);
    }

    @Test
    void removesAnAttributeWhenItsUpdateValueIsNull() throws NamingException {
        DirContext context = mock(DirContext.class);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        Map<String, String> changes = new LinkedHashMap<>();
        changes.put("mail", null);

        client.updateUser(configuration("SUBTREE"), "uid=alice", changes);

        ArgumentCaptor<ModificationItem[]> captor =
                ArgumentCaptor.forClass(ModificationItem[].class);
        verify(context).modifyAttributes(eq("uid=alice"), captor.capture());
        assertThat(captor.getValue()[0].getModificationOp()).isEqualTo(DirContext.REMOVE_ATTRIBUTE);
    }

    @Test
    void wrapsDirectoryUpdateFailures() throws NamingException {
        DirContext context = mock(DirContext.class);
        doThrow(new NamingException("modify failed"))
                .when(context)
                .modifyAttributes(anyString(), any(ModificationItem[].class));
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");
        Map<String, String> changes = Map.of("mail", "new@example.com");

        assertThatThrownBy(() -> client.updateUser(configuration, "uid=alice", changes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user update failed")
                .hasCauseInstanceOf(NamingException.class);
        verify(context).close();
    }

    @Test
    void wrapsPasswordAndRegistrationFailures() throws NamingException {
        DirContext context = mock(DirContext.class);
        doThrow(new NamingException("password failed"))
                .when(context)
                .modifyAttributes(anyString(), any(ModificationItem[].class));
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        assertThatThrownBy(() -> client.updatePassword(configuration, "uid=alice", "secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP password update failed")
                .hasCauseInstanceOf(NamingException.class);

        when(context.createSubcontext(anyString(), any(Attributes.class)))
                .thenThrow(new NamingException("register failed"));
        assertThatThrownBy(
                        () ->
                                client.registerUser(
                                        configuration,
                                        "alice,admin+ops",
                                        "alice@example.com",
                                        "Alice",
                                        "Example",
                                        "secret"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("LDAP user registration failed")
                .hasCauseInstanceOf(NamingException.class);
        verify(context, times(2)).close();
    }

    @Test
    void configuresAdvancedConnectionOptions() {
        DirContext context = mock(DirContext.class);
        List<Hashtable<String, Object>> environments = new ArrayList<>();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            environments.add(environment);
                            return context;
                        });

        client.testConnection(
                advancedConfiguration("LDAP", "ldaps://directory.example.com:636", false));

        assertThat(environments)
                .singleElement()
                .satisfies(
                        environment ->
                                assertThat(environment)
                                        .containsEntry("java.naming.referral", "follow")
                                        .containsEntry("com.sun.jndi.ldap.connect.timeout", "1234")
                                        .containsEntry("com.sun.jndi.ldap.read.timeout", "2345")
                                        .containsEntry("com.sun.jndi.ldap.connect.pool", "true"));
    }

    @Test
    void writesActiveDirectoryUnicodePasswordsAndRegistrationAttributes() throws NamingException {
        DirContext context = mock(DirContext.class);
        DirContext created = mock(DirContext.class);
        when(context.createSubcontext(anyString(), any(Attributes.class))).thenReturn(created);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration =
                advancedConfiguration(
                        "ACTIVE_DIRECTORY", "ldaps://directory.example.com:636", false);

        client.updatePassword(configuration, "CN=alice,OU=Users,DC=example,DC=com", "secret");
        client.registerUser(
                configuration, "alice", "alice@example.com", "Alice", "Example", "secret");

        ArgumentCaptor<ModificationItem[]> changes =
                ArgumentCaptor.forClass(ModificationItem[].class);
        verify(context)
                .modifyAttributes(eq("CN=alice,OU=Users,DC=example,DC=com"), changes.capture());
        assertThat(changes.getValue()[0].getAttribute().getID()).isEqualTo("unicodePwd");
        assertThat((byte[]) changes.getValue()[0].getAttribute().get())
                .isEqualTo("\"secret\"".getBytes(java.nio.charset.StandardCharsets.UTF_16LE));
        verify(context).createSubcontext(anyString(), any(Attributes.class));
        verify(created).close();
        verify(context, times(2)).close();
    }

    @Test
    void writesGenericLdapPasswordsAndRegistrationAttributes() throws NamingException {
        DirContext context = mock(DirContext.class);
        DirContext created = mock(DirContext.class);
        when(context.createSubcontext(anyString(), any(Attributes.class))).thenReturn(created);
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> context);
        LdapDirectoryClient.Configuration configuration = configuration("SUBTREE");

        client.updatePassword(configuration, "uid=alice", "secret");
        String distinguishedName =
                client.registerUser(
                        configuration, "alice", "alice@example.com", "Alice", "Example", "secret");

        assertThat(distinguishedName).isEqualTo("uid=alice,ou=users,dc=example,dc=com");
        ArgumentCaptor<ModificationItem[]> changes =
                ArgumentCaptor.forClass(ModificationItem[].class);
        verify(context).modifyAttributes(eq("uid=alice"), changes.capture());
        assertThat(changes.getValue()[0].getAttribute().getID()).isEqualTo("userPassword");
        verify(context).createSubcontext(anyString(), any(Attributes.class));
        verify(created).close();
        verify(context, times(2)).close();
    }

    @Test
    void rejectsInsecureActiveDirectoryPasswordOperations() {
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> mock(DirContext.class));
        LdapDirectoryClient.Configuration configuration =
                advancedConfiguration(
                        "ACTIVE_DIRECTORY", "ldap://directory.example.com:389", false);

        assertThatThrownBy(() -> client.updatePassword(configuration, "uid=alice", "secret"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Active Directory password operations require LDAPS or StartTLS");
        assertThatThrownBy(
                        () ->
                                client.registerUser(
                                        configuration,
                                        "alice",
                                        "alice@example.com",
                                        "Alice",
                                        "Example",
                                        "secret"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Active Directory password operations require LDAPS or StartTLS");
    }

    @Test
    void supportsKerberosServiceBindAndRejectsStartTlsOnNonLdapContext() {
        DirContext context = mock(DirContext.class);
        List<Hashtable<String, Object>> environments = new ArrayList<>();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            environments.add(environment);
                            return context;
                        });

        client.testConnection(
                new LdapDirectoryClient.Configuration(
                        "ldap://directory.example.com:389",
                        "cn=admin,dc=example,dc=com",
                        "ignored",
                        "ou=users,dc=example,dc=com",
                        "uid",
                        "entryUUID",
                        "mail",
                        "givenName",
                        "sn",
                        "uid",
                        "inetOrgPerson",
                        "SUBTREE",
                        "LDAP",
                        "KERBEROS",
                        false,
                        null,
                        null,
                        "JKS",
                        false,
                        "THROW",
                        5000,
                        5000,
                        500));
        assertThat(environments)
                .singleElement()
                .satisfies(
                        environment ->
                                assertThat(environment)
                                        .containsEntry(
                                                "java.naming.security.authentication", "GSSAPI")
                                        .doesNotContainKey("java.naming.security.credentials"));

        LdapDirectoryClient.Configuration ldapsStartTls =
                advancedConfiguration("LDAP", "ldaps://directory.example.com:636", true);
        assertThatThrownBy(() -> client.testConnection(ldapsStartTls))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("StartTLS requires an ldap:// URL");
    }

    @Test
    void usesAnEmptyPasswordForAnonymousConfiguredServiceBind() {
        DirContext context = mock(DirContext.class);
        List<Hashtable<String, Object>> environments = new ArrayList<>();
        LdapDirectoryClient client =
                new LdapDirectoryClient(
                        environment -> {
                            environments.add(environment);
                            return context;
                        });
        LdapDirectoryClient.Configuration configuration =
                new LdapDirectoryClient.Configuration(
                        "ldap://directory.example.com:389",
                        "cn=admin,dc=example,dc=com",
                        null,
                        "ou=users,dc=example,dc=com",
                        "uid",
                        "entryUUID",
                        "mail",
                        "givenName",
                        "sn",
                        "uid",
                        "inetOrgPerson",
                        "SUBTREE");

        client.testConnection(configuration);

        assertThat(environments)
                .singleElement()
                .satisfies(
                        environment ->
                                assertThat((Map<String, Object>) environment)
                                        .containsEntry("java.naming.security.credentials", ""));
    }

    @Test
    void rejectsStartTlsWhenTheContextIsNotLdapCapable() {
        LdapDirectoryClient client = new LdapDirectoryClient(environment -> mock(DirContext.class));
        LdapDirectoryClient.Configuration startTls =
                advancedConfiguration("LDAP", "ldap://directory.example.com:389", true);

        assertThatThrownBy(() -> client.testConnection(startTls))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP connection test failed")
                .hasCauseInstanceOf(NamingException.class);
    }

    @Test
    void delegatesConfiguredSslSocketFactoryOperations() throws Exception {
        SSLSocketFactory delegate = mock(SSLSocketFactory.class);
        LdapDirectoryClient.ConfiguredSslSocketFactory factory =
                new LdapDirectoryClient.ConfiguredSslSocketFactory(delegate);
        java.net.Socket socket = new java.net.Socket();
        java.net.InetAddress address = java.net.InetAddress.getLoopbackAddress();

        factory.getDefaultCipherSuites();
        factory.getSupportedCipherSuites();
        factory.createSocket(socket, "localhost", 636, true);
        factory.createSocket("localhost", 636);
        factory.createSocket("localhost", 636, address, 0);
        factory.createSocket(address, 636);
        factory.createSocket(address, 636, address, 0);

        verify(delegate).getDefaultCipherSuites();
        verify(delegate).getSupportedCipherSuites();
        verify(delegate).createSocket(socket, "localhost", 636, true);
        verify(delegate).createSocket("localhost", 636);
        verify(delegate).createSocket("localhost", 636, address, 0);
        verify(delegate).createSocket(address, 636);
        verify(delegate).createSocket(address, 636, address, 0);
        new LdapDirectoryClient.ConfiguredSslSocketFactory().getDefaultCipherSuites();
    }

    @Test
    void matchesLdapUserAttributesCaseInsensitivelyAndHandlesNullNames() {
        LdapDirectoryClient.LdapUser user =
                new LdapDirectoryClient.LdapUser(
                        "uid=alice",
                        "id",
                        "alice",
                        "alice@example.com",
                        "Alice",
                        "Example",
                        Map.of("mail", List.of("alice@example.com")));

        assertThat(user.values("MAIL")).containsExactly("alice@example.com");
        assertThat(user.values(null)).isEmpty();
        assertThat(user.values("missing")).isEmpty();
    }

    private static void assertServiceBind(Hashtable<String, Object> environment) {
        assertThat(environment)
                .containsEntry("java.naming.security.authentication", "simple")
                .containsEntry("java.naming.security.principal", "cn=admin,dc=example,dc=com")
                .containsEntry("java.naming.security.credentials", "bind-password");
    }

    private static LdapDirectoryClient.DirContextFactory contexts(DirContext... contexts) {
        AtomicInteger index = new AtomicInteger();
        return environment -> contexts[index.getAndIncrement()];
    }

    private static LdapDirectoryClient.DirContextFactory contexts(
            DirContext first, LdapDirectoryClient.DirContextFactory second) {
        AtomicInteger index = new AtomicInteger();
        return environment -> index.getAndIncrement() == 0 ? first : second.create(environment);
    }

    @SuppressWarnings("unchecked")
    private static NamingEnumeration<SearchResult> results(boolean more, SearchResult result)
            throws NamingException {
        NamingEnumeration<SearchResult> results = mock(NamingEnumeration.class);
        when(results.hasMore()).thenReturn(more, false);
        if (more) {
            when(results.next()).thenReturn(result);
        }
        return results;
    }

    private static SearchResult result(String name, String nameInNamespace) {
        Attributes attributes = new BasicAttributes(true);
        BasicAttribute uuid = new BasicAttribute("entryUUID");
        uuid.add(new byte[] {1, 2});
        attributes.put(uuid);
        attributes.put("uid", "alice");
        attributes.put("mail", "alice@example.com");
        attributes.put("sn", "Example");
        SearchResult result = mock(SearchResult.class);
        when(result.getName()).thenReturn(name);
        when(result.getNameInNamespace()).thenReturn(nameInNamespace);
        when(result.getAttributes()).thenReturn(attributes);
        return result;
    }

    private static LdapDirectoryClient.Configuration configuration(String scope) {
        return configurationWithAttributes(
                scope, "cn=admin,dc=example,dc=com", "uid", "inetOrgPerson");
    }

    private static LdapDirectoryClient.Configuration invalidUrlConfiguration() {
        return new LdapDirectoryClient.Configuration(
                "https://directory.example.com",
                "cn=admin,dc=example,dc=com",
                "bind-password",
                "ou=users,dc=example,dc=com",
                "uid",
                "entryUUID",
                "mail",
                "givenName",
                "sn",
                "uid",
                "inetOrgPerson",
                "SUBTREE");
    }

    private static LdapDirectoryClient.Configuration configurationWithAttributes(
            String scope, String bindDn, String usernameAttribute, String objectClasses) {
        return new LdapDirectoryClient.Configuration(
                "ldap://directory.example.com:389",
                bindDn,
                "bind-password",
                "ou=users,dc=example,dc=com",
                usernameAttribute,
                "entryUUID",
                "mail",
                "givenName",
                "sn",
                "uid",
                objectClasses,
                scope);
    }

    private static LdapDirectoryClient.Configuration advancedConfiguration(
            String vendor, String connectionUrl, boolean startTls) {
        return new LdapDirectoryClient.Configuration(
                connectionUrl,
                "cn=admin,dc=example,dc=com",
                "bind-password",
                "ou=users,dc=example,dc=com",
                "uid",
                "entryUUID",
                "mail",
                "givenName",
                "sn",
                "uid",
                "inetOrgPerson",
                "SUBTREE",
                vendor,
                "SIMPLE",
                startTls,
                null,
                null,
                "JKS",
                true,
                "FOLLOW",
                1234,
                2345,
                2);
    }

    private static LdapDirectoryClient.Configuration withTrustStore(
            String trustStorePath, String trustStorePassword) {
        return withTrustStore(
                trustStorePath, trustStorePassword, "ldaps://directory.example.com:636", false);
    }

    private static LdapDirectoryClient.Configuration withTrustStore(
            String trustStorePath,
            String trustStorePassword,
            String connectionUrl,
            boolean startTls) {
        return new LdapDirectoryClient.Configuration(
                connectionUrl,
                "cn=admin,dc=example,dc=com",
                "bind-password",
                "ou=users,dc=example,dc=com",
                "uid",
                "entryUUID",
                "mail",
                "givenName",
                "sn",
                "uid",
                "inetOrgPerson",
                "SUBTREE",
                "LDAP",
                "SIMPLE",
                startTls,
                trustStorePath,
                trustStorePassword,
                "JKS",
                false,
                "FOLLOW",
                1234,
                2345,
                0);
    }
}
