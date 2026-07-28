import test from 'node:test';
import assert from 'node:assert/strict';
import type { Utterance } from '../../shared/types';
import { addressesName, claimsName, resolveIdentification } from './identify';

/**
 * Between them these fixtures cover every failure mode this module exists to
 * handle: nothing resolved, resolved correctly, half resolved, and resolved
 * backwards. All of them are synthetic two-speaker exchanges built to exercise
 * the logic; the cast is invented.
 *
 * The roster deliberately mixes a short name and a long one, because the edit
 * budget scales with length: "Dana" tolerates one edit ("Dena"), "Sebastian"
 * tolerates two ("Bastian").
 */

const u = (speaker: string, text: string): Utterance => ({ speaker, text, start: 0, end: 1000 });
const ROSTER = ['Dana', 'Sebastian'];

test('addressing someone is distinguished from claiming or mentioning a name', () => {
  assert.equal(addressesName("Hi Dena, I'm so sorry for the delay.", 'Dana'), true);
  assert.equal(addressesName('So Dena, whenever you have time, is it okay', 'Dana'), true);
  assert.equal(addressesName('All right, thank you so much, Bastian.', 'Sebastian'), true);

  // "Dena Test" is a demo record being greeted in a template, not a person.
  assert.equal(addressesName('and then this subject and then hi Dena Test.', 'Dana'), false);
  assert.equal(addressesName('the Dena account stays open until August', 'Dana'), false);

  // A claim outweighs a mention, and can straddle a sentence break.
  assert.equal(claimsName("That's me. Dana Whitfield. I joined in March", 'Dana'), true);
  assert.equal(claimsName("I'm so sorry for the delay", 'Dana'), false);
});

test('an identity mapping is not success', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'A', B: 'B' },
    roster: ROSTER,
    utterances: [u('A', 'so anyway the sheet is here'), u('B', 'got it, understood')],
  });
  assert.equal(r.status, 'unresolved');
  assert.equal(r.mapping, null);
});

test('no roster means identification was never asked for', () => {
  const r = resolveIdentification({ rawMapping: {}, roster: [], utterances: [u('A', 'hello')] });
  assert.equal(r.status, 'not-requested');
  assert.equal(r.mapping, null);
});

test('the roster spelling wins over the recogniser', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'Dena', B: 'Sebastian' },
    roster: ROSTER,
    // The claim matters: it is what corroborates the mapping. With no name
    // spoken anywhere this would be the baseless case below, not a snapping one.
    utterances: [u('A', "I'm Dena, I built the thing"), u('B', 'thanks for that')],
  });
  assert.deepEqual(r.mapping, { A: 'Dana', B: 'Sebastian' });
  assert.equal(r.status, 'success');
});

test('a correct mapping is left alone', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian' },
    roster: ROSTER,
    utterances: [
      u('A', 'today I am going to show you all of the updates that I have made'),
      u('A', 'and then this subject and then hi Dena Test'),
      u('B', 'Hi, Dena!'),
      u('B', 'the handover notes are ready whenever you want them'),
    ],
  });
  assert.deepEqual(r.mapping, { A: 'Dana', B: 'Sebastian' });
  assert.equal(r.status, 'success');
});

test('one resolved speaker deduces the other from the roster', () => {
  const r = resolveIdentification({
    rawMapping: { B: 'Sebastian' },
    roster: ROSTER,
    utterances: [
      u('A', 'That is me. Dana Whitfield. I joined in March.'),
      u('B', 'so then what I do is I will make the accounts they need'),
    ],
  });
  assert.deepEqual(r.mapping, { A: 'Dana', B: 'Sebastian' });
  assert.equal(r.status, 'success');
});

test('with nothing resolved, who addresses whom decides a two-person call', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'A', B: 'B' },
    roster: ROSTER,
    utterances: [
      u('A', 'will update on this database, and then we will make a spreadsheet'),
      u('B', 'before I built the site, I made sure it works with the existing tools'),
      u('B', 'Yeah, excited for this. All right, uh, thanks, Bastian.'),
    ],
  });
  // B thanks Sebastian, so B is not Sebastian.
  assert.deepEqual(r.mapping, { A: 'Sebastian', B: 'Dana' });
  assert.equal(r.status, 'uncertain');
});

test('an inverted mapping is detected and corrected', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian' },
    roster: ROSTER,
    utterances: [
      // The API read this greeting as self-identification. It is the opposite.
      u('A', "Hi Dena, I'm so sorry for the delay."),
      u('A', 'I have been using this website and it makes things so easy'),
      u('B', 'Wow, I am glad to hear that.'),
      u('B', 'All right, thank you so much, Bastian.'),
    ],
  });
  assert.deepEqual(r.mapping, { A: 'Sebastian', B: 'Dana' });
  assert.equal(r.status, 'uncertain');
});

test('a contradiction that swapping cannot explain discards the names', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian', C: 'Ana' },
    roster: ['Dana', 'Sebastian', 'Ana'],
    utterances: [
      u('A', 'Hi Dana, how are you'),
      u('B', 'sure, sounds good'),
      u('C', 'agreed'),
    ],
  });
  // Better a bare label than a confidently wrong name.
  assert.equal(r.mapping, null);
  assert.equal(r.status, 'uncertain');
});

test('a mapping the transcript says nothing about is discarded', () => {
  // The regression this module gained last: on a real call neither participant
  // was ever named aloud, and a full, inverted mapping came back as "success".
  // Every contradiction check passed it, because with no name said there was
  // nothing to contradict. Corroboration has to be asked first.
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian' },
    roster: ROSTER,
    utterances: [
      u('A', 'the database we make, I was imagining if there can be a website for it'),
      u('B', 'yes, I was also thinking about the new site, it is in active development'),
      u('A', 'if everyone could have their own work email that would make login easy'),
      u('B', 'we already have the students and the staff, so this is the natural next step'),
    ],
  });
  assert.equal(r.mapping, null);
  assert.equal(r.status, 'uncertain');
  assert.match(r.note ?? '', /never said aloud/);
});

test('an unspoken name still stands when the roster forces it', () => {
  // The guard against over-correcting. One name is spoken, there are as many
  // speakers as roster names, so the remaining one is arithmetic, not a guess.
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian' },
    roster: ROSTER,
    utterances: [
      u('A', "That's me. Dana Whitfield."),
      u('B', 'right, and I will get the accounts set up'),
    ],
  });
  assert.deepEqual(r.mapping, { A: 'Dana', B: 'Sebastian' });
  assert.equal(r.status, 'success');
});

test('two unspoken names are guesswork, even with a full roster', () => {
  const r = resolveIdentification({
    rawMapping: { A: 'Dana', B: 'Sebastian', C: 'Priya' },
    roster: ['Dana', 'Sebastian', 'Priya'],
    utterances: [
      u('A', "That's me. Dana Whitfield."),
      u('B', 'sounds good to me'),
      u('C', 'agreed, let us do that'),
    ],
  });
  assert.equal(r.mapping, null);
  assert.equal(r.status, 'uncertain');
});
