# Local OpenLDAP

The local LDAP fixture is intended for development and end-to-end testing only.

Start it from the repository root:

```powershell
docker compose -f src/main/docker/openldap.yml up -d
```

Connection settings for the application running on the host:

| Setting | Value |
| --- | --- |
| Connection URL | `ldap://localhost:1389` |
| Bind DN | `cn=admin,dc=example,dc=com` |
| Bind password | `admin` |
| Users DN | `ou=users,dc=example,dc=com` |
| Username attribute | `uid` |
| UUID attribute | `entryUUID` |
| Email attribute | `mail` |
| First name attribute | `givenName` |
| Last name attribute | `sn` |
| RDN attribute | `uid` |
| Object classes | `inetOrgPerson` |
| Search scope | `SUBTREE` |
| Edit mode | `WRITABLE` |

The seeded user is `ldap-user` with password `ldap-password`.

The fixture is intentionally ephemeral. The seed data is loaded when the container starts,
and removing the container removes the LDAP database as well. To reset the fixture:

```powershell
docker compose -f src/main/docker/openldap.yml down
```
