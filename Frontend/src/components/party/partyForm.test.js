import { describe, expect, it } from 'vitest';
import {
  buildPartyPayload,
  emptyPartyForm,
  foreignKeyFields,
  formFromParty,
  friendlySaveError,
  isAuthExpiredError,
  isForeignKeyError,
  isInitializationError,
  isValidUUID,
  partyIdOf,
  progressDone,
  validatePartyForm,
} from './partyForm';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

const filled = () => ({
  ...emptyPartyForm(),
  party_name: 'Acme',
  trade_name: 'Acme',
  contact_person: 'Ramesh',
  phone: '919876543210',
  address: '12 MG Road',
  pincode: '400058',
  country_id: U1,
  state_id: U2,
  city_id: U3,
  prefered_courier: 'DTDC',
});

describe('isValidUUID', () => {
  it('accepts a UUID and rejects other text', () => {
    expect(isValidUUID(U1)).toBe(true);
    expect(isValidUUID(` ${U1} `)).toBe(true);
    expect(isValidUUID('abc')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
  });
});

describe('validatePartyForm', () => {
  it('passes a complete form', () => {
    expect(validatePartyForm(filled(), { isEditing: false })).toBeNull();
  });
  it('names the first missing text field', () => {
    expect(validatePartyForm({ ...filled(), party_name: ' ' }, { isEditing: false })).toBe('Party Name is required.');
    expect(validatePartyForm({ ...filled(), pincode: '' }, { isEditing: false })).toBe('Pincode is required.');
  });
  it('checks the email only when one is typed', () => {
    expect(validatePartyForm({ ...filled(), email: 'nope' }, { isEditing: false })).toBe('Please enter a valid email address.');
    expect(validatePartyForm({ ...filled(), email: 'a@b.co' }, { isEditing: false })).toBeNull();
  });
  it('needs country, state and city ids', () => {
    expect(validatePartyForm({ ...filled(), country_id: '' }, { isEditing: false })).toBe('Please select a country.');
    expect(validatePartyForm({ ...filled(), state_id: 'x' }, { isEditing: false })).toBe('Please select a state.');
    expect(validatePartyForm({ ...filled(), city_id: '' }, { isEditing: false })).toBe('Please select a city.');
  });
  it('needs a courier only when adding', () => {
    expect(validatePartyForm({ ...filled(), prefered_courier: '' }, { isEditing: false })).toBe('Preferred Courier is required.');
    expect(validatePartyForm({ ...filled(), prefered_courier: '' }, { isEditing: true })).toBeNull();
  });
});

describe('buildPartyPayload', () => {
  it('builds the body with null for empty optional ids and credit days', () => {
    const p = buildPartyPayload({ ...filled(), zone_id: '', credit_days: '' }, { isAdmin: false });
    expect(p.zone_id).toBeNull();
    expect(p.credit_days).toBeNull();
    expect(p.country_id).toBe(U1);
    expect(p.billing_address).toBeNull();
    expect(p.billing_same_as_shipping).toBe(true);
    expect('is_active' in p).toBe(false);
  });
  it('sends is_active only for an admin', () => {
    expect(buildPartyPayload({ ...filled(), is_active: false }, { isAdmin: true }).is_active).toBe(false);
  });
  it('keeps the billing address only when it differs', () => {
    const p = buildPartyPayload({ ...filled(), billing_same_as_shipping: false, billing_address: 'B 1' }, { isAdmin: false });
    expect(p.billing_address).toBe('B 1');
    expect(p.billing_same_as_shipping).toBe(false);
  });
  it('adds the picked address point when it is numeric', () => {
    const p = buildPartyPayload({ ...filled(), address_lat: '19.1', address_lng: 72.8 }, { isAdmin: false });
    expect(p.address_lat).toBe(19.1);
    expect(p.address_lng).toBe(72.8);
    expect('address_lat' in buildPartyPayload({ ...filled(), address_lat: null, address_lng: null }, { isAdmin: false })).toBe(false);
  });
  it('turns an invalid optional id into null', () => {
    expect(buildPartyPayload({ ...filled(), state_id: 'bad' }, { isAdmin: false }).state_id).toBeNull();
  });
});

describe('formFromParty', () => {
  it('reads a party row, with the preferred courier spelling fallback', () => {
    const f = formFromParty({ party_name: 'A', preferred_courier: 'X', is_active: false, latitude: 1, billing_same_as_shipping: false });
    expect(f.party_name).toBe('A');
    expect(f.prefered_courier).toBe('X');
    expect(f.is_active).toBe(false);
    expect(f.latitude).toBe(1);
    expect(f.billing_same_as_shipping).toBe(false);
    expect(f.city_id).toBe('');
  });
});

describe('error helpers', () => {
  it('spots the backend initialization quirk', () => {
    expect(isInitializationError({ message: "Cannot access 'Party' before initialization" })).toBe(true);
    expect(isInitializationError({ isInitializationError: true })).toBe(true);
    expect(isInitializationError({ message: 'Phone already used' })).toBe(false);
  });
  it('spots an expired session', () => {
    expect(isAuthExpiredError({ message: 'Token expired' })).toBe(true);
    expect(isAuthExpiredError({ message: 'Other' })).toBe(false);
  });
  it('finds rejected location ids', () => {
    const err = { message: 'Cannot add: foreign key constraint fails (`city_id`) references cities' };
    expect(isForeignKeyError(err)).toBe(true);
    expect(foreignKeyFields(err)).toEqual(['city_id']);
    expect(isForeignKeyError({ message: 'Phone already used' })).toBe(false);
  });
  it('makes a readable message', () => {
    expect(friendlySaveError({ message: 'foreign key constraint on state_id' })).toBe('Invalid State ID. The state does not exist in the database.');
    expect(friendlySaveError({ message: 'Phone already used' })).toBe('Phone already used');
    expect(friendlySaveError({})).toBe('Failed to save party');
  });
});

describe('small helpers', () => {
  it('finds the party id under any key', () => {
    expect(partyIdOf({ party_id: 'p1' })).toBe('p1');
    expect(partyIdOf({ id: 'p2' })).toBe('p2');
    expect(partyIdOf(null)).toBe('');
  });
  it('counts the progress fields', () => {
    expect(progressDone(emptyPartyForm())).toBe(0);
    expect(progressDone(filled())).toBe(9);
  });
});
