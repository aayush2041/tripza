/**
 * Profile update request validator.
 * Enforces mass-assignment protection and data bounds.
 */

export function validateUpdateProfile(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  const sanitized = {};

  // 1. fullName
  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
      errors.push('Full name cannot be empty');
    } else {
      const trimmed = body.fullName.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        errors.push('Full name must be between 2 and 100 characters');
      } else {
        sanitized.fullName = trimmed;
      }
    }
  }

  // 2. bio
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      errors.push('Bio must be a string');
    } else if (body.bio.length > 500) {
      errors.push('Bio cannot exceed 500 characters');
    } else {
      sanitized.bio = body.bio.trim();
    }
  }

  // 3. homeCity
  if (body.homeCity !== undefined) {
    if (typeof body.homeCity !== 'string') {
      errors.push('Home city must be a string');
    } else if (body.homeCity.length > 100) {
      errors.push('Home city cannot exceed 100 characters');
    } else {
      sanitized.homeCity = body.homeCity.trim();
    }
  }

  // 4. travelInterests
  if (body.travelInterests !== undefined) {
    if (!Array.isArray(body.travelInterests)) {
      errors.push('Travel interests must be an array of strings');
    } else if (body.travelInterests.length > 20) {
      errors.push('Cannot provide more than 20 travel interests');
    } else {
      sanitized.travelInterests = body.travelInterests
        .filter((item) => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 50));
    }
  }

  // 5. languages
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages)) {
      errors.push('Languages must be an array of strings');
    } else if (body.languages.length > 10) {
      errors.push('Cannot provide more than 10 languages');
    } else {
      sanitized.languages = body.languages
        .filter((item) => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 50));
    }
  }

  // 6. profilePhotoUrl
  if (body.profilePhotoUrl !== undefined) {
    if (typeof body.profilePhotoUrl !== 'string') {
      errors.push('Profile photo URL must be a string');
    } else if (body.profilePhotoUrl.length > 2048) {
      errors.push('Profile photo URL cannot exceed 2048 characters');
    } else {
      sanitized.profilePhotoUrl = body.profilePhotoUrl.trim();
    }
  }

  // Explicitly note: any attempt to pass 'role', 'verification', 'user', 'email', 'accountStatus' is stripped!

  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized,
  };
}
