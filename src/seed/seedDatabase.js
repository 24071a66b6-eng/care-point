require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const LabResult = require('../models/LabResult');
const TeamMember = require('../models/TeamMember');
const Appointment = require('../models/Appointment');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const User = require('../models/User');

const daysFromNow = (days, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const samplePatients = [
  ['CP-DEMO-001', 'Olivia', 'Bennett', '1986-03-14', 'Female'],
  ['CP-DEMO-002', 'Ethan', 'Carter', '1974-11-02', 'Male'],
  ['CP-DEMO-003', 'Sofia', 'Ramirez', '1991-07-26', 'Female'],
  ['CP-DEMO-004', 'Noah', 'Williams', '1968-01-19', 'Male'],
  ['CP-DEMO-005', 'Ava', 'Thompson', '2000-09-08', 'Female'],
  ['CP-DEMO-006', 'Liam', 'Chen', '1980-05-30', 'Male'],
  ['CP-DEMO-007', 'Mia', 'Patel', '1995-12-11', 'Female'],
  ['CP-DEMO-008', 'Lucas', 'Morgan', '1959-04-04', 'Male']
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to seed the database.');
  if (!process.env.INITIAL_ADMIN_EMAIL || !process.env.INITIAL_ADMIN_PASSWORD) {
    throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required to create the demo administrator.');
  }
  if (process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters.');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const previous = await Patient.find({ patientNumber: /^CP-DEMO-/ }).select('_id');
  const patientIds = previous.map((patient) => patient._id);
  await Promise.all([
    Diagnosis.deleteMany({ patient: { $in: patientIds } }),
    LabResult.deleteMany({ patient: { $in: patientIds } }),
    Appointment.deleteMany({ patient: { $in: patientIds } }),
    Message.deleteMany({ patient: { $in: patientIds } })
  ]);
  await Patient.deleteMany({ patientNumber: /^CP-DEMO-/ });
  const teamDefinitions = [
    { name: 'Dr. Harper James', specialty: 'Primary care', email: 'harper.james@carepoint.example.test', phone: '(555) 010-1040', status: 'Available' },
    { name: 'Dr. Adrian Kim', specialty: 'Cardiology', email: 'adrian.kim@carepoint.example.test', phone: '(555) 010-1041', status: 'In clinic' },
    { name: 'Nurse Riley Brooks', specialty: 'Nursing', email: 'riley.brooks@carepoint.example.test', phone: '(555) 010-1042', status: 'Available' },
    { name: 'Dr. Maya Singh', specialty: 'Pediatrics', email: 'maya.singh@carepoint.example.test', phone: '(555) 010-1043', status: 'Away' }
  ];
  const team = await Promise.all(teamDefinitions.map((member) => TeamMember.findOneAndUpdate(
    { email: member.email },
    member,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  )));

  const patients = [];
  for (let index = 0; index < samplePatients.length; index += 1) {
    const [patientNumber, firstName, lastName, dateOfBirth, gender] = samplePatients[index];
    const vitals = Array.from({ length: 8 }, (_, point) => ({
      heartRate: 66 + ((index * 3 + point * 2) % 18),
      respiratoryRate: 13 + ((index + point) % 5),
      temperature: Number((36.4 + ((index + point) % 5) * 0.1).toFixed(1)),
      systolic: 112 + ((index * 2 + point * 3) % 20),
      diastolic: 72 + ((index + point * 2) % 12),
      recordedAt: daysFromNow(-point * 28, 9)
    }));
    patients.push(await Patient.create({
      patientNumber, firstName, lastName, dateOfBirth, gender,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@patient.example.test`,
      phone: `(555) 010-${String(2000 + index).slice(-4)}`,
      address: `${100 + index} Demo Avenue, Sample City`,
      insurance: { provider: ['Northstar Health', 'Community Care', 'Evergreen Plan'][index % 3], memberId: `DEMO-${index + 1}000` },
      vitals
    }));
  }

  const diagnoses = [];
  const labs = [];
  const messages = [];
  for (let index = 0; index < patients.length; index += 1) {
    const patient = patients[index];
    diagnoses.push({
      patient: patient._id,
      name: ['Seasonal allergies', 'Wellness follow-up', 'Migraine history', 'Routine monitoring'][index % 4],
      description: 'Fictional record included for application demonstration only.',
      status: index % 3 === 0 ? 'Monitoring' : 'Active',
      recordedAt: daysFromNow(-35 + index, 11)
    });
    labs.push({
      patient: patient._id,
      testName: ['Complete blood count', 'Lipid panel', 'Vitamin D', 'Basic metabolic panel'][index % 4],
      resultValue: ['Within sample range', 'Demo value', 'Pending review'][index % 3],
      unit: index % 2 ? 'mg/dL' : '—',
      referenceRange: 'Illustrative only',
      status: index % 3 === 2 ? 'Review' : 'In range',
      recordedAt: daysFromNow(-14 + index, 12)
    });
    messages.push({
      patient: patient._id,
      senderName: 'CarePoint Team',
      senderRole: 'staff',
      text: 'This is a fictional message thread for the software demonstration.'
    });
  }
  await Promise.all([
    Diagnosis.insertMany(diagnoses),
    LabResult.insertMany(labs),
    Message.insertMany(messages)
  ]);

  await Appointment.insertMany([
    { patient: patients[0]._id, teamMember: team[0]._id, scheduledAt: daysFromNow(0, 14), type: 'Annual wellness visit', status: 'Scheduled' },
    { patient: patients[1]._id, teamMember: team[1]._id, scheduledAt: daysFromNow(1, 9), type: 'Cardiology follow-up', status: 'Scheduled' },
    { patient: patients[2]._id, teamMember: team[2]._id, scheduledAt: daysFromNow(2, 11), type: 'Care coordination', status: 'Scheduled' },
    { patient: patients[3]._id, teamMember: team[0]._id, scheduledAt: daysFromNow(-2, 10), type: 'Routine check-in', status: 'Completed' },
    { patient: patients[4]._id, teamMember: team[3]._id, scheduledAt: daysFromNow(4, 13), type: 'Follow-up visit', status: 'Scheduled' }
  ]);

  await Promise.all([
    Notification.deleteMany({ title: { $in: ['Demo appointment reminder', 'Welcome to CarePoint'] } }),
    Activity.deleteMany({ action: { $regex: '^Demo:' } })
  ]);
  await Notification.insertMany([
    { title: 'Demo appointment reminder', message: 'A fictional appointment is scheduled for today.', type: 'appointment', read: false },
    { title: 'Welcome to CarePoint', message: 'Explore this fictional healthcare dashboard demo.', type: 'system', read: false }
  ]);
  await Activity.insertMany([
    { action: 'Demo: Patient profile added', detail: 'A fictional profile was added to the workspace.', type: 'patient' },
    { action: 'Demo: Lab result recorded', detail: 'Illustrative laboratory result for demonstration.', type: 'lab' },
    { action: 'Demo: Team roster updated', detail: 'Care team demonstration data initialized.', type: 'team' }
  ]);

  const email = process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email },
    { email, passwordHash, name: 'CarePoint Administrator', role: 'admin' },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Seeded ${patients.length} fictional patients, ${team.length} team members, and demo records.`);
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(`Seeding failed: ${error.message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
});
