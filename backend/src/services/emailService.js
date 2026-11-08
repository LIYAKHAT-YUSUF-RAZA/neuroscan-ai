const nodemailer = require('nodemailer');
const {
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPassword,
  emailFrom,
  smtpSecure,
  nodeEnv,
} = require('../config/env');

// Check if SMTP is genuinely configured
const isSmtpConfigured = () => {
  if (
    (process.env.NODE_ENV === 'test' ||
      process.env.npm_lifecycle_event === 'test' ||
      process.argv.includes('--test')) &&
    !process.env.ENABLE_TEST_LIVE_SMTP
  ) {
    return false;
  }
  return Boolean(smtpHost && smtpUser && smtpPassword);
};

// Create Nodemailer transport if configured
let transporter = null;
if (isSmtpConfigured()) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

/**
 * Generate base responsive HTML layout with zero sensitive medical claims
 */
const renderEmailHtml = ({ title, preheader, contentHtml, safetyNoticeHtml }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #090e18; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; }
    .container { max-width: 580px; margin: 24px auto; background-color: #0e1526; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
    .header { padding: 20px 28px; background: linear-gradient(90deg, #090e18, #0e1526); border-bottom: 1px solid #1e293b; }
    .brand { font-size: 16px; font-weight: 800; letter-spacing: 0.05em; color: #22d3ee; text-transform: uppercase; }
    .brand-sub { font-size: 11px; color: #94a3b8; display: block; margin-top: 2px; }
    .body-content { padding: 28px; }
    .title { font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; }
    .card { background-color: #131b2e; border: 1px solid #1e293b; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .safety-banner { background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #fca5a5; line-height: 1.5; }
    .footer { padding: 20px 28px; background-color: #090e18; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <div class="container">
    <div class="header">
      <span class="brand">NeuroScan AI</span>
      <span class="brand-sub">Care Schedule & Adherence Notifications</span>
    </div>
    <div class="body-content">
      <h2 class="title">${title}</h2>
      ${contentHtml}
      ${
        safetyNoticeHtml
          ? `<div class="safety-banner">${safetyNoticeHtml}</div>`
          : ''
      }
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;">This automated reminder is sent based on preferences configured in NeuroScan AI.</p>
      <p style="margin: 0;">To update your notification settings or unsubscribe, visit the Medication Reminders or Settings section in your NeuroScan AI dashboard.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Dispatch an email with fallback handling for unconfigured environments
 */
const sendMail = async ({ to, subject, html, text }) => {
  if (!to || !to.includes('@')) {
    throw new Error('Invalid recipient email address.');
  }

  // If SMTP is genuinely configured, send via live transport
  if (isSmtpConfigured() && transporter) {
    try {
      const info = await transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        html,
        text: text || subject,
      });

      if (!info || (!info.messageId && (!info.accepted || info.accepted.length === 0))) {
        throw new Error('Email provider rejected message dispatch.');
      }

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
        simulated: false,
      };
    } catch (err) {
      console.error('[EmailService] SMTP delivery error:', err.message);
      throw err;
    }
  }

  // If in PRODUCTION and SMTP is not configured, reject with clear configuration error (Correction 8)
  if (nodeEnv === 'production') {
    const errorMsg = 'SMTP email service is not configured. Missing SMTP_HOST, SMTP_USER, or SMTP_PASSWORD in backend environment.';
    console.error(`[EmailService] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // In DEVELOPMENT mode, log simulated email dispatch safely
  console.log(`[EmailService DEV] Simulated email to: ${to} | Subject: "${subject}"`);
  return {
    success: true,
    messageId: `dev-simulated-${Date.now()}`,
    provider: 'simulated-dev',
    simulated: true,
  };
};

/**
 * Send Scheduled Medication Reminder
 */
const sendMedicationReminderEmail = async (to, { medicationName, dosage, scheduledTime, instructions, label }) => {
  const title = 'Medication Dose Reminder';
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      Your scheduled medication dose is due. Please follow the instructions provided by your qualified healthcare professional.
    </p>
    <div class="card">
      <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${medicationName}</div>
      <div style="font-size: 13px; color: #22d3ee; font-family: monospace; margin: 4px 0 8px 0;">
        Prescribed Dosage: ${dosage}
      </div>
      <div style="font-size: 13px; color: #94a3b8;">
        Scheduled Time: <strong style="color: #ffffff;">${scheduledTime}</strong> ${label ? `(${label})` : ''}
      </div>
      ${
        instructions
          ? `<div style="font-size: 12px; color: #cbd5e1; font-style: italic; margin-top: 8px; border-top: 1px solid #1e293b; padding-top: 8px;">Prescription Instructions: ${instructions}</div>`
          : ''
      }
    </div>
  `;

  const safetyNoticeHtml = `
    <strong>Important Safety Advisory:</strong> NeuroScan AI is a scheduling reminder tool, not a medical prescriber. Never take an extra, double, or altered dose. Take medicines strictly according to your clinician's prescription and pharmacy instructions.
  `;

  const text = `Medication Reminder: ${medicationName} (${dosage}) is scheduled for ${scheduledTime}.\nInstructions: ${instructions || 'Follow pharmacy label'}\n\nNever take a double dose. Follow your doctor's instructions.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Medication Reminder: ${medicationName} (${dosage}) at ${scheduledTime}`,
    html: renderEmailHtml({ title, preheader: `Medication due: ${medicationName} at ${scheduledTime}`, contentHtml, safetyNoticeHtml }),
    text,
  });
};

/**
 * Send Missed Dose Alert
 */
const sendMissedDoseEmail = async (to, { medicationName, dosage, scheduledTime, label }) => {
  const title = 'Missed Dose Notice';
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      A scheduled dose of <strong style="color:#ffffff;">${medicationName}</strong> (${dosage}) scheduled for ${scheduledTime} was not confirmed within the 60-minute window.
    </p>
    <div class="card">
      <div style="font-size: 14px; color: #fca5a5;">
        Scheduled: <strong>${scheduledTime}</strong> ${label ? `(${label})` : ''}
      </div>
      <div style="font-size: 13px; color: #cbd5e1; margin-top: 4px;">
        If you already took this dose, please log it in your NeuroScan AI dashboard to keep your history accurate.
      </div>
    </div>
  `;

  const safetyNoticeHtml = `
    <strong>Missed Dose Guidance:</strong> Never take a double dose or extra dose to make up for a missed one. If you have questions about a missed dose, follow the instructions on your prescription bottle or contact your prescribing physician or pharmacist.
  `;

  const text = `Missed Dose Notice: ${medicationName} (${dosage}) scheduled for ${scheduledTime} was not logged.\n\nNever double the next dose. Follow clinician instructions.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Missed Dose Notice: ${medicationName} (${scheduledTime})`,
    html: renderEmailHtml({ title, preheader: `Missed dose notice: ${medicationName}`, contentHtml, safetyNoticeHtml }),
    text,
  });
};

/**
 * Send Nutrition & Meal Reminder
 */
const sendNutritionReminderEmail = async (to, { mealType, time }) => {
  const mealName = mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1) : 'Meal';
  const title = `${mealName} Reminder`;
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      This is a reminder for your scheduled <strong>${mealName}</strong> at ${time}.
    </p>
    <div class="card">
      <div style="font-size: 13px; color: #cbd5e1;">
        Maintaining regular, consistent meal times supports daily routine structure and overall wellness.
      </div>
    </div>
  `;

  const safetyNoticeHtml = `
    <strong>Educational Disclaimer:</strong> Nutritional suggestions provide general wellness guidance and are not a clinical treatment or cure for cognitive conditions. Consult your doctor or dietitian for personalized clinical diets.
  `;

  const text = `Nutrition Reminder: Time for your scheduled ${mealName} at ${time}.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Nutrition Reminder: ${mealName} at ${time}`,
    html: renderEmailHtml({ title, preheader: `Time for your scheduled ${mealName}`, contentHtml, safetyNoticeHtml }),
    text,
  });
};

/**
 * Send Daily Care Routine Reminder
 */
const sendRoutineReminderEmail = async (to, { activityType, time }) => {
  const title = 'Daily Care Routine Reminder';
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      Time for your scheduled care routine activity: <strong style="color: #ffffff;">${activityType}</strong> (${time}).
    </p>
    <div class="card">
      <div style="font-size: 13px; color: #cbd5e1;">
        Consistent daily activities and gentle routines promote comfort and cognitive engagement.
      </div>
    </div>
  `;

  const text = `Daily Care Routine: Time for ${activityType} at ${time}.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Care Routine: ${activityType} at ${time}`,
    html: renderEmailHtml({ title, preheader: `Care routine: ${activityType}`, contentHtml }),
    text,
  });
};

/**
 * Send Appointment Reminder
 */
const sendAppointmentReminderEmail = async (to, { specialistName, specialty, facilityName, appointmentDate, appointmentTime, timingLabel }) => {
  const title = `Specialist Appointment Reminder (${timingLabel})`;
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      You have an upcoming medical consultation scheduled.
    </p>
    <div class="card">
      <div style="font-size: 16px; font-weight: 700; color: #ffffff;">${specialistName}</div>
      <div style="font-size: 13px; color: #22d3ee; margin: 4px 0 8px 0;">Specialty: ${specialty}</div>
      ${facilityName ? `<div style="font-size: 13px; color: #94a3b8;">Clinic/Facility: ${facilityName}</div>` : ''}
      <div style="font-size: 13px; color: #ffffff; margin-top: 8px;">
        Scheduled Date & Time: <strong>${appointmentDate} at ${appointmentTime}</strong>
      </div>
    </div>
  `;

  const text = `Appointment Reminder: Consultation with ${specialistName} on ${appointmentDate} at ${appointmentTime}.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Appointment Reminder: ${specialistName} on ${appointmentDate} at ${appointmentTime}`,
    html: renderEmailHtml({ title, preheader: `Upcoming appointment with ${specialistName}`, contentHtml }),
    text,
  });
};

/**
 * Send Test Notification Email
 */
const sendTestEmail = async (to, target = 'patient') => {
  const title = 'Test Email Notification';
  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      This confirms that email notifications for NeuroScan AI are active and configured correctly for <strong>${target}</strong>.
    </p>
    <div class="card">
      <div style="font-size: 13px; color: #10b981; font-weight: 600;">
        ✓ Automated delivery pipeline verified
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
        You will receive scheduled reminders for categories you have selected.
      </div>
    </div>
  `;

  const text = `NeuroScan AI: Test notification successfully delivered to ${to}.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] Test Notification: Verified Delivery`,
    html: renderEmailHtml({ title, preheader: 'Test notification verified', contentHtml }),
    text,
  });
};

/**
 * Stage-Specific Educational Profiles (4 Stages x 4 Rotating Topics)
 */
const STAGE_EDUCATIONAL_PROFILES = {
  1: {
    stageNumber: 1,
    canonicalClass: 'NonDemented',
    displayLabel: 'Healthy / No Dementia Detected',
    stageFocus: 'Wellness, Cognitive Reserve & Proactive Brain Health',
    topics: [
      {
        topicIndex: 0,
        topicTitle: 'Brain-Healthy Nutrition & Dietary Habits',
        educationalSummary:
          'Nutrition plays an essential role in long-term cellular health and cognitive vitality. Emphasizing colorful whole foods, leafy greens, antioxidant-rich berries, omega-3 fatty acids, and mindful daily hydration supports systemic cardiovascular and neurological wellness.',
        practicalTips: [
          'Incorporate colorful vegetables, legumes, nuts, and whole grains into daily meals.',
          'Stay consistently hydrated throughout the day with water and herbal infusions.',
          'Minimize ultra-processed foods, excess sodium, and refined sugars where practical.',
          'Discuss personalized dietary goals with your physician or a qualified clinical nutritionist.',
        ],
        resourceLinkText: 'Explore Stage 1 Nutrition Guidelines',
        resourceLinkRoute: '/nutrition',
      },
      {
        topicIndex: 1,
        topicTitle: 'Cardiovascular Fitness & Physical Activity',
        educationalSummary:
          'What is good for the heart is fundamentally good for the brain. Gentle, consistent aerobic exercise promotes healthy blood flow to cerebral tissues, stimulates neurotrophic factors, and supports mood and sleep regulation.',
        practicalTips: [
          'Aim for 30 minutes of moderate activity, such as brisk walking or swimming, most days.',
          'Include light stretching or balance exercises into morning or evening routines.',
          'Take active movement breaks if seated for prolonged periods during work or leisure.',
          'Consult your healthcare provider before starting new strenuous physical regimens.',
        ],
        resourceLinkText: 'View Daily Care Routines',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 2,
        topicTitle: 'Restful Sleep & Cognitive Restoration',
        educationalSummary:
          'Quality sleep enables the brain to clear metabolic waste products through the glymphatic system and consolidate daily learning and memories. Prioritizing consistent rest protects cognitive resilience.',
        practicalTips: [
          'Maintain consistent bedtimes and wake times, including on weekends.',
          'Create a calming evening routine: dim lights and avoid screen exposure 45 minutes before sleep.',
          'Keep the sleeping environment dark, quiet, and comfortably cool.',
          'Speak with a clinician if you experience chronic insomnia, restless sleep, or daytime fatigue.',
        ],
        resourceLinkText: 'Check Sleep Routine Suggestions',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 3,
        topicTitle: 'Lifelong Learning & Cognitive Reserve',
        educationalSummary:
          'Engaging in mentally stimulating challenges and social connection fosters neural resilience and neuroplasticity. Continuing to learn new concepts builds strong cognitive pathways over time.',
        practicalTips: [
          'Learn a new practical skill, language, musical instrument, or challenging puzzle.',
          'Stay socially active through community groups, family conversations, or shared hobbies.',
          'Read widely and discuss topics of interest with friends or family.',
          'Practice mindfulness or relaxation exercises to manage daily emotional stressors.',
        ],
        resourceLinkText: 'Browse Educational Modules',
        resourceLinkRoute: '/education',
      },
    ],
  },
  2: {
    stageNumber: 2,
    canonicalClass: 'VeryMildDemented',
    displayLabel: 'Early Stage',
    stageFocus: 'Memory Strategies, Predictable Routines & Early Evaluation',
    topics: [
      {
        topicIndex: 0,
        topicTitle: 'Effective Memory Strategies & External Aids',
        educationalSummary:
          'Incorporating organized external memory tools reduces cognitive load and builds confidence during daily tasks. Relying on structured systems empowers independence.',
        practicalTips: [
          'Place a centralized calendar, whiteboard, or planner in a high-visibility household area.',
          'Keep everyday essentials (glasses, keys, medication organizers) in designated, consistent spots.',
          'Use smartphone reminders or alarms for time-sensitive tasks and appointments.',
          'Break complex or multi-step tasks into simple written checklists.',
        ],
        resourceLinkText: 'Set Medication & Care Reminders',
        resourceLinkRoute: '/medications',
      },
      {
        topicIndex: 1,
        topicTitle: 'Creating Predictable, Comfortable Daily Routines',
        educationalSummary:
          'Predictability and structure simplify daily life, preserving energy for enjoyable and meaningful activities. Consistency fosters a sense of security and reduces daily stress.',
        practicalTips: [
          'Establish consistent times for waking, meals, medication, walks, and relaxation.',
          'Tackle mentally demanding activities earlier in the day when energy levels are highest.',
          'Allow generous time between tasks to avoid feelings of rush or time pressure.',
          'Balance activity with periods of quiet rest in a soothing home atmosphere.',
        ],
        resourceLinkText: 'Customize Daily Care Schedule',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 2,
        topicTitle: 'Meaningful Cognitive Engagement & Gentle Stimulation',
        educationalSummary:
          'Continuing enjoyable hobbies and creative pastimes encourages sustained cognitive engagement without causing frustration. Focus on positive enjoyment rather than perfection.',
        practicalTips: [
          'Participate in structured hobbies such as gardening, listening to music, or light crafts.',
          'Engage in conversation about pleasant past events, family photos, or favorite memories.',
          'Avoid high-pressure memory tests or quizzes that may trigger unneeded stress.',
          'Celebrate everyday accomplishments and maintain positive social relationships.',
        ],
        resourceLinkText: 'Explore Daily Activities',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 3,
        topicTitle: 'Reassurance, Proactive Planning & Clinical Partnership',
        educationalSummary:
          'Addressing cognitive changes early and collaboratively empowers individuals and families to plan thoughtfully. Early partnership with healthcare clinicians provides reassurance and clarity.',
        practicalTips: [
          'Maintain an open, supportive dialogue with trusted family members or friends.',
          'Schedule regular check-ins with your primary physician or neurologist.',
          'Prepare questions and note any daily changes before medical consultations.',
          'Remember that early proactive care focuses on wellness, independence, and support.',
        ],
        resourceLinkText: 'Consult Specialist Directory',
        resourceLinkRoute: '/specialists',
      },
    ],
  },
  3: {
    stageNumber: 3,
    canonicalClass: 'MildDemented',
    displayLabel: 'Moderate Stage',
    stageFocus: 'Assisted Daily Activities, Home Safety & Family Teamwork',
    topics: [
      {
        topicIndex: 0,
        topicTitle: 'Simplifying Everyday Tasks with Supportive Guidance',
        educationalSummary:
          'Breaking complex multi-step daily activities into single, clear steps helps preserve independence and self-confidence while ensuring safety and comfort.',
        practicalTips: [
          "Offer gentle step-by-step guidance rather than completing tasks entirely on the individual's behalf.",
          'Prepare clothing in the sequence it is put on to simplify morning dressing.',
          'Use visual cues and clear labels on cupboards and drawers for easy navigation.',
          'Keep communication encouraging, relaxed, and focused on one idea at a time.',
        ],
        resourceLinkText: 'Review Caregiver Recommendations',
        resourceLinkRoute: '/caregiver',
      },
      {
        topicIndex: 1,
        topicTitle: 'Safe & Comfortable Home Environments',
        educationalSummary:
          'Thoughtful modifications to the living space enhance comfort, decrease confusion, and reduce hazards. A secure home environment supports freedom of movement.',
        practicalTips: [
          'Ensure hallways, staircases, and living areas are well-lit throughout day and night.',
          'Remove loose rugs, clutter, and trailing electrical cords to prevent trips or slips.',
          'Install secure grab bars in bathrooms and consider non-slip shower mats.',
          'Keep frequently used items within comfortable, direct sight and reach.',
        ],
        resourceLinkText: 'View Home Safety Checklist',
        resourceLinkRoute: '/caregiver',
      },
      {
        topicIndex: 2,
        topicTitle: 'Gentle Activities & Meaningful Emotional Connection',
        educationalSummary:
          'Emotional connection and enjoyable shared experiences nurture dignity, joy, and peace of mind. Familiar sensory experiences often bring comfort and calm.',
        practicalTips: [
          'Enjoy familiar music, tactile crafts, or shared family photo albums together.',
          'Spend peaceful time outdoors in a garden or quiet park setting when comfortable.',
          'Validate feelings and emotions with warmth and reassurance if confusion arises.',
          'Prioritize shared moments of connection over perfect task execution.',
        ],
        resourceLinkText: 'View Routine Suggestions',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 3,
        topicTitle: 'Care Team Coordination & Routine Healthcare Check-ins',
        educationalSummary:
          'Close coordination among family members, caregivers, and medical specialists provides holistic support and timely adjustments to care routines.',
        practicalTips: [
          'Keep a shared log of daily routines, medication schedules, and clinical observations.',
          'Attend regular scheduled appointments with neurologists and geriatric specialists.',
          'Ensure emergency contact numbers and medical records are easily accessible.',
          'Involve caregivers and family members in discussions with healthcare professionals.',
        ],
        resourceLinkText: 'Manage Specialist Appointments',
        resourceLinkRoute: '/appointments',
      },
    ],
  },
  4: {
    stageNumber: 4,
    canonicalClass: 'ModerateDemented',
    displayLabel: 'Critical Stage',
    stageFocus: 'Home Safety, Fall Prevention, Comfort & Caregiver Support',
    topics: [
      {
        topicIndex: 0,
        topicTitle: 'Comprehensive Home Safety & Fall Prevention',
        educationalSummary:
          'Prioritizing home safety and proactive precautions helps prevent accidents and supports a tranquil, predictable living setting. Fall prevention is essential for comfort and well-being.',
        practicalTips: [
          'Install nightlights in bedrooms, hallways, and bathrooms to avoid nighttime disorientation.',
          'Ensure seating has sturdy armrests and stable foot support for comfortable resting.',
          'Keep walkways completely free of obstacles, uneven surfaces, and moisture.',
          'Ensure emergency medical information and caregiver contacts are prominently displayed.',
        ],
        resourceLinkText: 'View Safety & Support Guide',
        resourceLinkRoute: '/caregiver',
      },
      {
        topicIndex: 1,
        topicTitle: 'Sensory Comfort, Calming Routines & Reassurance',
        educationalSummary:
          'Creating a tranquil, familiar environment reduces sensory overload and supports emotional well-being. Calm routines and familiar sensory cues promote comfort.',
        practicalTips: [
          'Maintain a soft, soothing ambient environment with gentle lighting and low background noise.',
          'Use gentle, familiar melodies, soothing warmth, and comfortable clothing textures.',
          'Respond to signs of distress or restlessness with calm presence, touch, and comforting words.',
          'Follow consistent daily rhythms for waking, resting, meals, and sleep.',
        ],
        resourceLinkText: 'Check Calming Daily Routines',
        resourceLinkRoute: '/routine',
      },
      {
        topicIndex: 2,
        topicTitle: 'Caregiver Wellbeing, Self-Care & Support Systems',
        educationalSummary:
          'Supporting an individual with significant care needs requires caring for the caregivers themselves. Maintaining caregiver health is vital for the wellbeing of both patient and family.',
        practicalTips: [
          'Recognize caregiver fatigue early and take regular planned breaks through respite support.',
          'Connect with local dementia caregiver support groups and community organizations.',
          'Share caregiving responsibilities among family members or professional care providers.',
          'Consult healthcare social workers or elder care specialists for supportive resources.',
        ],
        resourceLinkText: 'Access Caregiver Support Resources',
        resourceLinkRoute: '/caregiver',
      },
      {
        topicIndex: 3,
        topicTitle: 'Collaborative Multidisciplinary Care Coordination',
        educationalSummary:
          "Partnering with qualified medical teams ensures personalized comfort, safety, and attentive clinical care aligned with the patient's individualized needs.",
        practicalTips: [
          'Coordinate regularly with primary physicians, neurologists, and allied health professionals.',
          'Review all prescription medications and comfort measures periodically with doctors.',
          'Maintain an updated list of current clinicians, emergency numbers, and care directives.',
          'Focus on individualized dignity, comfort, and attentive daily care.',
        ],
        resourceLinkText: 'View Specialist Directory',
        resourceLinkRoute: '/specialists',
      },
    ],
  },
};

/**
 * Retrieve stage-specific educational topic safely with modulo rotation
 */
const getStageEducationalContent = (stageNumber = 1, topicIndex = 0) => {
  const stageKey = [1, 2, 3, 4].includes(Number(stageNumber)) ? Number(stageNumber) : 1;
  const profile = STAGE_EDUCATIONAL_PROFILES[stageKey];
  const safeIndex = Math.abs(Number(topicIndex) || 0) % profile.topics.length;
  const topic = profile.topics[safeIndex];

  return {
    stageNumber: profile.stageNumber,
    canonicalClass: profile.canonicalClass,
    stageLabel: profile.displayLabel,
    stageFocus: profile.stageFocus,
    topicIndex: safeIndex,
    topicTitle: topic.topicTitle,
    educationalSummary: topic.educationalSummary,
    practicalTips: topic.practicalTips,
    resourceLinkText: topic.resourceLinkText,
    resourceLinkRoute: topic.resourceLinkRoute,
  };
};

/**
 * Send Weekly Personalized Educational Email
 */
const sendWeeklyEducationalEmail = async (
  to,
  {
    patientName,
    stageNumber,
    stageLabel,
    topicTitle,
    educationalSummary,
    practicalTips = [],
    resourceLinkText,
    resourceLinkRoute,
    isCaregiver = false,
  }
) => {
  const greeting = patientName
    ? `Dear ${patientName},`
    : isCaregiver
    ? 'Dear Family Member / Caregiver,'
    : 'Hello,';

  const title = isCaregiver
    ? `Caregiver Weekly Guide: ${topicTitle}`
    : `Weekly Care & Brain Health: ${topicTitle}`;

  const preheader = `Weekly Guidance: ${topicTitle} (Stage ${stageNumber} - ${stageLabel})`;

  const tipsHtml =
    Array.isArray(practicalTips) && practicalTips.length > 0
      ? `<div style="margin: 16px 0;">
          <div style="font-size: 13px; font-weight: 700; color: #22d3ee; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Practical Care Suggestions:</div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
            ${practicalTips.map((tip) => `<li style="margin-bottom: 6px;">${tip}</li>`).join('')}
          </ul>
        </div>`
      : '';

  const contentHtml = `
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
      ${greeting}
    </p>
    <div style="background-color: #131b2e; border-left: 4px solid #22d3ee; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px;">
      <span style="font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase;">Educational Guidance Profile:</span>
      <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Stage ${stageNumber} — ${stageLabel}</div>
    </div>
    <div class="card">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #ffffff;">${topicTitle}</h3>
      <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
        ${educationalSummary}
      </p>
      ${tipsHtml}
      ${
        resourceLinkText
          ? `<div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #1e293b; font-size: 12px; color: #94a3b8;">
              Helpful Dashboard Section: <strong style="color: #22d3ee;">${resourceLinkText}</strong>
            </div>`
          : ''
      }
    </div>
  `;

  const safetyNoticeHtml = `
    <strong>Educational Disclaimer:</strong> NeuroScan AI provides automated scheduling assistance and educational information only. This is not a clinical diagnosis, disease prognosis, or prescription. Always consult a qualified healthcare professional before altering medications, diets, or medical care.
  `;

  const text = `${title}\n${greeting}\n\nStage ${stageNumber} - ${stageLabel}\n\n${topicTitle}\n${educationalSummary}\n\nPractical Suggestions:\n${(
    practicalTips || []
  )
    .map((t, i) => `${i + 1}. ${t}`)
    .join(
      '\n'
    )}\n\nEducational Disclaimer: NeuroScan AI provides educational scheduling guidance only and does not provide medical diagnoses or prescriptions.`;

  return sendMail({
    to,
    subject: `[NeuroScan AI] ${title}`,
    html: renderEmailHtml({ title, preheader, contentHtml, safetyNoticeHtml }),
    text,
  });
};

module.exports = {
  isSmtpConfigured,
  sendMail,
  sendMedicationReminderEmail,
  sendMissedDoseEmail,
  sendNutritionReminderEmail,
  sendRoutineReminderEmail,
  sendAppointmentReminderEmail,
  sendTestEmail,
  sendWeeklyEducationalEmail,
  getStageEducationalContent,
  STAGE_EDUCATIONAL_PROFILES,
};

