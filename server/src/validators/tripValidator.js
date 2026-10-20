/**
 * Trip creation and update validation schemas.
 * Enforces strict field whitelisting and mass-assignment prevention.
 */

const VALID_CATEGORIES = new Set([
  'trekking',
  'hiking',
  'backpacking',
  'road trip',
  'weekend getaway',
  'sightseeing',
  'camping',
  'other',
]);

const VALID_JOIN_POLICIES = new Set(['approval_required', 'direct_join']);

export function validateTripInput(body, isUpdate = false) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be a JSON object'] };
  }

  const sanitized = {};

  // 1. title
  if (!isUpdate || body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('Trip title is required');
    } else {
      const trimmed = body.title.trim();
      if (trimmed.length < 3) errors.push('Trip title must be at least 3 characters');
      if (trimmed.length > 120) errors.push('Trip title cannot exceed 120 characters');
      sanitized.title = trimmed;
    }
  }

  // 2. description
  if (!isUpdate || body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.trim().length === 0) {
      errors.push('Trip description is required');
    } else {
      const trimmed = body.description.trim();
      if (trimmed.length < 10) errors.push('Trip description must be at least 10 characters');
      if (trimmed.length > 3000) errors.push('Trip description cannot exceed 3000 characters');
      sanitized.description = trimmed;
    }
  }

  // 3. startingCity
  if (!isUpdate || body.startingCity !== undefined) {
    if (typeof body.startingCity !== 'string' || body.startingCity.trim().length === 0) {
      errors.push('Starting city is required');
    } else {
      sanitized.startingCity = body.startingCity.trim().slice(0, 100);
    }
  }

  // 4. meetingPoint
  if (!isUpdate || body.meetingPoint !== undefined) {
    if (typeof body.meetingPoint !== 'string' || body.meetingPoint.trim().length === 0) {
      errors.push('Meeting point is required');
    } else {
      sanitized.meetingPoint = body.meetingPoint.trim().slice(0, 200);
    }
  }

  // 5. destination
  if (!isUpdate || body.destination !== undefined) {
    if (typeof body.destination !== 'string' || body.destination.trim().length === 0) {
      errors.push('Destination is required');
    } else {
      sanitized.destination = body.destination.trim().slice(0, 100);
    }
  }

  // 6. intermediateStops
  if (body.intermediateStops !== undefined) {
    if (!Array.isArray(body.intermediateStops)) {
      errors.push('Intermediate stops must be an array of strings');
    } else {
      sanitized.intermediateStops = body.intermediateStops
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 100))
        .slice(0, 15);
    }
  }

  // 7. Dates: startDate & endDate
  let parsedStartDate = null;
  let parsedEndDate = null;

  if (!isUpdate || body.startDate !== undefined) {
    parsedStartDate = new Date(body.startDate);
    if (isNaN(parsedStartDate.getTime())) {
      errors.push('A valid start date is required');
    } else {
      sanitized.startDate = parsedStartDate;
    }
  }

  if (!isUpdate || body.endDate !== undefined) {
    parsedEndDate = new Date(body.endDate);
    if (isNaN(parsedEndDate.getTime())) {
      errors.push('A valid end date is required');
    } else {
      sanitized.endDate = parsedEndDate;
    }
  }

  if (sanitized.startDate && sanitized.endDate) {
    if (sanitized.endDate < sanitized.startDate) {
      errors.push('End date must be on or after the start date');
    }
  }

  // 8. category
  if (!isUpdate || body.category !== undefined) {
    if (!body.category || !VALID_CATEGORIES.has(body.category.toLowerCase())) {
      errors.push(
        `Category must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}`
      );
    } else {
      sanitized.category = body.category.toLowerCase();
    }
  }

  // 9. budget
  if (!isUpdate || body.budget !== undefined) {
    const rawBudget = body.budget;
    if (!rawBudget || typeof rawBudget !== 'object') {
      errors.push('Budget details are required');
    } else {
      const amount = Number(rawBudget.amount);
      if (isNaN(amount) || amount < 0) {
        errors.push('Budget amount must be a positive number or zero');
      } else {
        const included = Array.isArray(rawBudget.included)
          ? rawBudget.included.filter((i) => typeof i === 'string' && i.trim().length > 0).map((i) => i.trim().slice(0, 100))
          : [];
        const excluded = Array.isArray(rawBudget.excluded)
          ? rawBudget.excluded.filter((e) => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim().slice(0, 100))
          : [];

        sanitized.budget = {
          amount,
          currency: 'INR',
          included,
          excluded,
        };
      }
    }
  }

  // 10. maxGroupSize
  if (!isUpdate || body.maxGroupSize !== undefined) {
    const size = parseInt(body.maxGroupSize, 10);
    if (isNaN(size) || size < 2 || size > 50) {
      errors.push('Maximum group size must be an integer between 2 and 50');
    } else {
      sanitized.maxGroupSize = size;
    }
  }

  // 11. joinPolicy
  if (body.joinPolicy !== undefined) {
    if (!VALID_JOIN_POLICIES.has(body.joinPolicy)) {
      errors.push("Join policy must be either 'approval_required' or 'direct_join'");
    } else {
      sanitized.joinPolicy = body.joinPolicy;
    }
  } else if (!isUpdate) {
    sanitized.joinPolicy = 'approval_required';
  }

  // 12. itinerary
  if (body.itinerary !== undefined) {
    if (!Array.isArray(body.itinerary)) {
      errors.push('Itinerary must be an array of days');
    } else {
      sanitized.itinerary = body.itinerary
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => {
          const text = (typeof item.activities === 'string' && item.activities.trim())
            || (typeof item.description === 'string' && item.description.trim())
            || '';
          const fallbackText = text.slice(0, 1000) || 'Activities planned for the day';
          return {
            day: parseInt(item.day, 10) || index + 1,
            title: typeof item.title === 'string' ? item.title.trim().slice(0, 120) : `Day ${index + 1}`,
            activities: fallbackText,
            description: fallbackText,
          };
        });
    }
  }

  // 13. status (draft vs published)
  if (body.status !== undefined) {
    if (!['draft', 'published'].includes(body.status)) {
      errors.push("Initial status must be either 'draft' or 'published'");
    } else {
      sanitized.status = body.status;
    }
  }

  // Explicitly note: 'approvedMembersCount', 'organiser', '_id' are NOT allowed in sanitized data.

  return {
    isValid: errors.length === 0,
    errors,
    data: sanitized,
  };
}

/**
 * Sanitizes and validates query parameters for trip discovery.
 * Prevents arbitrary Mongo operator injection.
 */
export function validateDiscoveryQuery(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));

  const clean = {
    page,
    limit,
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '',
    destination: typeof query.destination === 'string' ? query.destination.trim().slice(0, 100) : '',
    startingCity: typeof query.startingCity === 'string' ? query.startingCity.trim().slice(0, 100) : '',
    category: typeof query.category === 'string' && VALID_CATEGORIES.has(query.category.toLowerCase())
      ? query.category.toLowerCase()
      : '',
    minBudget: !isNaN(Number(query.minBudget)) && Number(query.minBudget) >= 0 ? Number(query.minBudget) : null,
    maxBudget: !isNaN(Number(query.maxBudget)) && Number(query.maxBudget) >= 0 ? Number(query.maxBudget) : null,
    startDateFrom: query.startDateFrom && !isNaN(new Date(query.startDateFrom).getTime()) ? new Date(query.startDateFrom) : null,
    startDateTo: query.startDateTo && !isNaN(new Date(query.startDateTo).getTime()) ? new Date(query.startDateTo) : null,
    availableSpots: query.availableSpots === 'true' || query.availableSpots === true,
    sort: ['soonest', 'newest', 'budget_low', 'budget_high'].includes(query.sort) ? query.sort : 'soonest',
  };

  return clean;
}
