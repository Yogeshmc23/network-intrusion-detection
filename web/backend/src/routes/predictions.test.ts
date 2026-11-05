import { describe, expect, it } from 'vitest';
import { parseCsv } from './predictions';

const csv = (value: string) => Buffer.from(value, 'utf8');

describe('batch CSV parsing', () => {
  it('handles BOM headers, quoted commas, escaped quotes, and numeric fields', () => {
    const rows = parseCsv(csv('\uFEFFprotocol_type,service,note,src_bytes\ntcp,"http,alt","says ""hello""",12'));
    expect(rows).toEqual([{ protocol_type: 'tcp', service: 'http,alt', note: 'says "hello"', src_bytes: 12 }]);
  });

  it('rejects unmatched quotes and rows with a different number of cells', () => {
    expect(() => parseCsv(csv('a,b\n1,"unfinished'))).toThrow('unmatched quotation mark');
    expect(() => parseCsv(csv('a,b\n1'))).toThrow('different number of columns');
  });

  it('does not silently turn empty fields into numeric zero', () => {
    const [row] = parseCsv(csv('a,b\n,0'));
    expect(row).toEqual({ a: '', b: 0 });
  });
});
