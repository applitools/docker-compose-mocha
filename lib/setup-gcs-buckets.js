const fs = require('fs');
const path =  require('path');

module.exports = (Storage) => {
  let locksBucket,
    configsBucket

  async function copyConfigurations(srcBucket, destBucket) {
    const [files] = await srcBucket.getFiles({ prefix: 'chrome/0' })
    files.shift()

    for (const file of files) {
      const [configBuf] = await file.download()
      const config = JSON.parse(configBuf.toString())
      delete config.spec.nodeSelector
      delete config.spec.volumes
      delete config.spec.serviceAccountName
      delete config.spec.containers[0].volumeMounts
      config.spec.containers = config.spec.containers.map((container) => ({
        ...container,
        resources: {
          requests: {
            memory: '400Mi',
            cpu: '500m'
          },
          limits: {
            memory: '400Mi',
            cpu: '500m'
          }
        },
      }))
      await destBucket.file(file.name)
        .save(JSON.stringify(config), {
          metadata: { metadata: { podConfHash: file.metadata.metadata.podConfHash } },
        })
    }
  }

  async function cleanBucket(bucket) {
    const [files] = await bucket.getFiles({ prefix: 'chrome/0' })

    for (const file of files) {
      await file.delete()
    }

    // Make sure that the bucket is cleaned
    await new Promise((r) => setTimeout(r, Number(process.env.WAIT_AFTER_CONFIG_COPY_SEC || 1000)))
  }

  async function setupGcsBuckets() {
    const isGSCKeyExists = fs.existsSync(
      `${process.env.HOME}/secrets/execution-grid-eg-driver-pod-conf-dev.json`,
    )

    if (!isGSCKeyExists) {
      throw new Error(
        `google credentials key does not exist in: ${process.env.HOME}/secrets/execution-grid-eg-driver-pod-conf-dev.json . Please make sure to download it from 1Password: https://applitools.1password.com/app#/cvkwbdzp4gd737bh2ssofy23mq/Category/cvkwbdzp4gd737bh2ssofy23mqkk7q5ugsxicwoiezlhw5hlc2ou?itemListId=006`,
      )
    }

    let locksBucket,
      configsBucket,
      gcsStorage
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
      process.env.HOME,
      'secrets/execution-grid-eg-driver-pod-conf-dev.json',
    )
    gcsStorage = new Storage()
    configsBucket = await gcsStorage.bucket(process.env.TEST_CONFIGS_BUCKET)
    locksBucket = await gcsStorage.bucket(process.env.TEST_LOCKS_BUCKET)

    await cleanBucket(configsBucket)
    await copyConfigurations(gcsStorage.bucket(process.env.ORIGINAL_CONFIGS_BUCKET), configsBucket)

    return {
      locksBucket,
      configsBucket
    }
  }

  return {
    setupGcsBuckets,
    getLocksBucket: () => locksBucket,
    getConfigsBucket: () => configsBucket
  }
}

