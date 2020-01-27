
const {
  describe, it, beforeEach, afterEach,
} = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const childProcess = require('child-process-promise');
const getAddressForService = require('./../../lib/get-address-for-service');

let sandbox;

describe('getAddressForService', () => {
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should handle the exposed port correctly when port is not random', async () => {
    const spy = sandbox.spy(childProcess, 'exec');
    await getAddressForService('test', 'stam-path', 'service', '3000:3000');
    expect(spy.callCount).to.equal(0);
  });

  it('should handle ports which are also a number', async () => {
    sandbox.stub(childProcess, 'exec').callsFake(() => Promise.resolve({
      stdout: 'dfasdfas',
    }));

    await getAddressForService('test', 'stam-path', 'service', 3000);
  });
});
