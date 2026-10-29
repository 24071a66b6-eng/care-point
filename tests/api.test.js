process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Patient = require('../src/models/Patient');
const TeamMember = require('../src/models/TeamMember');
const Appointment = require('../src/models/Appointment');

let mongo;
let token;
let patient;
let teamMember;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.create({
    email: 'admin@example.test',
    name: 'Test Admin',
    role: 'admin',
    passwordHash: await bcrypt.hash('test-password-123', 4)
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'admin@example.test',
    password: 'test-password-123'
  });
  assert.equal(login.status, 200);
  token = login.body.data.token;
  patient = await Patient.create({
    patientNumber: 'TEST-001',
    firstName: 'Fictional',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    gender: 'Unspecified',
    vitals: [{ heartRate: 70, respiratoryRate: 16, temperature: 36.8, systolic: 120, diastolic: 80, recordedAt: new Date() }]
  });
  teamMember = await TeamMember.create({
    name: 'Demo Clinician',
    specialty: 'Primary care',
    email: 'clinician@example.test'
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const authorized = () => ({ Authorization: `Bearer ${token}` });

test('health endpoint reports database connection state', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.database, 'connected');
});

test('private endpoints require authentication and unknown API routes return JSON 404', async () => {
  const config = await request(app).get('/api/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.data.publicDemo, false);
  const privateResponse = await request(app).get('/api/patients');
  assert.equal(privateResponse.status, 401);
  const unknown = await request(app).get('/api/not-a-route');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'NOT_FOUND');
});

test('public demo mode allows the demo role without changing the secure default', async () => {
  process.env.PUBLIC_DEMO_MODE = 'true';
  try {
    const config = await request(app).get('/api/config');
    assert.equal(config.body.data.publicDemo, true);

    const list = await request(app).get('/api/patients');
    assert.equal(list.status, 200);
    assert.equal(list.body.pagination.total, 1);

    const created = await request(app).post('/api/teams').send({
      name: 'Public demo member',
      specialty: 'Demonstration',
      email: 'public-demo@example.test'
    });
    assert.equal(created.status, 201);

    const message = await request(app).post(`/api/patients/${patient.id}/messages`).send({ text: 'Public fictional demo message' });
    assert.equal(message.status, 201);
    assert.equal(message.body.data.senderName, 'Public demo visitor');

    const demoPatient = await Patient.create({
      patientNumber: 'PUBLIC-DEMO-001',
      firstName: 'Public',
      lastName: 'Demo',
      dateOfBirth: '1990-01-01'
    });
    const deleted = await request(app).delete(`/api/patients/${demoPatient.id}`);
    assert.equal(deleted.status, 204);
  } finally {
    process.env.PUBLIC_DEMO_MODE = 'false';
  }
  const privateResponse = await request(app).get('/api/patients');
  assert.equal(privateResponse.status, 401);
});

test('patient list supports search and missing patients return 404', async () => {
  const response = await request(app).get('/api/patients?q=Fictional').set(authorized());
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].patientNumber, 'TEST-001');
  const literalSearch = await request(app).get('/api/patients?q=%5B').set(authorized());
  assert.equal(literalSearch.status, 200);
  assert.equal(literalSearch.body.pagination.total, 0);
  const missing = await request(app).get('/api/patients/507f1f77bcf86cd799439011').set(authorized());
  assert.equal(missing.status, 404);
});

test('diagnosis, laboratory, and notification workflows persist and update records', async () => {
  const diagnosis = await request(app).post(`/api/patients/${patient.id}/diagnoses`).set(authorized()).send({
    name: 'Fictional diagnosis',
    description: 'Demonstration only',
    recordedAt: new Date().toISOString()
  });
  assert.equal(diagnosis.status, 201);
  const diagnosisUpdate = await request(app).patch(`/api/diagnoses/${diagnosis.body.data._id}`).set(authorized()).send({ status: 'Resolved' });
  assert.equal(diagnosisUpdate.body.data.status, 'Resolved');
  const diagnosisList = await request(app).get(`/api/patients/${patient.id}/diagnoses`).set(authorized());
  assert.equal(diagnosisList.body.pagination.total, 1);

  const lab = await request(app).post(`/api/patients/${patient.id}/labs`).set(authorized()).send({
    testName: 'Fictional panel', resultValue: 'Demo value', status: 'Pending', recordedAt: new Date().toISOString()
  });
  assert.equal(lab.status, 201);
  const labList = await request(app).get(`/api/patients/${patient.id}/labs`).set(authorized());
  assert.equal(labList.body.data[0].testName, 'Fictional panel');

  const notifications = await request(app).get('/api/notifications').set(authorized());
  assert.equal(notifications.status, 200);
  const created = await require('../src/models/Notification').create({ title: 'Test notice', message: 'Fictional notice' });
  const marked = await request(app).patch(`/api/notifications/${created.id}/read`).set(authorized()).send({});
  assert.equal(marked.status, 200);
  assert.equal(marked.body.data.read, true);
});

test('invalid patient data returns a structured validation response', async () => {
  const response = await request(app).post('/api/patients').set(authorized()).send({ firstName: '', lastName: 'No ID' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(response.body.error.details));
});

test('appointment creation persists and conflicting patient or professional time returns 409', async () => {
  const scheduledAt = new Date(Date.now() + 86400000).toISOString();
  const payload = {
    patient: patient.id,
    teamMember: teamMember.id,
    scheduledAt,
    type: 'Fictional follow-up',
    status: 'Scheduled'
  };
  const created = await request(app).post('/api/appointments').set(authorized()).send(payload);
  assert.equal(created.status, 201);
  assert.equal(await Appointment.countDocuments(), 1);
  const conflict = await request(app).post('/api/appointments').set(authorized()).send({
    ...payload,
    patient: (await Patient.create({
      patientNumber: 'TEST-002',
      firstName: 'Another',
      lastName: 'Fictional',
      dateOfBirth: '1980-01-01'
    })).id
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'APPOINTMENT_CONFLICT');
});

test('team member creation validates and persists records', async () => {
  const response = await request(app).post('/api/teams').set(authorized()).send({
    name: 'Demo Nurse',
    specialty: 'Nursing',
    email: 'nurse@example.test'
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.name, 'Demo Nurse');
  const updated = await request(app).patch(`/api/teams/${response.body.data._id}`).set(authorized()).send({ status: 'Away' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.status, 'Away');
  const invalid = await request(app).post('/api/teams').set(authorized()).send({ name: 'Missing email' });
  assert.equal(invalid.status, 400);
});

test('staff role cannot perform administrator-only roster or patient actions', async () => {
  await User.create({
    email: 'staff@example.test',
    name: 'Test Staff',
    role: 'staff',
    passwordHash: await bcrypt.hash('staff-password-123', 4)
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'staff@example.test',
    password: 'staff-password-123'
  });
  const staffAuth = { Authorization: `Bearer ${login.body.data.token}` };
  const teamResponse = await request(app).post('/api/teams').set(staffAuth).send({
    name: 'Unauthorized Member',
    specialty: 'Testing',
    email: 'unauthorized@example.test'
  });
  assert.equal(teamResponse.status, 403);
  const patientResponse = await request(app).delete(`/api/patients/${patient.id}`).set(staffAuth);
  assert.equal(patientResponse.status, 403);
});

test('messages validate input and dashboard summary reflects persisted records', async () => {
  const invalid = await request(app).post(`/api/patients/${patient.id}/messages`).set(authorized()).send({ text: '' });
  assert.equal(invalid.status, 400);
  const sent = await request(app).post(`/api/patients/${patient.id}/messages`).set(authorized()).send({ text: 'Fictional demo message' });
  assert.equal(sent.status, 201);
  const summary = await request(app).get('/api/dashboard/summary').set(authorized());
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.patients, 2);
  assert.equal(summary.body.data.upcomingAppointments, 1);
});

test('health endpoint reports a disconnected database without claiming success', async () => {
  await mongoose.disconnect();
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 503);
  assert.equal(response.body.data.status, 'unavailable');
  await mongoose.connect(mongo.getUri());
});
