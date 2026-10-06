#!/bin/sh
set -eu
cd /var/www/simplesamlphp/cert
if [ ! -s server.pem ] || [ ! -s server.crt ] || ! openssl x509 -in server.crt -checkend 0 -noout; then
  umask 077
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 365 \
    -subj '/CN=SimpleSAMLphp local test IdP' -keyout server.pem -out server.crt
fi
openssl x509 -in server.crt -checkend 0 -noout
chmod 644 server.crt
chmod 600 server.pem
chown www-data:www-data server.pem
# The upstream demo enables DEBUG, which includes complete assertions in logs.
sed -i "s/'logging.level' => SimpleSAML_Logger::DEBUG/'logging.level' => SimpleSAML_Logger::WARNING/" /var/www/simplesamlphp/config/config.php
exec apache2-foreground
