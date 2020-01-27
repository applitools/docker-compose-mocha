const { expect } = require('chai');
const { promisify } = require('util');
const { exec } = require('child-process-promise');
const fetch = require('node-fetch').default;
const chance = require('./../../lib/setup-environment-names-seed');
const { getRandomEnvironmentName } = require('./../../lib/get-random-environment-name');
const dockerStopByServiceName = require('./../../lib/docker-stop-by-service-name');
const dockerStartByServiceName = require('./../../lib/docker-start-by-service-name');
const dockerCheckByServiceName = require('./../../lib/docker-check-by-service-name');
const dockerPauseByServiceName = require('./../../lib/docker-pause-by-service-name');
const dockerUnpauseByServiceName = require('./../../lib/docker-unpause-by-service-name');
const getAddressForService = require('./../../lib/get-address-for-service');
const main = require('./../../index');
const { simulateMochaRun } = require('./mocha-helper');
const pullTools = require('./../../lib/docker-pull-image-by-name');

let envName = '';

function verifyEnvironmentDownByProjectName(pathToCompose, runName) {
  return main.getAddressForService(runName, pathToCompose, 'dct_s1', 3001)
    .then(() => {
      expect(true, 'Should not get here since the dct_s1 service should be down').to.equal(false);
    })
    .catch(() => main
      .getAddressForService(runName, pathToCompose, 'dct_s2', 3002)
      .then(() => {
        expect(true, 'Should not get here since the dct_s2 service should be down').to.equal(false);
      })
      .catch(() =>
        // If we got here it means that both services went down successfully!
        // eslint-disable-next-line implicit-arrow-linebreak
        Promise.resolve()));
}

const runAnEnvironment = async (pathToCompose, targetEnvName, options) => {
  let generatedEnvName = '';
  await simulateMochaRun((before, after) => {
    generatedEnvName = main.dockerComposeTool(before, after, pathToCompose, {
      targetEnvName,
      containerRetentionInMinutes: 0,
      healthCheck: {
        state: true,
        options: {
          custom: {
            db: async (url) => {
              try {
                const response = await fetch(`http://${url}/`, {
                  resolveWithFullResponse: true,
                  timeout: 2000,
                });

                console.log('From within the custom poll method..');
                return (response.status >= 200 && response.status < 500);
              } catch (err) {
                await promisify(setTimeout)(1000);
                return false;
              }
            },
          },
        },
      },
      ...options || {},
    });
  }, async () => {
    const resultDct1 = await main.getAddressForService(generatedEnvName, pathToCompose, 'dct_s1', 3001);
    expect(Number(resultDct1.replace('0.0.0.0:', ''))).to.be.above(1);
    const targetUriForService1 = `http://${resultDct1}`;
    console.log(`Performing request to ${targetUriForService1}`);

    const requestResult = await fetch(targetUriForService1, {
      timeout: 2000,
    }).then((res) => res.text());
    expect(requestResult).to.equal('Hello from test app on port 3001');
    console.log('success!');

    // use the deprecated function, just to check that it still works.
    const resultDct2 = await main.getAddressForService(generatedEnvName, pathToCompose, 'dct_s2', 3002);
    expect(Number(resultDct2.replace('0.0.0.0:', ''))).to.be.above(1);
    const targetUriForService2 = `http://${resultDct2}`;
    console.log(`Performing request to ${targetUriForService2}`);

    const request2Result = await fetch(targetUriForService2, {
      timeout: 2000,
    }).then((res) => res.text());
    expect(request2Result).to.equal('Hello from test app on port 3002');
    console.log('success again!');
  });
  await verifyEnvironmentDownByProjectName(generatedEnvName, pathToCompose);
  return generatedEnvName;
};

const runAnEnvironmentWithStopStart = async (pathToCompose) => {
  let generatedEnvName = '';
  await simulateMochaRun((before, after) => {
    generatedEnvName = main.dockerComposeTool(before, after, pathToCompose);
  }, async () => {
    try {
      const serviceName = 'dct_s1';
      const checkBefore = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkBefore).to.eql(true);
      await dockerStopByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      const checkAfterStop = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkAfterStop).to.eql(false);
      await dockerStartByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      const checkAfterRestart = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkAfterRestart).to.eql(true);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
  return verifyEnvironmentDownByProjectName(generatedEnvName, pathToCompose);
};

const runAnEnvironmentWithPauseUnpause = async (pathToCompose) => {
  let generatedEnvName = '';
  await simulateMochaRun((before, after) => {
    generatedEnvName = main.dockerComposeTool(before, after, pathToCompose);
  }, async () => {
    try {
      const serviceName = 'dct_s1';
      const checkBefore = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkBefore).to.eql(true);
      const address = await getAddressForService(generatedEnvName, pathToCompose, serviceName);
      await dockerPauseByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      const checkAfterStop = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkAfterStop).to.eql(false);
      await dockerUnpauseByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      const checkAfterRestart = await dockerCheckByServiceName(generatedEnvName,
        pathToCompose, serviceName);
      expect(checkAfterRestart).to.eql(true);
      const addressAfterPause = await getAddressForService(generatedEnvName,
        pathToCompose, serviceName);
      expect(address).to.eql(addressAfterPause);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
  return verifyEnvironmentDownByProjectName(generatedEnvName, pathToCompose);
};

const runASubEnvironment = async (pathToCompose) => {
  const firstEnvLoad = (before, after) => {
    const options = {
      containerCleanUp: false,
      shouldPullImages: true,
      containerRetentionInMinutes: 0,
      healthCheck: {
        state: true,
      },
      startOnlyTheseServices: ['dct_s1'],
    };
    envName = main.dockerComposeTool(before, after, pathToCompose, options);
  };
  const firstTestCheck = async () => {
    const resultDct1 = await main.getAddressForService(envName, pathToCompose, 'dct_s1', 3001);
    expect(Number(resultDct1.replace('0.0.0.0:', '')), 'Make sure we have a numeric port above:').to.be.above(1);
    expect(pullTools.dockerPullImageByName.callCount).to.equal(1);

    try {
      await main.getAddressForService(envName, pathToCompose, 'dct_s2', 3002);
      expect.fail();
    } catch (e) {
      // if it fails - is good.
    }
  };

  await simulateMochaRun((before, after) => {
    firstEnvLoad(before, after);
  }, firstTestCheck, false, true);

  const secondEnvLoad = (before, after) => {
    const options = {
      cleanUp: false,
      containerRetentionInMinutes: 0,
      shouldPullImages: true,
      healthCheck: {
        state: true,
      },
      startOnlyTheseServices: ['dct_s2'],
      envName,
    };
    main.dockerComposeTool(before, after, pathToCompose, options);
  };
  const secondTestCheck = async () => {
    const resultDct1 = await main.getAddressForService(envName, pathToCompose, 'dct_s1', 3001);
    expect(Number(resultDct1.replace('0.0.0.0:', '')), 'Make sure we have a numeric port for dct_s1:').to.be.above(1);
    const resultDct2 = await main.getAddressForService(envName, pathToCompose, 'dct_s2', 3002);
    expect(Number(resultDct2.replace('0.0.0.0:', '')), 'Make sure we have a numeric port for dct_s2').to.be.above(1);
  };

  await simulateMochaRun((before, after) => {
    secondEnvLoad(before, after);
  }, secondTestCheck, true, false);

  return envName;
};

function checkOldEnvironmentWasCleaned(pathToCompose, oldEnvName) {
  return verifyEnvironmentDownByProjectName(oldEnvName, pathToCompose);
}

const runAnOldEnvironment = async (pathToCompose) => {
  const moreThan20MinutesOldProjectName = getRandomEnvironmentName(chance, 35).envName;
  await exec(`docker-compose -p ${moreThan20MinutesOldProjectName} -f ${pathToCompose} up -d`);

  const resultDct1 = await main.getAddressForService(moreThan20MinutesOldProjectName, pathToCompose, 'dct_s1', 3001);
  expect(Number(resultDct1.replace('0.0.0.0:', ''))).to.be.above(1);

  const resultDct2 = await main.getAddressForService(moreThan20MinutesOldProjectName, pathToCompose, 'dct_s2', 3002);
  expect(Number(resultDct2.replace('0.0.0.0:', ''))).to.be.above(1);

  return moreThan20MinutesOldProjectName;
};

module.exports = {
  runAnOldEnvironment,
  checkOldEnvironmentWasCleaned,
  runASubEnvironment,
  runAnEnvironmentWithStopStart,
  runAnEnvironment,
  runAnEnvironmentWithPauseUnpause,
};
