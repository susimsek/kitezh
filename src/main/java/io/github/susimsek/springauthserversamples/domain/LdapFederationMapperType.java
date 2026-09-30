package io.github.susimsek.springauthserversamples.domain;

/** Mapper types supported by the application-wide LDAP federation provider. */
public enum LdapFederationMapperType {
    USER_ATTRIBUTE,
    FULL_NAME,
    HARDCODED_ATTRIBUTE,
    ROLE,
    GROUP,
    HARDCODED_ROLE,
    MSAD_USER_ACCOUNT,
    CERTIFICATE
}
