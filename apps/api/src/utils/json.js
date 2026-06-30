function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function jsonArray(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, null);
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
    return JSON.stringify(value ? [value] : []);
  }
  return JSON.stringify([]);
}

function jsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, null);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return JSON.stringify(parsed);
  }
  return JSON.stringify({});
}

function hydratePatient(patient) {
  if (!patient) return patient;
  return {
    ...patient,
    preferences: safeJsonParse(patient.preferences, []),
    restrictions: safeJsonParse(patient.restrictions, []),
    allergies: safeJsonParse(patient.allergies, []),
    currentDietPlan: hydrateDietPlan(patient.currentDietPlan)
  };
}

function hydrateDietPlan(plan) {
  if (!plan) return plan;
  return {
    ...plan,
    restrictions: safeJsonParse(plan.restrictions, []),
    allergies: safeJsonParse(plan.allergies, [])
  };
}

function hydratePrescription(prescription) {
  if (!prescription) return prescription;
  return {
    ...prescription,
    restrictions: safeJsonParse(prescription.restrictions, []),
    allergies: safeJsonParse(prescription.allergies, []),
    dietPlan: hydrateDietPlan(prescription.dietPlan),
    patient: hydratePatient(prescription.patient)
  };
}

function hydrateNotification(notification) {
  if (!notification) return notification;
  return {
    ...notification,
    metadata: safeJsonParse(notification.metadata, {})
  };
}

module.exports = {
  safeJsonParse,
  jsonArray,
  jsonObject,
  hydratePatient,
  hydrateDietPlan,
  hydratePrescription,
  hydrateNotification
};
