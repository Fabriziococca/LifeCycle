'use strict';

const crypto = require('crypto');

const REGISTRATION_PASSWORD_MIN_LENGTH = 12;
const REGISTRATION_PASSWORD_MAX_LENGTH = 128;
const REGISTRATION_ACCESS_CODE_MAX_LENGTH = 256;

function hashRegistrationAccessCode(value) {
    if (typeof value !== 'string') return '';
    return crypto.createHash('sha256').update(value.trim(), 'utf8').digest('hex');
}

function isRegistrationAccessCodeHash(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function isInvitedRegistrationConfigured({ authAdmin, accessCodeHash }) {
    return Boolean(
        authAdmin
        && typeof authAdmin.createUser === 'function'
        && isRegistrationAccessCodeHash(accessCodeHash)
    );
}

function normalizeRegistrationEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateInvitedRegistrationInput({ email, password, accessCode }) {
    const normalizedEmail = normalizeRegistrationEmail(email);
    if (
        normalizedEmail.length > 254
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
        return { valid: false, message: 'Ingresá un correo electrónico válido.' };
    }

    if (
        typeof password !== 'string'
        || password.length < REGISTRATION_PASSWORD_MIN_LENGTH
        || password.length > REGISTRATION_PASSWORD_MAX_LENGTH
    ) {
        return {
            valid: false,
            message: `La contraseña debe tener entre ${REGISTRATION_PASSWORD_MIN_LENGTH} y ${REGISTRATION_PASSWORD_MAX_LENGTH} caracteres.`
        };
    }

    if (
        typeof accessCode !== 'string'
        || accessCode.trim().length < 8
        || accessCode.trim().length > REGISTRATION_ACCESS_CODE_MAX_LENGTH
    ) {
        return { valid: false, message: 'Ingresá un código de invitación válido.' };
    }

    return {
        valid: true,
        email: normalizedEmail,
        password,
        accessCode: accessCode.trim()
    };
}

function verifyRegistrationAccessCode(accessCode, expectedHash) {
    if (!isRegistrationAccessCodeHash(expectedHash)) return false;
    const actualHash = hashRegistrationAccessCode(accessCode);
    const expectedBuffer = Buffer.from(expectedHash.trim().toLowerCase(), 'hex');
    const actualBuffer = Buffer.from(actualHash, 'hex');
    return expectedBuffer.length === actualBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function createInvitedUser({ authAdmin, accessCodeHash, email, password, accessCode }) {
    if (!isInvitedRegistrationConfigured({ authAdmin, accessCodeHash })) {
        return {
            status: 503,
            body: { error: 'El registro por invitación no está disponible.' }
        };
    }

    const input = validateInvitedRegistrationInput({ email, password, accessCode });
    if (!input.valid) {
        return { status: 400, body: { error: input.message } };
    }

    if (!verifyRegistrationAccessCode(input.accessCode, accessCodeHash)) {
        return {
            status: 403,
            body: { error: 'El código de invitación no es válido.' }
        };
    }

    const { error } = await authAdmin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: { registration_source: 'lifecycle_invitation' }
    });

    if (error) {
        return {
            status: 400,
            body: {
                error: 'No se pudo crear la cuenta. Revisá los datos o pedí una invitación nueva.'
            },
            internalErrorCode: String(error.code || error.status || 'supabase_auth_error')
        };
    }

    return {
        status: 201,
        body: {
            success: true,
            message: 'Cuenta creada. Iniciando sesión...'
        }
    };
}

module.exports = {
    REGISTRATION_PASSWORD_MAX_LENGTH,
    REGISTRATION_PASSWORD_MIN_LENGTH,
    createInvitedUser,
    hashRegistrationAccessCode,
    isInvitedRegistrationConfigured,
    isRegistrationAccessCodeHash,
    normalizeRegistrationEmail,
    validateInvitedRegistrationInput,
    verifyRegistrationAccessCode
};
