# Security Notes

## Database exposure

An early deployment briefly published MySQL port `3306` to the internet. The
Compose configuration was corrected so MySQL has no host port mapping and is
reachable only on the private Compose network. The incident is documented as
a deployment correction; credentials used during the exposure must be rotated
and the database access logs reviewed after any recurrence.

## Secrets

Keep deployment credentials in the host's protected environment file and CI
secret store. Do not commit `.env` files, API keys, JWT signing keys, database
passwords, or private keys. Rotate a secret immediately after suspected
exposure, access revocation, or personnel changes affecting its custody. A
rotation includes updating the deployment secret, restarting dependent
services, and invalidating outstanding JWTs by changing `JWT_SECRET`.
`.env.example` values are placeholders only.

The current Git history contains no tracked `backend/.env`, frontend `.env`,
root `.env`, or `.env.local` file. The live JWT secret and certificate state
cannot be inspected from this checkout and must be checked on the host before
restoring the public link.

Older tracked Compose configuration did contain the literal values
`root_password` and `erp_password`. Treat both as publicly disclosed and never
reuse them for a deployment. The deployment host is not reachable from this
workspace, so rotation cannot be confirmed or performed here. Before restoring
public access, rotate the MySQL root password, application database password,
and JWT secret if any deployed service ever used those values.

## Reporting a vulnerability

Do not file exploitable details in a public issue. Use GitHub's private
security advisory flow for this repository, include affected versions and
reproduction steps, and avoid sharing real customer data or credentials.
