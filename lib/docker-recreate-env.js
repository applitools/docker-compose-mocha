// @flow
/* eslint no-console: 0 */


const { exec } = require('child-process-promise');
const {
  extractEnvFromEnvName,
  getRandomEnvironmentName
} = require('./get-random-environment-name');
const chance = require('./setup-environment-names-seed');
const { cleanupContainersByEnvironmentName } = require('./docker-utility-functions');


module.exports = async (envName, pathToComposeFile) => {
  console.log('Recreating docker env');

  try {
    await cleanupContainersByEnvironmentName(envName, pathToComposeFile);
    console.log('Env is down');
  } catch (err) {
    console.log('Error taking the env down', err);
    throw err;
  }

  try {
    const randomComposeEnv = getRandomEnvironmentName(chance);
    // http://stackoverflow.com/questions/17402345/ignore-empty-results-for-xargs-in-mac-os-x
    await exec(`docker-compose -p ${randomComposeEnv.envName} -f "${pathToComposeFile}" up`,
      { envVars: this.envVars });
    console.log('Env is up');
  } catch (err) {
    console.log('Error taking the env down', err);
    throw err;
  }
};
