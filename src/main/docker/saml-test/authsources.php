<?php
// Development credentials only; the fixture listens on loopback.
$config = [
    'admin' => ['core:AdminPassword'],
    'example-userpass' => [
        'exampleauth:UserPass',
        'user1:password' => [
            'uid' => ['user1'],
            'email' => ['user1@example.com'],
            'givenName' => ['Test'],
            'sn' => ['One'],
        ],
        'user2:password' => [
            'uid' => ['user2'],
            'email' => ['user2@example.com'],
            'givenName' => ['Test'],
            'sn' => ['Two'],
        ],
    ],
];
