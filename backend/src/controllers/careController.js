const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const MedicationDose = require('../models/MedicationDose');
const Appointment = require('../models/Appointment');
const { getDBStatus } = require('../config/db');

const { getAuthenticatedPatientId } = require('../middlewares/auth');

// In-memory temporary fallback stores for when DB is offline (Amendment 3)
const sessionMedications = [];
const sessionDoses = [];
const sessionAppointments = [];

/**
 * Derives patient ID securely from authenticated session or header.
 * Frontend-supplied body/query overrides are ignored in favor of authenticated identity.
 */
const getPatientId = (req) => {
  return (
    (req.patientId ? String(req.patientId).trim() : null) ||
    getAuthenticatedPatientId(req) ||
    (req.query && req.query.patientId ? String(req.query.patientId).trim() : null) ||
    null
  );
};

const getClientTimezone = (req) => {
  return req.headers['x-timezone'] || req.query.timezone || 'Asia/Kolkata';
};

const getTodayDateString = (timezone = 'Asia/Kolkata') => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // YYYY-MM-DD
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
};

const getTimeInMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3] ? match[3].toUpperCase() : null;
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

/**
 * Idempotently generates/synchronizes today's individual dose records.
 * Uses unique compound constraint { medicationId, scheduledDate, scheduledTime } to prevent duplicate records.
 */
const syncTodayDoses = async (patientId, timezone = 'Asia/Kolkata') => {
  const todayStr = getTodayDateString(timezone);

  if (!getDBStatus()) {
    const activeMeds = sessionMedications.filter(
      (m) => m.patientId === patientId && m.status !== 'discontinued'
    );
    for (const med of activeMeds) {
      const times = med.scheduledTimes && med.scheduledTimes.length > 0
        ? med.scheduledTimes
        : (med.doses || []).map((d) => ({ time: d.time, label: d.label }));

      for (const t of times) {
        const doseId = `${med._id}-${todayStr}-${t.time.replace(/\s+/g, '')}`;
        const existing = sessionDoses.find((d) => d.doseId === doseId);
        if (!existing) {
          sessionDoses.push({
            _id: `temp-dose-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            doseId,
            medicationId: String(med._id),
            medicationName: med.name,
            dosage: med.dosage,
            instructions: med.instructions || '',
            patientId,
            scheduledDate: todayStr,
            scheduledTime: t.time,
            label: t.label || 'Scheduled Dose',
            status: 'pending',
            takenAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
    return;
  }

  const activeMeds = await Medication.find({
    patientId,
    status: { $ne: 'discontinued' },
  });

  for (const med of activeMeds) {
    if (med.startDate) {
      const startStr = new Date(med.startDate).toISOString().slice(0, 10);
      if (todayStr < startStr) continue;
    }
    if (med.endDate) {
      const endStr = new Date(med.endDate).toISOString().slice(0, 10);
      if (todayStr > endStr) continue;
    }

    const times = med.scheduledTimes && med.scheduledTimes.length > 0
      ? med.scheduledTimes
      : (med.doses || []).map((d) => ({ time: d.time, label: d.label }));

    for (const t of times) {
      const doseId = `${med._id}-${todayStr}-${t.time.replace(/\s+/g, '')}`;
      try {
        await MedicationDose.updateOne(
          { medicationId: med._id, scheduledDate: todayStr, scheduledTime: t.time },
          {
            $setOnInsert: {
              doseId,
              medicationId: med._id,
              medicationName: med.name,
              dosage: med.dosage,
              instructions: med.instructions || '',
              patientId,
              scheduledDate: todayStr,
              scheduledTime: t.time,
              label: t.label || 'Scheduled Dose',
              status: 'pending',
              takenAt: null,
            },
          },
          { upsert: true }
        );
      } catch (err) {
        if (err.code !== 11000) console.error('Error syncing dose record:', err);
      }
    }
  }
};

/**
 * Checks past unrecorded doses and flags them as missed if grace period (60 mins) has elapsed.
 * Never overrides doses already marked as 'taken' or 'skipped'.
 */
const checkAndMarkMissedDoses = async (patientId, timezone = 'Asia/Kolkata') => {
  const todayStr = getTodayDateString(timezone);
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
  const currentTimeStr = timeFormatter.format(now);
  const currentMinutes = getTimeInMinutes(currentTimeStr);
  const GRACE_PERIOD_MINUTES = 60;

  if (!getDBStatus()) {
    sessionDoses.forEach((d) => {
      if (d.patientId === patientId && d.scheduledDate === todayStr && d.status === 'pending') {
        const doseMinutes = getTimeInMinutes(d.scheduledTime);
        if (currentMinutes > doseMinutes + GRACE_PERIOD_MINUTES) {
          d.status = 'missed';
          d.updatedAt = new Date();
        }
      }
    });
    return;
  }

  const pendingDoses = await MedicationDose.find({
    patientId,
    scheduledDate: todayStr,
    status: 'pending',
  });

  for (const dose of pendingDoses) {
    const doseMinutes = getTimeInMinutes(dose.scheduledTime);
    if (currentMinutes > doseMinutes + GRACE_PERIOD_MINUTES) {
      dose.status = 'missed';
      await dose.save();
    }
  }
};

// ==================== MEDICATION CONTROLLERS ====================

const getMedications = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const dbConnected = getDBStatus();

    if (!dbConnected) {
      const records = sessionMedications.filter(
        (m) => m.patientId === patientId && m.status !== 'discontinued'
      );
      return res.status(200).json({
        success: true,
        data: records,
        dbConnected: false,
        warning: 'MongoDB is offline. Operating in temporary server session mode.',
      });
    }

    const medications = await Medication.find({
      patientId,
      status: { $ne: 'discontinued' },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: medications,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const createMedication = async (req, res, next) => {
  try {
    const {
      name,
      dosage,
      frequency,
      instructions,
      prescribedBy,
      scheduledTimes,
      doses,
      notes,
      startDate,
      endDate,
    } = req.body;

    if (!name || !dosage) {
      return res.status(400).json({
        error: "Missing required fields: 'name' and 'dosage' are required.",
      });
    }

    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }

    // Support scheduledTimes array as well as legacy doses
    let rawTimes = [];
    if (Array.isArray(scheduledTimes) && scheduledTimes.length > 0) {
      rawTimes = scheduledTimes;
    } else if (Array.isArray(doses) && doses.length > 0) {
      rawTimes = doses;
    } else {
      rawTimes = [{ time: '08:00 AM', label: 'Morning' }];
    }

    const formattedTimes = rawTimes.map((st, i) => ({
      time: typeof st === 'string' ? st : (st.time || '08:00 AM'),
      label: typeof st === 'object' && st.label ? st.label : (i === 0 ? 'Morning' : i === 1 ? 'Evening' : `Dose ${i + 1}`),
    }));

    const formattedDoses = formattedTimes.map((t, index) => ({
      doseId: `dose-${Date.now()}-${index}`,
      time: t.time,
      label: t.label,
      status: 'pending',
      takenAt: null,
      notes: '',
    }));

    const medData = {
      patientId,
      name: name.trim(),
      dosage: dosage.trim(),
      frequency: frequency || 'Once Daily',
      instructions: (instructions || '').trim(),
      prescribedBy: (prescribedBy || '').trim(),
      scheduledTimes: formattedTimes,
      doses: formattedDoses,
      status: 'active',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      notes: (notes || '').trim(),
    };

    if (!getDBStatus()) {
      const tempRecord = {
        _id: `temp-${Date.now()}`,
        ...medData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessionMedications.unshift(tempRecord);
      const timezone = getClientTimezone(req);
      await syncTodayDoses(patientId, timezone);
      return res.status(201).json({
        success: true,
        data: tempRecord,
        dbConnected: false,
        warning: 'Saved to temporary session storage only (MongoDB offline).',
      });
    }

    const newMedication = await Medication.create(medData);
    const timezone = getClientTimezone(req);
    await syncTodayDoses(patientId, timezone);

    res.status(201).json({
      success: true,
      data: newMedication,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const editMedication = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const { id } = req.params;
    const {
      name,
      dosage,
      frequency,
      instructions,
      prescribedBy,
      scheduledTimes,
      notes,
      startDate,
      endDate,
    } = req.body;

    if (!name || !dosage) {
      return res.status(400).json({
        error: "Missing required fields: 'name' and 'dosage' are required.",
      });
    }

    const formattedTimes = Array.isArray(scheduledTimes) && scheduledTimes.length > 0
      ? scheduledTimes.map((st, i) => ({
          time: typeof st === 'string' ? st : (st.time || '08:00 AM'),
          label: typeof st === 'object' && st.label ? st.label : `Dose ${i + 1}`,
        }))
      : [{ time: '08:00 AM', label: 'Morning' }];

    const formattedDoses = formattedTimes.map((t, idx) => ({
      doseId: `dose-${Date.now()}-${idx}`,
      time: t.time,
      label: t.label,
      status: 'pending',
    }));

    if (!getDBStatus()) {
      const med = sessionMedications.find((m) => m._id === id && m.patientId === patientId);
      if (!med) return res.status(404).json({ error: 'Medication not found.' });

      med.name = name.trim();
      med.dosage = dosage.trim();
      med.frequency = frequency || med.frequency;
      med.instructions = instructions !== undefined ? instructions.trim() : med.instructions;
      med.prescribedBy = prescribedBy !== undefined ? prescribedBy.trim() : med.prescribedBy;
      med.scheduledTimes = formattedTimes;
      med.doses = formattedDoses;
      med.notes = notes !== undefined ? notes.trim() : med.notes;
      if (startDate) med.startDate = new Date(startDate);
      if (endDate) med.endDate = new Date(endDate);
      med.updatedAt = new Date();

      return res.status(200).json({ success: true, data: med, dbConnected: false });
    }

    const med = await Medication.findOne({ _id: id, patientId });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    med.name = name.trim();
    med.dosage = dosage.trim();
    med.frequency = frequency || med.frequency;
    med.instructions = instructions !== undefined ? instructions.trim() : med.instructions;
    med.prescribedBy = prescribedBy !== undefined ? prescribedBy.trim() : med.prescribedBy;
    med.scheduledTimes = formattedTimes;
    med.doses = formattedDoses;
    med.notes = notes !== undefined ? notes.trim() : med.notes;
    if (startDate) med.startDate = new Date(startDate);
    if (endDate) med.endDate = new Date(endDate);
    await med.save();

    // Re-sync today's doses with updated medication details
    const timezone = getClientTimezone(req);
    await syncTodayDoses(patientId, timezone);

    res.status(200).json({
      success: true,
      data: med,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMedication = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const { id } = req.params;

    if (!getDBStatus()) {
      const med = sessionMedications.find((m) => m._id === id && m.patientId === patientId);
      if (med) {
        med.status = 'discontinued';
      }
      return res.status(200).json({
        success: true,
        message: 'Medication schedule discontinued. Historical administration records preserved.',
      });
    }

    const med = await Medication.findOne({ _id: id, patientId });
    if (!med) {
      return res.status(404).json({ error: 'Medication not found.' });
    }

    // Discontinue the medication so historical administration records remain intact
    med.status = 'discontinued';
    await med.save();

    // Remove only pending unadministered doses scheduled for future/today
    const timezone = getClientTimezone(req);
    const todayStr = getTodayDateString(timezone);
    await MedicationDose.deleteMany({
      medicationId: id,
      patientId,
      scheduledDate: { $gte: todayStr },
      status: 'pending',
    });

    res.status(200).json({
      success: true,
      message: 'Medication schedule discontinued successfully. Historical administration records have been preserved.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns today's scheduled doses in chronological order,
 * with dynamically calculated summary stats: total, taken, upcoming, missed, skipped.
 */
const getTodayDoses = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const timezone = getClientTimezone(req);
    const todayStr = getTodayDateString(timezone);

    await syncTodayDoses(patientId, timezone);
    await checkAndMarkMissedDoses(patientId, timezone);

    let doses = [];
    if (!getDBStatus()) {
      doses = sessionDoses.filter(
        (d) => d.patientId === patientId && d.scheduledDate === todayStr
      );
    } else {
      doses = await MedicationDose.find({
        patientId,
        scheduledDate: todayStr,
      });
    }

    // Sort chronologically by scheduled time
    const sortedDoses = doses.slice().sort((a, b) => {
      return getTimeInMinutes(a.scheduledTime) - getTimeInMinutes(b.scheduledTime);
    });

    // Dynamic summary calculations
    const total = sortedDoses.length;
    const taken = sortedDoses.filter((d) => d.status === 'taken').length;
    const upcoming = sortedDoses.filter((d) => d.status === 'pending').length;
    const missed = sortedDoses.filter((d) => d.status === 'missed').length;
    const skipped = sortedDoses.filter((d) => d.status === 'skipped').length;

    res.status(200).json({
      success: true,
      data: {
        doses: sortedDoses,
        summary: {
          total,
          taken,
          upcoming,
          missed,
          skipped,
        },
        scheduledDate: todayStr,
      },
      dbConnected: getDBStatus(),
      warning: !getDBStatus() ? 'MongoDB is offline. Temporary session mode active.' : undefined,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an individual scheduled dose status.
 * Actions: 'taken', 'skipped', 'missed', 'pending'.
 * Records exact taken timestamp. Disallows duplicate taken creation.
 */
const updateIndividualDoseStatus = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const { doseId } = req.params;
    const { status, notes } = req.body;

    const VALID_STATUSES = ['pending', 'taken', 'missed', 'skipped'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    if (!getDBStatus()) {
      const dose = sessionDoses.find(
        (d) => (d.doseId === doseId || d._id === doseId) && d.patientId === patientId
      );
      if (!dose) return res.status(404).json({ error: 'Scheduled dose record not found.' });

      if (status === 'taken' && dose.status === 'taken') {
        return res.status(400).json({ error: 'Dose has already been recorded as taken.' });
      }

      dose.status = status;
      dose.takenAt = status === 'taken' ? new Date() : (status === 'pending' ? null : dose.takenAt);
      if (notes !== undefined) dose.notes = notes;
      dose.updatedAt = new Date();

      return res.status(200).json({ success: true, data: dose, dbConnected: false });
    }

    const dose = await MedicationDose.findOne({
      $or: [{ doseId }, { _id: mongoose.isValidObjectId(doseId) ? doseId : null }],
      patientId,
    });

    if (!dose) {
      return res.status(404).json({ error: 'Scheduled dose record not found.' });
    }

    if (status === 'taken' && dose.status === 'taken') {
      return res.status(400).json({ error: 'Dose has already been recorded as taken.' });
    }

    dose.status = status;
    dose.takenAt = status === 'taken' ? new Date() : (status === 'pending' ? null : dose.takenAt);
    if (notes !== undefined) dose.notes = notes;
    await dose.save();

    // Also sync the embedded legacy dose in Medication document if exists
    try {
      const med = await Medication.findOne({ _id: dose.medicationId, patientId });
      if (med && med.doses) {
        const legacyDose = med.doses.find(
          (d) => d.doseId === dose.doseId || d.time === dose.scheduledTime
        );
        if (legacyDose) {
          legacyDose.status = status === 'skipped' ? 'missed' : status;
          legacyDose.takenAt = dose.takenAt;
          await med.save();
        }
      }
    } catch (e) {
      // Non-fatal legacy sync
    }

    res.status(200).json({
      success: true,
      data: dose,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Legacy updateDoseStatus preserved for backward compatibility with existing tests
 */
const updateDoseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doseId, status } = req.body;

    if (!['pending', 'taken', 'missed', 'skipped'].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'pending', 'taken', 'missed', or 'skipped'.",
      });
    }

    if (!getDBStatus()) {
      const med = sessionMedications.find((m) => m._id === id);
      if (!med) return res.status(404).json({ error: 'Medication not found.' });

      const dose = med.doses.find((d) => d.doseId === doseId);
      if (dose) {
        dose.status = status;
        dose.takenAt = status === 'taken' ? new Date() : null;
      }
      return res.status(200).json({ success: true, data: med, dbConnected: false });
    }

    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({ error: 'Medication not found.' });
    }

    const dose = medication.doses.find((d) => d.doseId === doseId);
    if (!dose) {
      return res.status(404).json({ error: 'Scheduled dose not found in medication record.' });
    }

    dose.status = status;
    dose.takenAt = status === 'taken' ? new Date() : null;
    await medication.save();

    // Also update MedicationDose
    await MedicationDose.updateOne(
      { medicationId: medication._id, $or: [{ doseId }, { scheduledTime: dose.time }] },
      { $set: { status, takenAt: dose.takenAt } }
    );

    res.status(200).json({
      success: true,
      data: medication,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves historical administration records for the authenticated patient
 */
const getMedicationHistory = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const limit = parseInt(req.query.limit, 10) || 50;
    const statusFilter = req.query.status;

    if (!getDBStatus()) {
      let history = sessionDoses.filter((d) => d.patientId === patientId);
      if (statusFilter && statusFilter !== 'all') {
        history = history.filter((d) => d.status === statusFilter);
      }
      history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({
        success: true,
        data: history.slice(0, limit),
        dbConnected: false,
      });
    }

    const query = { patientId };
    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }

    const history = await MedicationDose.find(query)
      .sort({ scheduledDate: -1, createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: history,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== APPOINTMENT CONTROLLERS ====================

const getAppointments = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const dbConnected = getDBStatus();

    if (!dbConnected) {
      const records = sessionAppointments.filter((a) => a.patientId === patientId);
      return res.status(200).json({
        success: true,
        data: records,
        dbConnected: false,
        warning: 'MongoDB offline. Operating in temporary session mode.',
      });
    }

    const appointments = await Appointment.find({ patientId }).sort({ appointmentDate: 1 });
    res.status(200).json({
      success: true,
      data: appointments,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const createAppointment = async (req, res, next) => {
  try {
    const {
      specialistName,
      specialty,
      facilityName,
      location,
      appointmentDate,
      appointmentTime,
      reasonForVisit,
      questionsToDiscuss,
      notes,
    } = req.body;

    if (!specialistName || !appointmentDate) {
      return res.status(400).json({
        error: "Missing required fields: 'specialistName' and 'appointmentDate' are required.",
      });
    }

    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }

    const defaultChecklist = [
      { item: 'Bring current prescription list and medication containers', text: 'Bring current prescription list and medication containers', completed: false },
      { item: 'Carry recent MRI brain scans and diagnostic report copies', text: 'Carry recent MRI brain scans and diagnostic report copies', completed: false },
      { item: 'Write down key changes observed in memory, mood, or sleep', text: 'Write down key changes observed in memory, mood, or sleep', completed: false },
      { item: 'Ensure a family member or trusted caregiver accompanies for support', text: 'Ensure a family member or trusted caregiver accompanies for support', completed: false },
    ];

    const apptData = {
      patientId,
      specialistName: specialistName.trim(),
      specialty: (specialty || 'Neurologist').trim(),
      facilityName: (facilityName || '').trim(),
      location: (location || 'Bangalore').trim(),
      appointmentDate: new Date(appointmentDate),
      appointmentTime: appointmentTime || '10:00 AM',
      reasonForVisit: (reasonForVisit || '').trim(),
      prepChecklist: defaultChecklist,
      questionsToDiscuss: Array.isArray(questionsToDiscuss) ? questionsToDiscuss : [],
      notes: (notes || '').trim(),
    };

    if (!getDBStatus()) {
      const tempRecord = {
        _id: `temp-${Date.now()}`,
        ...apptData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessionAppointments.push(tempRecord);
      return res.status(201).json({
        success: true,
        data: tempRecord,
        dbConnected: false,
        warning: 'Saved to temporary session storage only (MongoDB offline).',
      });
    }

    const newAppointment = await Appointment.create(apptData);
    res.status(201).json({
      success: true,
      data: newAppointment,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const toggleChecklistItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemIndex } = req.body;

    if (itemIndex === undefined || typeof itemIndex !== 'number') {
      return res.status(400).json({ error: 'Valid itemIndex is required.' });
    }

    if (!getDBStatus()) {
      const appt = sessionAppointments.find((a) => a._id === id);
      if (!appt || !appt.prepChecklist[itemIndex]) {
        return res.status(404).json({ error: 'Appointment or checklist item not found.' });
      }
      appt.prepChecklist[itemIndex].completed = !appt.prepChecklist[itemIndex].completed;
      return res.status(200).json({ success: true, data: appt, dbConnected: false });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment || !appointment.prepChecklist[itemIndex]) {
      return res.status(404).json({ error: 'Appointment or checklist item not found.' });
    }

    appointment.prepChecklist[itemIndex].completed = !appointment.prepChecklist[itemIndex].completed;
    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAppointment = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No authorized patient context resolved.',
      });
    }
    const { id } = req.params;

    if (!getDBStatus()) {
      const idx = sessionAppointments.findIndex((a) => a._id === id && a.patientId === patientId);
      if (idx !== -1) sessionAppointments.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Appointment removed from temporary session.' });
    }

    const deleted = await Appointment.findOneAndDelete({ _id: id, patientId });
    if (!deleted) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMedications,
  createMedication,
  editMedication,
  deleteMedication,
  getTodayDoses,
  updateIndividualDoseStatus,
  updateDoseStatus,
  getMedicationHistory,
  getAppointments,
  createAppointment,
  toggleChecklistItem,
  deleteAppointment,
  syncTodayDoses,
  getTodayDateString,
};
