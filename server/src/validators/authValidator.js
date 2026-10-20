/**
 * Authentication request validation and normalization.
 */

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateRegister(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  // Mass assignment prevention: strictly pick allowed fields
  const rawFullName = body.fullName;
  const rawEmail = body.email;
  const rawPassword = body.password;

  // Validate fullName
  let fullName = '';
  if (typeof rawFullName !== 'string' || rawFullName.trim().length === 0) {
    errors.push('Full name is required');
  } else {
    fullName = rawFullName.trim();
    if (fullName.length < 2) errors.push('Full name must be at least 2 characters');
    if (fullName.length > 100) errors.push('Full name cannot exceed 100 characters');
  }

  // Validate & normalize email
  let email = '';
  if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
    errors.push('Email address is required');
  } else {
    email = rawEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      errors.push('Please provide a valid email address');
    }
  }

  // Validate password
  let password = '';
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    errors.push('Password is required');
  } else {
    password = rawPassword;
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password cannot exceed 128 characters');
    }
    // Baseline complexity check: at least 1 digit or special char and 1 letter
    if (!/[a-zA-Z]/.test(password) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one letter and at least one number or special character');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      fullName,
      email,
      password,
    },
  };
}

export function validateLogin(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  const rawEmail = body.email;
  const rawPassword = body.password;

  let email = '';
  if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
    errors.push('Email address is required');
  } else {
    email = rawEmail.trim().toLowerCase();
  }

  let password = '';
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    errors.push('Password is required');
  } else {
    password = rawPassword;
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      email,
      password,
    },
  };
}
