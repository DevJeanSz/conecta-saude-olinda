import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRoleAccessUnit,
  hasAppointmentConflict,
  maskSus,
  nextQueuePassword,
} from '../server/domain/schedulingRules.mjs';

test('detecta conflito de agenda para profissional, data e horario ativos', () => {
  const appointments = [
    { id: '1', doctor_id: 'doc-1', date: '2026-08-10', time: '09:00', status: 'SCHEDULED' },
    { id: '2', doctor_id: 'doc-1', date: '2026-08-10', time: '10:00', status: 'CANCELLED' },
  ];

  assert.equal(hasAppointmentConflict(appointments, { doctorId: 'doc-1', date: '2026-08-10', time: '09:00' }), true);
  assert.equal(hasAppointmentConflict(appointments, { doctorId: 'doc-1', date: '2026-08-10', time: '10:00' }), false);
});

test('gera a proxima senha por tipo de fila', () => {
  const appointments = [
    { date: '2026-08-10', queue_password: 'G-001' },
    { date: '2026-08-10', queue_password: 'G-002' },
    { date: '2026-08-10', queue_password: 'P-001' },
  ];

  assert.equal(nextQueuePassword(appointments, false, '2026-08-10'), 'G-003');
  assert.equal(nextQueuePassword(appointments, true, '2026-08-10'), 'P-002');
});

test('valida acesso por perfil e unidade', () => {
  assert.equal(canRoleAccessUnit('ADMIN', undefined, [], 'unit-2'), true);
  assert.equal(canRoleAccessUnit('ATTENDANT', 'unit-1', [], 'unit-1'), true);
  assert.equal(canRoleAccessUnit('ATTENDANT', 'unit-1', ['unit-2'], 'unit-2'), true);
  assert.equal(canRoleAccessUnit('ATTENDANT', 'unit-1', [], 'unit-3'), false);
});

test('mascara identificador do cartao SUS', () => {
  assert.equal(maskSus('700000000000000'), '700****0000');
});
