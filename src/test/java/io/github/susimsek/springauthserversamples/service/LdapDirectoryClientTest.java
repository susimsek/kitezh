package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import javax.net.ssl.SSLSocketFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

class LdapDirectoryClientTest {

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
        when(results.hasMore()).thenReturn(more);
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
}
