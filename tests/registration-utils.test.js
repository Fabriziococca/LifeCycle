'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createInvitedUser,
    hashRegistrationAccessCode,
    isInvitedRegistrationConfigured,
    validateInvitedRegistrationInput,
    verifyRegistrationAccessCode
} = require('../registration-utils');

const ACCESS_CODE = 'QA-Invite-Example-2026';
const ACCESS_CODE_HASH = hashRegistrationAccessCode(ACCESS_CODE);

test('invitation codes are compared as SHA-256 digests', () => {
    assert.equal(ACCESS_CODE_HASH.length, 64);
    assert.equal(hashRegistrationAccessCode(`  ${ACCESS_CODE}  `), ACCESS_CODE_HASH);
    assert.equal(verifyRegistrationAccessCode(ACCESS_CODE, ACCESS_CODE_HASH), true);
    assert.equal(verifyRegistrationAccessCode('wrong-code', ACCESS_CODE_HASH), false);
});

test('invited registration validates email, password and invitation code', () => {
    const valid = validateInvitedRegistrationInput({
        email: ' Friend@Example.com ',
        password: 'a-secure-passphrase',
        accessCode: ACCESS_CODE
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.email, 'friend@example.com');

    assert.equal(validateInvitedRegistrationInput({
        email: 'invalid',
        password: 'a-secure-passphrase',
        accessCode: ACCESS_CODE
    }).valid, false);
    assert.equal(validateInvitedRegistrationInput({
        email: 'friend@example.com',
        password: 'short',
        accessCode: ACCESS_CODE
    }).valid, false);
});

test('registration is enabled only with an admin client and a valid hash', () => {
    const authAdmin = { createUser: async () => ({ error: null }) };
    assert.equal(isInvitedRegistrationConfigured({ authAdmin, accessCodeHash: ACCESS_CODE_HASH }), true);
    assert.equal(isInvitedRegistrationConfigured({ authAdmin: null, accessCodeHash: ACCESS_CODE_HASH }), false);
    assert.equal(isInvitedRegistrationConfigured({ authAdmin, accessCodeHash: 'plain-secret' }), false);
});

test('valid invitation creates an auto-confirmed user without returning sensitive data', async () => {
    let receivedPayload;
    const result = await createInvitedUser({
        authAdmin: {
            createUser: async payload => {
                receivedPayload = payload;
                return { data: { user: { id: 'qa-user-id' } }, error: null };
            }
        },
        accessCodeHash: ACCESS_CODE_HASH,
        email: 'friend@example.com',
        password: 'a-secure-passphrase',
        accessCode: ACCESS_CODE
    });

    assert.equal(result.status, 201);
    assert.deepEqual(receivedPayload, {
        email: 'friend@example.com',
        password: 'a-secure-passphrase',
        email_confirm: true,
        app_metadata: { registration_source: 'lifecycle_invitation' }
    });
    assert.equal(JSON.stringify(result.body).includes('qa-user-id'), false);
    assert.equal(JSON.stringify(result.body).includes(ACCESS_CODE), false);
});

test('invalid invitation never calls Supabase and account errors stay generic', async () => {
    let calls = 0;
    const authAdmin = {
        createUser: async () => {
            calls += 1;
            return { error: { code: 'email_exists', message: 'User already registered' } };
        }
    };

    const invalidCode = await createInvitedUser({
        authAdmin,
        accessCodeHash: ACCESS_CODE_HASH,
        email: 'friend@example.com',
        password: 'a-secure-passphrase',
        accessCode: 'wrong-code'
    });
    assert.equal(invalidCode.status, 403);
    assert.equal(calls, 0);

    const providerError = await createInvitedUser({
        authAdmin,
        accessCodeHash: ACCESS_CODE_HASH,
        email: 'friend@example.com',
        password: 'a-secure-passphrase',
        accessCode: ACCESS_CODE
    });
    assert.equal(providerError.status, 400);
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(providerError.body).includes('already registered'), false);
});
