const fs = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MD5 } = require('object-hash');
const path = require('path');

module.exports = () => {
  let locksBucket;
  let configsBucket;

  async function getConfigurations(files, overrideData) {
    let configs;

    if (overrideData) {
      configs = Object.values(overrideData).map((conf) => [Buffer.from(JSON.stringify(conf))]);
    } else {
      configs = await Promise.all(files.map(async (file) => file.download()));
    }

    return configs;
  }

  async function copyConfigurations(srcBucket, destBucket, overrideData) {
    let files;

    if (overrideData) {
      files = Object.entries(overrideData).map(([key, value]) => ({
        name: key,
        metadata: { metadata: { podConfHash: MD5(value) } },
      }));
    } else {
      ([files] = await srcBucket.getFiles({ prefix: 'chrome/0' }));
      files.shift();
    }

    const configs = await getConfigurations(files, overrideData);
    const uploadsPromises = [];

    for (let i = 0; i < files.length; i += 1) {
      const [configBuf] = configs[i];
      const file = files[i];
      const config = JSON.parse(configBuf.toString());
      uploadsPromises.push(destBucket.file(file.name)
        .save(JSON.stringify(config), {
          metadata: { metadata: { podConfHash: file.metadata.metadata.podConfHash } },
          resumable: false,
        }));
    }

    await Promise.all(uploadsPromises);
  }

  async function cleanBucket(bucket) {
    const [files] = await bucket.getFiles();
    await Promise.all(files.map(async (file) => file.delete()));

    // Make sure that the bucket is cleaned
    await new Promise((r) => setTimeout(r, Number(process.env.WAIT_AFTER_CONFIG_COPY_SEC || 1000)));
  }

  async function setupGcsBuckets(Storage, { overrideData } = {}) {
    const isGSCKeyExists = fs.existsSync(
      `${process.env.HOME}/secrets/execution-grid-eg-driver-pod-conf-dev.json`,
    );

    if (!isGSCKeyExists) {
      throw new Error(
        `google credentials key does not exist in: 
          ${process.env.HOME}/secrets/execution-grid-eg-driver-pod-conf-dev.json . Please make sure to download it from 1Password: 
          https://applitools.1password.com/app#/cvkwbdzp4gd737bh2ssofy23mq/Category/cvkwbdzp4gd737bh2ssofy23mqkk7q5ugsxicwoiezlhw5hlc2ou?itemListId=006`,
      );
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
      process.env.HOME,
      'secrets/execution-grid-eg-driver-pod-conf-dev.json',
    );
    const gcsStorage = new Storage();
    configsBucket = await gcsStorage.bucket(process.env.TEST_CONFIGS_BUCKET);
    const [isConfigsBucketExists] = await configsBucket.exists();

    if (!isConfigsBucketExists) {
      await configsBucket.create();
      console.log(`created configurations bucket: ${process.env.TEST_CONFIGS_BUCKET}`);
    }

    locksBucket = await gcsStorage.bucket(process.env.TEST_LOCKS_BUCKET);
    const [isLocksBucketExists] = await locksBucket.exists();

    if (!isLocksBucketExists) {
      await locksBucket.create();
      console.log(`created locks bucket: ${process.env.TEST_LOCKS_BUCKET}`);
    }

    await cleanBucket(configsBucket);
    await cleanBucket(locksBucket);
    await copyConfigurations(gcsStorage.bucket(process.env.ORIGINAL_CONFIGS_BUCKET), configsBucket, overrideData);

    return {
      locksBucket,
      configsBucket,
    };
  }

  async function teardownGcsBuckets() {
    try {
      await locksBucket.deleteFiles();
      await locksBucket.delete();
      console.log(`deleted bucket ${locksBucket.name}`);
    } catch (e) {
      if (e.code === 404) {
        console.log(`bucket or files in bucket not found: ${locksBucket.name}`);
      }
    }

    try {
      await configsBucket.deleteFiles();
      await configsBucket.delete();
      console.log(`deleted bucket ${configsBucket.name}`);
    } catch (e) {
      if (e.code === 404) {
        console.log(`bucket or files in bucket not found: ${configsBucket.name}`);
      }
    }
  }

  return {
    teardownGcsBuckets,
    setupGcsBuckets,
    getLocksBucket: () => locksBucket,
    getConfigsBucket: () => configsBucket,
  };
};
