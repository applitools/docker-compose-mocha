// @flow

const { exec } = require('child-process-promise');
const chalk = require('chalk');
const { Spinner } = require('cli-spinner');
const fs = require('fs');
const chance = require('./lib/setup-environment-names-seed');
const { cleanupContainersByEnvironmentName, cleanupOrphanEnvironments } = require('./lib/docker-utility-functions');

const dockerPullImagesFromComposeFile = require('./lib/docker-pull-images-from-compose-file');
const { getRandomEnvironmentName, extractEnvFromEnvName } = require('./lib/get-random-environment-name');

const getShell = require('./lib/shell');
const dockerStartByServiceName = require('./lib/docker-start-by-service-name');
const dockerStopByServiceName = require('./lib/docker-stop-by-service-name');
const dockerPauseByServiceName = require('./lib/docker-pause-by-service-name');
const dockerUnpauseByServiceName = require('./lib/docker-unpause-by-service-name');
const dockerCheckByServiceName = require('./lib/docker-check-by-service-name');
const healthCheckMethods = require('./lib/health-check-methods');
const getAddressForService = require('./lib/get-address-for-service');
const getLogsForService = require('./lib/get-logs-for-service');

function replaceFunctionsWithTheirValues(envVars) {
  Object.entries(envVars).forEach(([key, value]) => {
    if (typeof value === 'function') {
      envVars[key] = value(); // eslint-disable-line
    }
  });
}

/* ::
type DockerComposeToolOptions = {
 startOnlyTheseServices: ?string[],
 envName: ?string,
 envVars: ?{[name:string]: string},
 healthCheck: ?Object,
 cleanUp: ?boolean,
 containerCleanUp: ?boolean
 }
 */

module.exports = {
  /**
   * Running this method will fire up the environment written in your provided Docker Compose file.
   * The environment will run isolated and with random ports to not
   * interfere with any other test suites which
   * might be running on the same CI machine.
   *
   * This methods expects the following variables
   *
   * @param beforeFunction - from your Mocha.js setup file you need to provide
   * access to the global before() function
   * so that this code can use it to start up your environment.
   *
   * @param afterFunction - from your Mocha.js setup file you need to provide
   * access to the global after() function
   * so that this code can use it to shut down your environment and clean it from the CI server
   *
   * @param pathToComposeFile - the absolute path to your docker-compose.yml file
   * for your test environment
   *
   */
  dockerComposeTool: function dockerComposeTool(
    beforeFunction/* :Function */,
    afterFunction/* :Function */,
    pathToComposeFile/* : string */,
    {
      startOnlyTheseServices = undefined,
      envName = undefined,
      envVars = undefined,
      printEnvVars = false,
      healthCheck = undefined,
      cleanUp = true,
      containerCleanUp = true,
      shouldPullImages = false,
      brutallyKill = true,
      containerRetentionInMinutes = null,
      beforeContainerCleanUp = () => {},
    }
    /* :DockerComposeToolOptions */ = {},
  )/* : string */ {
    const randomComposeEnv = envName
      ? extractEnvFromEnvName(envName)
      : getRandomEnvironmentName(chance);
    const runNameSpecific = randomComposeEnv.envName;
    const runNameDisplay = `${randomComposeEnv.firstName} ${randomComposeEnv.lastName}`;
    const performCleanup = cleanUp;
    const performContainerCleanup = containerCleanUp;

    beforeFunction(async () => {
      if (shouldPullImages) {
        await dockerPullImagesFromComposeFile(pathToComposeFile, startOnlyTheseServices);
      }
      if (performCleanup) {
        // eslint-disable-next-line
        await cleanupOrphanEnvironments(containerRetentionInMinutes == null
          ? (process.env.NODE_ENV === 'developement' || !process.env.NODE_ENV ? 2 : 5)
          : containerRetentionInMinutes).catch(() => 1);
      }
      const onlyTheseServicesMessage = startOnlyTheseServices
        ? `, using only these services: ${startOnlyTheseServices.join(',')}`
        : '';
      const consoleMessage = `Docker: starting up runtime environment for this run (codenamed: ${runNameDisplay})${onlyTheseServicesMessage}... `;
      const spinner = new Spinner(`${chalk.cyan(consoleMessage)}${chalk.yellow('%s')}`);

      if (!process.env.NOSPIN) {
        spinner.setSpinnerString('|/-\\');
        spinner.start();
      } else {
        console.log(consoleMessage);
      }
      const onlyTheseServicesMessageCommandAddition = startOnlyTheseServices
        ? startOnlyTheseServices.join(' ')
        : '';

      if (envVars) {
        replaceFunctionsWithTheirValues(envVars);
      }

      if (printEnvVars === true && envVars) {
        console.log('--- ENVIRONMENT VARIABLES START');
        Object.keys(envVars).forEach((envVar) => {
          console.log(`export ${envVar}=${envVars[envVar]}`);
        });
        console.log('--- ENVIRONMENT VARIABLES END');
      }

      let envVarsToUse = {};

      if (envVars) {
        const npmFile = process.env.NPM_FILE || fs.readFileSync(`${process.env.HOME}/.npmrc`).toString().replace('\n', '');
        envVarsToUse = { env: { PATH: process.env.PATH, NPM_FILE: npmFile, ...envVars }, shell: getShell() };
      }

      await exec(
        `docker compose -p ${runNameSpecific} -f "${pathToComposeFile}" up -d ${onlyTheseServicesMessageCommandAddition}`,
        envVarsToUse,
      );

      if (!process.env.NOSPIN) {
        spinner.stop();
        console.log(''); // We add this in order to generate a new line after the spinner has stopped
      }

      if (healthCheck !== null && typeof healthCheck === 'object' && healthCheck.state === true) {
        await healthCheckMethods.verifyServicesReady(
          runNameSpecific,
          pathToComposeFile,
          healthCheck.options || {},
          startOnlyTheseServices,
        );
      }
    });

    afterFunction(() => {
      if (performContainerCleanup) {
        beforeContainerCleanUp();
        return cleanupContainersByEnvironmentName(
          runNameSpecific,
          pathToComposeFile,
          runNameDisplay,
          brutallyKill,
          envVars,
        );
      }

      return Promise.resolve();
    });

    return runNameSpecific;
  },
  getAddressForService,
  getLogsForService,
  getRandomPortForService(...args/* :Object[] */) {
    console.warn('getRandomPortForService has been deprecated. Use "getAddressForService" instead (same signature)');

    return getAddressForService(...args);
  },
  getRandomAddressForService(...args/* :Object[] */) {
    console.warn('getRandomAddressForService has been deprecated. Use "getAddressForService" instead (same signature)');

    return getAddressForService(...args);
  },
  dockerStartByServiceName,
  dockerStopByServiceName,
  dockerCheckByServiceName,
  dockerPauseByServiceName,
  dockerUnpauseByServiceName,
};
