const {
  describe, it, before: b,
} = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const main = require('../../index');
const { simulateMochaRun } = require('../tools/mocha-helper');
const { dockerPullImageByName } = require('../../lib/docker-pull-image-by-name');
const dockerPullHostObject = require('../../lib/docker-pull-image-by-name');
const packageJson = require('../../package.json');

const {
  runAnOldEnvironment,
  checkOldEnvironmentWasCleaned,
  runASubEnvironment,
  runAnEnvironmentWithStopStart,
  runAnEnvironment,
  runAnEnvironmentWithPauseUnpause,
} = require('../tools/helpers');

describe('dockerComposeTool', () => {
  const pathToCompose = `${__dirname}/docker-compose.yml`;
  const pathToComposeForEnv = `${__dirname}/docker-compose-envvars.yml`;

  it('should load an environment correctly and wait for it (healthcheck) to be ready', () => runAnEnvironment(pathToCompose));

  describe('when bruttaly killing an environment', () => {
    let envName;
    b(async () => {
      envName = await runAnEnvironment(pathToCompose, { brutallyKill: true });
    });
    it('should clean it afterwards', async () => {
      await checkOldEnvironmentWasCleaned(pathToCompose, envName);
    });
  });

  it('should kill env with volume containing env variables', async () => {
    const path = `${__dirname}/docker-compose-with-volume-env-var.yml`;
    let envName;

    await simulateMochaRun((before, after) => {
      envName = main.dockerComposeTool(before, after, path, {
        envVars: {
          INTERESTING_PAGES: `${__dirname}/interestingPages`,
          SAMPLE_WEB_APP_TESTKIT_DEP_VERSION: packageJson.devDependencies['@applitools/sample-web-app-testkit'].replace('^', ''),
        },
      });
    }, async () => {
      await checkOldEnvironmentWasCleaned(path, envName);
    });
  });

  it('should load a sub-environment correctly, and then the rest of the environment', async () => {
    const spy = sinon.spy(dockerPullImageByName);
    dockerPullHostObject.dockerPullImageByName = spy;
    const envName = await runASubEnvironment(pathToCompose);
    expect(spy.callCount).to.equal(2);
    await runAnEnvironment(pathToCompose, envName);
  });

  it('should not pull images if shouldPull is false', async () => {
    let caughtException = false;
    try {
      await runAnEnvironment(`${__dirname}/docker-compose-with-unpulled-image.yml`, null, { shouldPullImages: false });
    } catch (e) {
      caughtException = true;
    }

    expect(caughtException).to.equal(true);
  });

  it('should stop the service by name and see its not running and then start the service and see its running', () => runAnEnvironmentWithStopStart(pathToCompose));

  it('should keep the same address on pause and unpause of a service', () => runAnEnvironmentWithPauseUnpause(pathToCompose));

  it('should clean up before setting up an environment correctly', () => runAnOldEnvironment(pathToCompose)
    .then((oldEnvironmentName) => runAnEnvironment(pathToCompose)
      .then(() => checkOldEnvironmentWasCleaned(pathToCompose, oldEnvironmentName))));

  it('getLogsForService and should use envVar', async () => {
    process.env.FILE_TO_TAIL = '/blabla'; // This should be overriden with the value specified in envVars parameter
    let envName;
    await simulateMochaRun((before, after) => {
      envName = main.dockerComposeTool(before, after, pathToComposeForEnv, { containerRetentionInMinutes: 0, envVars: { FILE_TO_TAIL: '/etc/hosts' } });
    }, async () => {
      const stdout = await main.getLogsForService(envName, pathToComposeForEnv, 'dct_s1');
      expect(stdout).to.include('localhost');
    });
  });

  it('envVars should not inherit from existing process env vars', async () => {
    process.env.FILE_TO_TAIL = '/etc/hosts';
    let envName;
    await simulateMochaRun((before, after) => {
      envName = main.dockerComposeTool(before, after, pathToComposeForEnv, { containerRetentionInMinutes: 0, envVars: { ANOTHER_VAR: () => 'hello' } });
    }, async () => {
      const stdout = await main.getLogsForService(envName, pathToComposeForEnv, 'print_env');
      expect(stdout).to.not.include('FILE_TO_TAIL');
    });
  });
});
