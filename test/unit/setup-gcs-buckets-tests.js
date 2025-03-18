const {
  describe, it, beforeEach, afterEach,
} = require('mocha');
const { expect } = require('chai');
const { Storage } = require('@google-cloud/storage');
const sinon = require('sinon');
const gcs = require('../../lib/setup-gcs-buckets');

let sandbox;

describe('setupGcsBuckets', () => {
  let bucketFake;
  let mockFiles;
  let mockBucket;

  const configuration = {
    spec: {
      containers: [{
        volumeMounts: [],
      }],
    },
    stam: 'data',
  };

  const metadata = {
    metadata: {
      podConfHash: 'stamHash',
    },
  };

  function getFileMock() {
    let counter = 0;

    return sandbox.fake(() => {
      const file = mockFiles[counter];
      counter += 1;

      return file;
    });
  }

  beforeEach(() => {
    process.env.TEST_CONFIGS_BUCKET = 'configs';
    process.env.TEST_LOCKS_BUCKET = 'locks';
    process.env.ORIGINAL_CONFIGS_BUCKET = 'origins';
    sandbox = sinon.createSandbox();
    mockFiles = [...Array(5).keys()].map(() => ({
      name: 'stam',
      save: sandbox.stub().resolves(),
      delete: sandbox.stub(),
      download: sandbox.stub().resolves([Buffer.from(JSON.stringify(configuration))]),
      metadata,
    }));
    mockBucket = {
      getFiles: sandbox.stub().resolves([mockFiles]),
      file: getFileMock(),
      create: sandbox.stub(),
      exists: sandbox.stub().returns([false]),
    };
    bucketFake = sandbox.stub().returns(mockBucket);
    sandbox.replace(Storage.prototype, 'bucket', bucketFake);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should create config and locks bucket if they dont exist', async () => {
    // Act
    await gcs().setupGcsBuckets(Storage);

    // Assert
    sandbox.assert.calledTwice(mockBucket.create);
  });

  it('should call configurations and locks buckets', async () => {
    // Act
    await gcs().setupGcsBuckets(Storage);

    // Assert
    sandbox.assert.calledThrice(bucketFake);
    sandbox.assert.calledWithExactly(bucketFake, 'configs');
    sandbox.assert.calledWithExactly(bucketFake, 'locks');
    sandbox.assert.calledWithExactly(bucketFake, 'origins');
  });

  it('should call delete on all files to clean configs bucket', async () => {
    // Act
    await gcs().setupGcsBuckets(Storage);

    // Assert
    for (let i = 0; i < mockFiles.length; i += 1) {
      const file = mockFiles[i];
      sandbox.assert.calledTwice(file.delete);
    }
  });

  it('should save copied files', async () => {
    // Arrange
    const expectedConfig = {
      spec: {
        containers: [
          {
            volumeMounts: [],
          },
        ],
      },
      stam: 'data',
    };

    // Act
    await gcs().setupGcsBuckets(Storage);

    // Assert
    for (let i = 0; i < mockFiles.length; i += 1) {
      const file = mockFiles[i];
      sandbox.assert.calledWithExactly(file.save, JSON.stringify(expectedConfig), {
        metadata,
        resumable: false,
      });
    }
  });

  it('should remove nodeSelector, volumes and serviceAccountName from config', async () => {
    // Arrange
    mockFiles.map((file) => file.download.resolves([Buffer.from(JSON.stringify({
      spec: {
        nodeSelector: 'someSelector',
        volumes: [],
        serviceAccountName: '',
        containers: [
          {
            resources: {
              requests: {
                memory: '400Mi',
                cpu: '500m',
              },
              limits: {
                memory: '400Mi',
                cpu: '500m',
              },
            },
          },
        ],
      },
      stam: 'data',
    }))]));
    const expectedConfig = {
      spec: {
        nodeSelector: 'someSelector',
        volumes: [],
        serviceAccountName: '',
        containers: [{
          resources: {
            requests: { memory: '400Mi', cpu: '500m' },
            limits: { memory: '400Mi', cpu: '500m' },
          },
        }],
      },
      stam: 'data',
    };

    // Act
    await gcs().setupGcsBuckets(Storage);

    // Assert
    for (let i = 0; i < mockFiles.length; i += 1) {
      const file = mockFiles[i];
      sandbox.assert.calledWithExactly(file.save, JSON.stringify(expectedConfig), {
        metadata,
        resumable: false,
      });
    }
  });

  it('should save config with overrideData param', async () => {
    // Act
    await gcs().setupGcsBuckets(Storage, { overrideData: { stam: { test: 'data' } } });

    // Assert
    const file = mockFiles[0];

    expect(file.save.firstCall.args[0]).to.eq('{"test":"data"}');
    expect(file.save.firstCall.args[1]).to.deep.eq({
      metadata: { metadata: { podConfHash: 'efa50cf8a8cb258b1ed08cc3170cb54b' } },
      resumable: false,
    });
  });
});
