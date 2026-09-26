package io.github.susimsek.springauthserversamples.service;

import java.util.ArrayList;
import java.util.Base64;
import java.util.Hashtable;
import java.util.List;
import java.util.Map;
import javax.naming.AuthenticationException;
import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.BasicAttribute;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import javax.naming.directory.ModificationItem;
import javax.naming.directory.SearchControls;
import javax.naming.directory.SearchResult;
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
    private static final String CONNECT_TIMEOUT = "5000";
    private static final String SIMPLE_AUTHENTICATION = "simple";

    private final DirContextFactory contextFactory;

    @Autowired
    public LdapDirectoryClient() {
        this(InitialDirContext::new);
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
            return new LdapUser(
                    userDn,
                    value(result.getAttributes(), configuration.uuidAttribute()),
                    value(result.getAttributes(), configuration.usernameAttribute()),
                    value(result.getAttributes(), configuration.emailAttribute()),
                    value(result.getAttributes(), configuration.firstNameAttribute()),
                    value(result.getAttributes(), configuration.lastNameAttribute()));
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
        controls.setReturningAttributes(
                new String[] {
                    configuration.uuidAttribute(),
                    configuration.usernameAttribute(),
                    configuration.emailAttribute(),
                    configuration.firstNameAttribute(),
                    configuration.lastNameAttribute()
                });
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
        Hashtable<String, Object> environment = baseEnvironment(configuration.connectionUrl());
        String principal = configuration.bindDn();
        String password = configuration.bindPassword();
        if (!user && principal != null && !principal.isBlank()) {
            environment.put(Context.SECURITY_AUTHENTICATION, SIMPLE_AUTHENTICATION);
            environment.put(Context.SECURITY_PRINCIPAL, principal);
            environment.put(Context.SECURITY_CREDENTIALS, password == null ? "" : password);
        }
        return contextFactory.create(environment);
    }

    private DirContext openAsUser(Configuration configuration, String userDn, String password)
            throws NamingException {
        Hashtable<String, Object> environment = baseEnvironment(configuration.connectionUrl());
        environment.put(Context.SECURITY_AUTHENTICATION, SIMPLE_AUTHENTICATION);
        environment.put(Context.SECURITY_PRINCIPAL, userDn);
        environment.put(Context.SECURITY_CREDENTIALS, password);
        return contextFactory.create(environment);
    }

    private static Hashtable<String, Object> baseEnvironment(String url) {
        if (url == null || !url.matches("(?i)ldaps?://[^\\s]+")) {
            throw new IllegalArgumentException("LDAP URL must use ldap:// or ldaps://");
        }
        Hashtable<String, Object> environment = new Hashtable<>();
        environment.put(Context.INITIAL_CONTEXT_FACTORY, LDAP_FACTORY);
        environment.put(Context.PROVIDER_URL, url);
        environment.put(Context.REFERRAL, "throw");
        environment.put("com.sun.jndi.ldap.connect.timeout", CONNECT_TIMEOUT);
        environment.put("com.sun.jndi.ldap.read.timeout", CONNECT_TIMEOUT);
        return environment;
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
            String searchScope) {}

    public record LdapUser(
            String distinguishedName,
            String externalId,
            String username,
            String email,
            String firstName,
            String lastName) {}
}
