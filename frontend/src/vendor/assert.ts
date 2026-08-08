// Browser shim for `assert` (Node built-in). The indexer client's scale-codec
// dependency calls the default assert in its validators; browsers have no
// Node `assert` module.

interface Assert {
  (value: unknown, message?: string): asserts value;
  ok(value: unknown, message?: string): asserts value;
  fail(message?: string): never;
  equal(actual: unknown, expected: unknown, message?: string): void;
  strictEqual(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  deepStrictEqual(actual: unknown, expected: unknown, message?: string): void;
  AssertionError: typeof Error;
}

const assert = ((value: unknown, message?: string): asserts value => {
  if (!value) {
    throw new Error(message ?? 'Assertion failed');
  }
}) as Assert;

export default assert;
export const ok = assert.ok = assert;
export const fail = assert.fail = (message?: string): never => {
  throw new Error(message ?? 'Assertion failed');
};
export const equal = assert.equal = (actual: unknown, expected: unknown, message?: string): void => {
  if (actual !== expected) throw new Error(message ?? `Expected ${String(actual)} to equal ${String(expected)}`);
};
export const strictEqual = assert.strictEqual = equal;
export const deepEqual = assert.deepEqual = equal;
export const deepStrictEqual = assert.deepStrictEqual = equal;
export const AssertionError = assert.AssertionError = Error;