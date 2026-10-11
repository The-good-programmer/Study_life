import { describe, it, expect } from 'vitest';
import * as client from './aiSchemas';
// @ts-expect-error The server is plain JavaScript without type declarations.
import * as server from '../../server/src/aiSchemas.js';

describe('AI response schemas', () => {
  it("match the server's copies, which are the only schemas the shared AI service accepts", () => {
    expect(Object.keys(server).sort()).toEqual(Object.keys(client).sort());
    for (const name of Object.keys(client)) {
      expect(JSON.stringify((server as Record<string, unknown>)[name]), name).toBe(JSON.stringify((client as Record<string, unknown>)[name]));
    }
  });
});
