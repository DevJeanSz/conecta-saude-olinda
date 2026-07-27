export const ACTIVE_APPOINTMENT_STATUSES = new Set(['SCHEDULED']);

export const isActiveAppointment = appointment =>
  ACTIVE_APPOINTMENT_STATUSES.has(appointment.status || 'SCHEDULED');

export const hasAppointmentConflict = (appointments, candidate, ignoreId = null) => {
  return appointments.some(appointment => {
    const apptDateStr = typeof appointment.date === 'string' ? appointment.date : 
      (appointment.date instanceof Date ? appointment.date.toISOString() : String(appointment.date));
    const candDateStr = typeof candidate.date === 'string' ? candidate.date :
      (candidate.date instanceof Date ? candidate.date.toISOString() : String(candidate.date));

    return appointment.id !== ignoreId &&
      appointment.doctor_id === candidate.doctorId &&
      apptDateStr.substring(0, 10) === candDateStr.substring(0, 10) &&
      appointment.time === candidate.time &&
      isActiveAppointment(appointment);
  });
};

export const nextQueuePassword = (appointments, isPriority, today) => {
  const prefix = isPriority ? 'P' : 'G';
  const count = appointments.filter(appointment =>
    appointment.date === today &&
    typeof appointment.queue_password === 'string' &&
    appointment.queue_password.startsWith(prefix)
  ).length + 1;

  return `${prefix}-${String(count).padStart(3, '0')}`;
};

export const canRoleAccessUnit = (role, userUnitId, userUnitIds, targetUnitId) => {
  if (['ADMIN', 'GENERAL_SUPERVISOR'].includes(role)) return true;
  if (!targetUnitId) return false;
  if (userUnitId === targetUnitId) return true;
  return Array.isArray(userUnitIds) && userUnitIds.includes(targetUnitId);
};

export const maskSus = value => {
  const clean = String(value || '').replace(/\D/g, '');
  if (clean.length < 7) return clean;
  return `${clean.slice(0, 3)}****${clean.slice(-4)}`;
};
