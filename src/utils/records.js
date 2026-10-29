const mongoose = require('mongoose');
const HttpError = require('./httpError');

function assertId(id, label = 'identifier') {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'INVALID_IDENTIFIER', `The ${label} is invalid.`);
  }
}

async function requireRecord(Model, id, label) {
  assertId(id, label);
  const record = await Model.findById(id);
  if (!record) throw new HttpError(404, 'NOT_FOUND', `${label} was not found.`);
  return record;
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

function pageResult(items, total, page, limit) {
  return { data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { assertId, requireRecord, pagination, pageResult };
