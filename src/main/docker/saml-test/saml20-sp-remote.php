<?php
$metadata['http://localhost:9090/saml2/service-provider-metadata/saml-e2e'] = [
    'AssertionConsumerService' => [[
        'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        'Location' => 'http://localhost:9090/login/saml2/sso/saml-e2e',
        'index' => 0,
    ]],
    'SingleLogoutService' => [[
        'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        'Location' => 'http://localhost:9090/logout/saml2/slo/saml-e2e',
    ]],
    'NameIDFormat' => 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    'authproc' => [
        10 => [
            'class' => 'saml:AttributeNameID',
            'attribute' => 'uid',
            'Format' => 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        ],
    ],
    'saml20.sign.response' => true,
    'saml20.sign.assertion' => true,
    'signature.algorithm' => 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
];
