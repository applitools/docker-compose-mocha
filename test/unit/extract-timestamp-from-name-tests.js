const { expect } = require('chai');
const { describe, it } = require('mocha');
const extractTimestampFromName = require('../../lib/extract-timestamp-from-name');

const divider = 'zzdivzz';
describe('extractTimestampFromName', () => {
  it('should extract the unix timestamp from the container name', () => {
    const input = 'ce2366ff75c5 cicontaineryaniv_barelzzdivzz1549961204_screenshot-webhook_1';
    expect(extractTimestampFromName(input, divider)).to.equal(1549961204);
  });
});
