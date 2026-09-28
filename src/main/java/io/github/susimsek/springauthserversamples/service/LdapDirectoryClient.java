package io.github.susimsek.springauthserversamples.service;

import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Hashtable;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javax.naming.AuthenticationException;
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.BasicAttribute;
import javax.naming.directory.DirContext;
import javax.naming.directory.ModificationItem;
import javax.naming.directory.SearchControls;
import javax.naming.directory.SearchResult;
import javax.naming.ldap.Control;
import javax.naming.ldap.InitialLdapContext;
import javax.naming.ldap.LdapContext;
import javax.naming.ldap.PagedResultsControl;
import javax.naming.ldap.PagedResultsResponseControl;
import javax.naming.ldap.StartTlsRequest;
import javax.naming.ldap.StartTlsResponse;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Component;

/** Small JNDI client that keeps LDAP credentials and user attributes server-side. */
@Component
public class LdapDirectoryClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(LdapDirectoryClient.class);
    private static final String LDAP_FACTORY = "com.sun.jndi.ldap.LdapCtxFactory";
    private static final String SIMPLE_AUTHENTICATION = "simple";
    private static final String KERBEROS_AUTHENTICATION = "GSSAPI";
    private static final DateTimeFormatter LDAP_GENERALIZED_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final ThreadLocal<SSLSocketFactory> CONFIGURED_SOCKET_FACTORY =
            new ThreadLocal<>();

    private final DirContextFactory contextFactory;

    @Autowired
    public LdapDirectoryClient() {
        this((environment) -> new InitialLdapContext(environment, null));
    }

    LdapDirectoryClient(DirContextFactory contextFactory) {
        this.contextFactory = contextFactory;
    }

    public void testConnection(Configuration configuration) {
        DirContext context = null;
        try {
            context = open(configuration, false);
            // Opening the context verifies the service bind and the connection.
        } catch (NamingException exception) {
            throw new IllegalArgumentException("LDAP connection test failed", exception);
        } finally {
            close(context);
        }
    }

    public LdapUser authenticate(Configuration configuration, String identifier, String password) {
        if (identifier == null || identifier.isBlank() || password == null) {
            throw new BadCredentialsException("LDAP authentication failed");
        }
        SearchResult result;
        DirContext context = null;
        try {
            context = open(configuration, false);
            result = findUser(context, configuration, identifier);
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP user search failed", exception);
        } finally {
            close(context);
        }
        if (result == null) {
            return null;
        }
        String userDn;
        userDn = distinguishedName(result, configuration.usersDn());
        DirContext userContext = null;
        try {
            userContext = openAsUser(configuration, userDn, password);
            return toUser(result, configuration, userDn);
        } catch (AuthenticationException exception) {
            throw new BadCredentialsException("LDAP authentication failed", exception);
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP authentication failed", exception);
        } finally {
            close(userContext);
        }
    }

    public void updateUser(
            Configuration configuration, String distinguishedName, Map<String, String> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return;
        }
        DirContext context = null;
        try {
            context = open(configuration, false);
            ModificationItem[] changes =
                    attributes.entrySet().stream()
                            .map(
                                    entry -> {
                                        String attributeName = attribute(entry.getKey());
                                        BasicAttribute attribute =
                                                new BasicAttribute(attributeName);
                                        if (entry.getValue() != null
                                                && !entry.getValue().isBlank()) {
                                            attribute.add(entry.getValue());
                                        }
                                        int operation =
                                                entry.getValue() == null
                                                                || entry.getValue().isBlank()
                                                        ? DirContext.REMOVE_ATTRIBUTE
                                                        : DirContext.REPLACE_ATTRIBUTE;
                                        return new ModificationItem(operation, attribute);
                                    })
                            .toArray(ModificationItem[]::new);
            context.modifyAttributes(distinguishedName, changes);
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP user update failed", exception);
        } finally {
            close(context);
        }
    }

    public void updatePassword(
            Configuration configuration, String distinguishedName, String password) {
        requireSecureActiveDirectoryPasswordTransport(configuration);
        String attributeName =
                "ACTIVE_DIRECTORY".equals(configuration.vendor()) ? "unicodePwd" : "userPassword";
        DirContext context = null;
        try {
            context = open(configuration, false);
            BasicAttribute attribute = new BasicAttribute(attributeName);
            if ("ACTIVE_DIRECTORY".equals(configuration.vendor())) {
                attribute.add(
                        ('"' + password + '"')
                                .getBytes(java.nio.charset.StandardCharsets.UTF_16LE));
            } else {
                attribute.add(password);
            }
            context.modifyAttributes(
                    distinguishedName,
                    new ModificationItem[] {
                        new ModificationItem(DirContext.REPLACE_ATTRIBUTE, attribute)
                    });
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP password update failed", exception);
        } finally {
            close(context);
        }
    }

    public String registerUser(
            Configuration configuration,
            String username,
            String email,
            String firstName,
            String lastName,
            String password) {
        requireSecureActiveDirectoryPasswordTransport(configuration);
        DirContext context = null;
        try {
            context = open(configuration, false);
            String rdn = attribute(configuration.rdnAttribute()) + "=" + escapeDn(username);
            String distinguishedName = rdn + "," + configuration.usersDn();
            javax.naming.directory.BasicAttributes attributes =
                    new javax.naming.directory.BasicAttributes(true);
            BasicAttribute objectClasses = new BasicAttribute("objectClass");
            for (String objectClass : configuration.objectClasses().split(",")) {
                if (!objectClass.isBlank()) {
                    objectClasses.add(objectClass.trim());
                }
            }
            attributes.put(objectClasses);
            addAttribute(attributes, configuration.usernameAttribute(), username);
            addAttribute(attributes, configuration.emailAttribute(), email);
            addAttribute(attributes, configuration.firstNameAttribute(), firstName);
            addAttribute(attributes, configuration.lastNameAttribute(), lastName);
            if ("ACTIVE_DIRECTORY".equals(configuration.vendor())) {
                addBinaryAttribute(
                        attributes,
                        "unicodePwd",
                        ('"' + password + '"')
                                .getBytes(java.nio.charset.StandardCharsets.UTF_16LE));
                addAttribute(attributes, "userAccountControl", "512");
            } else {
                addAttribute(attributes, "userPassword", password);
            }
            context.createSubcontext(distinguishedName, attributes).close();
            return distinguishedName;
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP user registration failed", exception);
        } finally {
            close(context);
        }
    }

    public List<LdapUser> searchUsers(Configuration configuration) {
        return searchUsers(configuration, null);
    }

    public List<LdapUser> searchUsers(Configuration configuration, Instant changedSince) {
        DirContext context = null;
        try {
            context = open(configuration, false);
            SearchControls controls = new SearchControls();
            controls.setSearchScope(searchScope(configuration.searchScope()));
            controls.setCountLimit(configuration.batchSize());
            String filter = objectClassFilter(configuration.objectClasses());
            if (changedSince != null) {
                filter = changedUsersFilter(filter, changedSince);
            }
            List<LdapUser> users = new ArrayList<>();
            for (SearchResult result : searchUsers(context, configuration, filter, controls)) {
                users.add(
                        toUser(
                                result,
                                configuration,
                                distinguishedName(result, configuration.usersDn())));
            }
            return users;
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP user synchronization search failed", exception);
        } finally {
            close(context);
        }
    }

    private static List<SearchResult> searchUsers(
            DirContext context, Configuration configuration, String filter, SearchControls controls)
            throws NamingException {
        if (!(context instanceof LdapContext ldapContext) || configuration.batchSize() <= 0) {
            return collect(
                    context.search(configuration.usersDn(), filter, new Object[0], controls));
        }
        List<SearchResult> users = new ArrayList<>();
        byte[] cookie = null;
        try {
            do {
                try {
                    ldapContext.setRequestControls(
                            new Control[] {
                                new PagedResultsControl(
                                        configuration.batchSize(), cookie, Control.CRITICAL)
                            });
                } catch (IOException exception) {
                    NamingException namingException =
                            new NamingException("LDAP pagination control could not be created");
                    namingException.initCause(exception);
                    throw namingException;
                }
                users.addAll(
                        collect(
                                ldapContext.search(
                                        configuration.usersDn(), filter, new Object[0], controls)));
                cookie = null;
                Control[] responseControls = ldapContext.getResponseControls();
                if (responseControls != null) {
                    for (Control responseControl : responseControls) {
                        if (responseControl instanceof PagedResultsResponseControl response) {
                            cookie = response.getCookie();
                            break;
                        }
                    }
                }
            } while (cookie != null && cookie.length > 0);
        } finally {
            ldapContext.setRequestControls(null);
        }
        return users;
    }

    private static List<SearchResult> collect(NamingEnumeration<SearchResult> results)
            throws NamingException {
        List<SearchResult> values = new ArrayList<>();
        try {
            while (results.hasMore()) {
                values.add(results.next());
            }
        } finally {
            results.close();
        }
        return values;
    }

    public List<String> findGroups(
            Configuration configuration,
            String userDn,
            String groupSearchBase,
            String groupObjectClass,
            String groupNameAttribute,
            String groupMemberAttribute) {
        if (groupSearchBase == null
                || groupSearchBase.isBlank()
                || groupObjectClass == null
                || groupObjectClass.isBlank()) {
            return List.of();
        }
        DirContext context = null;
        try {
            context = open(configuration, false);
            SearchControls controls = new SearchControls();
            controls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            controls.setCountLimit(configuration.batchSize());
            controls.setReturningAttributes(new String[] {attribute(groupNameAttribute)});
            String filter = "(&(objectClass={0})(" + attribute(groupMemberAttribute) + "={1}))";
            NamingEnumeration<SearchResult> results =
                    context.search(
                            groupSearchBase,
                            filter,
                            new Object[] {groupObjectClass, userDn},
                            controls);
            List<String> names = new ArrayList<>();
            try {
                while (results.hasMore()) {
                    Attributes attributes = results.next().getAttributes();
                    String name = value(attributes, groupNameAttribute);
                    if (name != null && !name.isBlank()) {
                        names.add(name);
                    }
                }
            } finally {
                results.close();
            }
            return names;
        } catch (NamingException exception) {
            throw new IllegalStateException("LDAP group search failed", exception);
        } finally {
            close(context);
        }
    }

    private static SearchResult findUser(
            DirContext context, Configuration configuration, String identifier)
            throws NamingException {
        List<String> filterArguments = new ArrayList<>();
        StringBuilder filter = new StringBuilder("(&");
        for (String objectClass : configuration.objectClasses().split(",")) {
            if (!objectClass.isBlank()) {
                filter.append("(objectClass={").append(filterArguments.size()).append("})");
                filterArguments.add(objectClass.trim());
            }
        }
        filter.append("(|(")
                .append(attribute(configuration.usernameAttribute()))
                .append("={")
                .append(filterArguments.size())
                .append("})(")
                .append(attribute(configuration.emailAttribute()))
                .append("={")
                .append(filterArguments.size() + 1)
                .append("}))");
        filterArguments.add(identifier);
        filterArguments.add(identifier);
        filter.append(')');
        SearchControls controls = new SearchControls();
        controls.setSearchScope(searchScope(configuration.searchScope()));
        controls.setReturningAttributes(null);
        NamingEnumeration<SearchResult> results =
                context.search(
                        configuration.usersDn(),
                        filter.toString(),
                        filterArguments.toArray(),
                        controls);
        try {
            return results.hasMore() ? results.next() : null;
        } finally {
            try {
                results.close();
            } catch (NamingException exception) {
                LOGGER.debug("Could not close LDAP search results", exception);
            }
        }
    }

    private static String objectClassFilter(String objectClasses) {
        List<String> classes =
                java.util.Arrays.stream(objectClasses.split(","))
                        .map(String::trim)
                        .filter(value -> !value.isBlank())
                        .toList();
        if (classes.isEmpty()) {
            return "(objectClass=*)";
        }
        return "(&"
                + classes.stream()
                        .map(value -> "(objectClass=" + escapeFilter(value) + ")")
                        .collect(java.util.stream.Collectors.joining())
                + ")";
    }

    private static String changedUsersFilter(String objectClassFilter, Instant changedSince) {
        String timestamp = LDAP_GENERALIZED_TIME.format(changedSince);
        return "(&"
                + objectClassFilter
                + "(|(modifyTimestamp>="
                + timestamp
                + ")(whenChanged>="
                + timestamp
                + ")))";
    }

    private static String escapeFilter(String value) {
        return value.replace("\\", "\\5c")
                .replace("*", "\\2a")
                .replace("(", "\\28")
                .replace(")", "\\29");
    }

    private static LdapUser toUser(
            SearchResult result, Configuration configuration, String distinguishedName)
            throws NamingException {
        Attributes attributes = result.getAttributes();
        Map<String, List<String>> values = new LinkedHashMap<>();
        NamingEnumeration<? extends Attribute> all = attributes.getAll();
        try {
            while (all.hasMore()) {
                Attribute attribute = all.next();
                List<String> attributeValues = new ArrayList<>();
                NamingEnumeration<?> enumeration = attribute.getAll();
                try {
                    while (enumeration.hasMore()) {
                        Object value = enumeration.next();
                        attributeValues.add(stringValue(value));
                    }
                } finally {
                    enumeration.close();
                }
                values.put(attribute.getID(), List.copyOf(attributeValues));
            }
        } finally {
            all.close();
        }
        return new LdapUser(
                distinguishedName,
                value(attributes, configuration.uuidAttribute()),
                value(attributes, configuration.usernameAttribute()),
                value(attributes, configuration.emailAttribute()),
                value(attributes, configuration.firstNameAttribute()),
                value(attributes, configuration.lastNameAttribute()),
                Map.copyOf(values));
    }

    private static String stringValue(Object value) {
        if (value instanceof byte[] bytes) {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        }
        return Objects.toString(value, "");
    }

    private static void close(DirContext context) {
        if (context == null) {
            return;
        }
        try {
            context.close();
        } catch (NamingException exception) {
            LOGGER.debug("Could not close LDAP context", exception);
        }
    }

    private DirContext open(Configuration configuration, boolean user) throws NamingException {
        Hashtable<String, Object> environment = baseEnvironment(configuration);
        String principal = configuration.bindDn();
        String password = configuration.bindPassword();
        if (principal != null && !principal.isBlank()) {
            environment.put(
                    Context.SECURITY_AUTHENTICATION,
                    "KERBEROS".equals(configuration.authenticationType())
                            ? KERBEROS_AUTHENTICATION
                            : SIMPLE_AUTHENTICATION);
            environment.put(Context.SECURITY_PRINCIPAL, principal);
            if (!"KERBEROS".equals(configuration.authenticationType())) {
                environment.put(Context.SECURITY_CREDENTIALS, password == null ? "" : password);
            }
        }
        try {
            DirContext context = contextFactory.create(environment);
            negotiateStartTls(context, configuration);
            return context;
        } finally {
            CONFIGURED_SOCKET_FACTORY.remove();
        }
    }

    private DirContext openAsUser(Configuration configuration, String userDn, String password)
            throws NamingException {
        Hashtable<String, Object> environment = baseEnvironment(configuration);
        environment.put(
                Context.SECURITY_AUTHENTICATION,
                "KERBEROS".equals(configuration.authenticationType())
                        ? KERBEROS_AUTHENTICATION
                        : SIMPLE_AUTHENTICATION);
        environment.put(Context.SECURITY_PRINCIPAL, userDn);
        if (!"KERBEROS".equals(configuration.authenticationType())) {
            environment.put(Context.SECURITY_CREDENTIALS, password);
        }
        try {
            DirContext context = contextFactory.create(environment);
            negotiateStartTls(context, configuration);
            return context;
        } finally {
            CONFIGURED_SOCKET_FACTORY.remove();
        }
    }

    private static Hashtable<String, Object> baseEnvironment(Configuration configuration) {
        String url = configuration.connectionUrl();
        if (url == null || !url.matches("(?i)ldaps?://[^\\s]+")) {
            throw new IllegalArgumentException("LDAP URL must use ldap:// or ldaps://");
        }
        if (configuration.startTls() && !url.regionMatches(true, 0, "ldap://", 0, 7)) {
            throw new IllegalArgumentException("StartTLS requires an ldap:// URL");
        }
        Hashtable<String, Object> environment = new Hashtable<>();
        environment.put(Context.INITIAL_CONTEXT_FACTORY, LDAP_FACTORY);
        environment.put(Context.PROVIDER_URL, url);
        environment.put(
                Context.REFERRAL, configuration.referral().toLowerCase(java.util.Locale.ROOT));
        environment.put(
                "com.sun.jndi.ldap.connect.timeout",
                String.valueOf(configuration.connectTimeoutMs()));
        environment.put(
                "com.sun.jndi.ldap.read.timeout", String.valueOf(configuration.readTimeoutMs()));
        if (configuration.connectionPooling()) {
            environment.put("com.sun.jndi.ldap.connect.pool", "true");
        }
        if (configuration.trustStorePath() != null && !configuration.trustStorePath().isBlank()) {
            CONFIGURED_SOCKET_FACTORY.set(createSocketFactory(configuration));
            environment.put(
                    "java.naming.ldap.factory.socket", ConfiguredSslSocketFactory.class.getName());
        }
        return environment;
    }

    private static void negotiateStartTls(DirContext context, Configuration configuration)
            throws NamingException {
        if (!configuration.startTls()) {
            return;
        }
        if (!(context instanceof LdapContext ldapContext)) {
            throw new NamingException("LDAP context does not support StartTLS");
        }
        StartTlsResponse response =
                (StartTlsResponse) ldapContext.extendedOperation(new StartTlsRequest());
        try {
            SSLSocketFactory factory = CONFIGURED_SOCKET_FACTORY.get();
            if (factory == null) {
                response.negotiate();
            } else {
                response.negotiate(factory);
            }
        } catch (IOException exception) {
            NamingException namingException =
                    new NamingException("LDAP StartTLS negotiation failed");
            namingException.initCause(exception);
            throw namingException;
        }
    }

    private static SSLSocketFactory createSocketFactory(Configuration configuration) {
        try (InputStream input = Files.newInputStream(Path.of(configuration.trustStorePath()))) {
            KeyStore keyStore = KeyStore.getInstance(configuration.trustStoreType());
            keyStore.load(input, password(configuration.trustStorePassword()));
            TrustManagerFactory trustManagers =
                    TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trustManagers.init(keyStore);
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustManagers.getTrustManagers(), null);
            return sslContext.getSocketFactory();
        } catch (Exception exception) {
            throw new IllegalArgumentException("LDAP truststore could not be loaded", exception);
        }
    }

    private static char[] password(String value) {
        return value == null ? new char[0] : value.toCharArray();
    }

    private static String distinguishedName(SearchResult result, String usersDn) {
        String name = result.getNameInNamespace();
        if (name != null && !name.isBlank()) {
            return name;
        }
        return result.getName() + "," + usersDn;
    }

    private static String value(Attributes attributes, String attributeName)
            throws NamingException {
        Attribute attribute = attributes.get(attribute(attributeName));
        if (attribute == null || attribute.get() == null) {
            return "";
        }
        Object value = attribute.get();
        if (value instanceof byte[] bytes) {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        }
        return value.toString();
    }

    private static int searchScope(String value) {
        return switch (value) {
            case "OBJECT" -> SearchControls.OBJECT_SCOPE;
            case "ONE_LEVEL" -> SearchControls.ONELEVEL_SCOPE;
            case "SUBTREE" -> SearchControls.SUBTREE_SCOPE;
            default -> throw new IllegalArgumentException("Unsupported LDAP search scope");
        };
    }

    private static String attribute(String value) {
        if (value == null || !value.matches("[A-Za-z][A-Za-z0-9-]*")) {
            throw new IllegalArgumentException("Invalid LDAP attribute name");
        }
        return value;
    }

    private static void addAttribute(Attributes attributes, String name, String value) {
        if (value != null && !value.isBlank()) {
            attributes.put(new BasicAttribute(attribute(name), value));
        }
    }

    private static void addBinaryAttribute(Attributes attributes, String name, byte[] value) {
        attributes.put(new BasicAttribute(attribute(name), value));
    }

    private static void requireSecureActiveDirectoryPasswordTransport(Configuration configuration) {
        if ("ACTIVE_DIRECTORY".equals(configuration.vendor())
                && !configuration.startTls()
                && !configuration.connectionUrl().regionMatches(true, 0, "ldaps://", 0, 8)) {
            throw new IllegalArgumentException(
                    "Active Directory password operations require LDAPS or StartTLS");
        }
    }

    private static String escapeDn(String value) {
        return value.replace("\\", "\\\\").replace(",", "\\,").replace("+", "\\+");
    }

    @FunctionalInterface
    interface DirContextFactory {

        DirContext create(Hashtable<String, Object> environment) throws NamingException;
    }

    public record Configuration(
            String connectionUrl,
            String bindDn,
            String bindPassword,
            String usersDn,
            String usernameAttribute,
            String uuidAttribute,
            String emailAttribute,
            String firstNameAttribute,
            String lastNameAttribute,
            String rdnAttribute,
            String objectClasses,
            String searchScope,
            String vendor,
            String authenticationType,
            boolean startTls,
            String trustStorePath,
            String trustStorePassword,
            String trustStoreType,
            boolean connectionPooling,
            String referral,
            int connectTimeoutMs,
            int readTimeoutMs,
            int batchSize) {

        public Configuration(
                String connectionUrl,
                String bindDn,
                String bindPassword,
                String usersDn,
                String usernameAttribute,
                String uuidAttribute,
                String emailAttribute,
                String firstNameAttribute,
                String lastNameAttribute,
                String rdnAttribute,
                String objectClasses,
                String searchScope) {
            this(
                    connectionUrl,
                    bindDn,
                    bindPassword,
                    usersDn,
                    usernameAttribute,
                    uuidAttribute,
                    emailAttribute,
                    firstNameAttribute,
                    lastNameAttribute,
                    rdnAttribute,
                    objectClasses,
                    searchScope,
                    "LDAP",
                    "SIMPLE",
                    false,
                    null,
                    null,
                    "JKS",
                    false,
                    "THROW",
                    5000,
                    5000,
                    500);
        }
    }

    public static final class ConfiguredSslSocketFactory extends SSLSocketFactory {

        private final SSLSocketFactory delegateOverride;

        public ConfiguredSslSocketFactory() {
            this(null);
        }

        ConfiguredSslSocketFactory(SSLSocketFactory delegateOverride) {
            this.delegateOverride = delegateOverride;
        }

        private SSLSocketFactory delegate() {
            if (delegateOverride != null) {
                return delegateOverride;
            }
            SSLSocketFactory factory = CONFIGURED_SOCKET_FACTORY.get();
            return factory == null ? (SSLSocketFactory) SSLSocketFactory.getDefault() : factory;
        }

        @Override
        public String[] getDefaultCipherSuites() {
            return delegate().getDefaultCipherSuites();
        }

        @Override
        public String[] getSupportedCipherSuites() {
            return delegate().getSupportedCipherSuites();
        }

        @Override
        public Socket createSocket(Socket socket, String host, int port, boolean autoClose)
                throws IOException {
            return delegate().createSocket(socket, host, port, autoClose);
        }

        @Override
        public Socket createSocket(String host, int port) throws IOException {
            return delegate().createSocket(host, port);
        }

        @Override
        public Socket createSocket(
                String host, int port, java.net.InetAddress localHost, int localPort)
                throws IOException {
            return delegate().createSocket(host, port, localHost, localPort);
        }

        @Override
        public Socket createSocket(java.net.InetAddress host, int port) throws IOException {
            return delegate().createSocket(host, port);
        }

        @Override
        public Socket createSocket(
                java.net.InetAddress address,
                int port,
                java.net.InetAddress localAddress,
                int localPort)
                throws IOException {
            return delegate().createSocket(address, port, localAddress, localPort);
        }
    }

    public record LdapUser(
            String distinguishedName,
            String externalId,
            String username,
            String email,
            String firstName,
            String lastName,
            Map<String, List<String>> attributes) {

        public LdapUser(
                String distinguishedName,
                String externalId,
                String username,
                String email,
                String firstName,
                String lastName) {
            this(distinguishedName, externalId, username, email, firstName, lastName, Map.of());
        }

        public List<String> values(String attribute) {
            if (attribute == null) {
                return List.of();
            }
            return attributes.entrySet().stream()
                    .filter(entry -> entry.getKey().equalsIgnoreCase(attribute))
                    .findFirst()
                    .map(Map.Entry::getValue)
                    .orElse(List.of());
        }
    }
}
