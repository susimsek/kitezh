# Local OpenLDAP

The local LDAP fixture is intended for development and end-to-end testing only.

Start it from the repository root:

```powershell
docker compose -f src/main/docker/services.yml up -d openldap
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

The seed data is loaded only when the LDAP volumes are created for the first time. To reset
the fixture, remove only the project volumes after confirming that no other data is stored in
them:

```powershell
docker compose -f src/main/docker/services.yml down -v
```
