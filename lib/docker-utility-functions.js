// @flow
/* eslint no-console: 0 */

const { exec } = require('child-process-promise');
const chalk = require('chalk');
const { Spinner } = require('cli-spinner');

const getShell = require('./shell');
const extractTimestampFromName = require('./extract-timestamp-from-name');
const extractContainerIdFromName = require('./extract-container-id-from-name');
const dockerKillByContainerId = require('./docker-kill-by-container-id');
const extractProjectNameFromContainer = require('./extract-project-name-from-container');
const dockerKillNetworkByProjectName = require('./docker-kill-network-by-project-name');
const dockerRemoveStaleVolumes = require('./docker-remove-stale-volumes');

const divider = 'zzdivzz';

function getUnixTimestampNow() {
  return Math.floor(Date.now() / 1000);
}

/**
 * This method filters stale containers from the docker ps command
 * e.g - here's an example of a docker ps output
 *
 * 74934f702e5b cicontainerdenisekochanovitchzzdivzz1483974116_dct_s1_1
 * 490cd2f7f23e cicontainerdenisekochanovitchzzdivzz1483974116_dct_s2_1
 * 0a0d54af82ae cicontainerdenisekochanovitchzzdivzz1483974116_db_1
 *
 * The first value being the container Id and the second one is the container name.
 *
 * @param stdout
 * @param minutesAgoInUnixTimestamp
 * @param containerRetentionInMinutesParam
 * @returns {Array.<String>}
 */
function getStaleContainers(
  stdout /* : String */,
  minutesAgoInUnixTimestamp /* : number */,
  containerRetentionInMinutesParam, /* : number */
) /* : Array<string> */ {
  return stdout
    .split('\n')
    .filter((o) => o.length > 0 && o.indexOf('cicontainer') !== -1)
    .filter((o) => {
      console.log(`inspecting container named: ${o} for cleanup`);
      const decision = (extractTimestampFromName(o, divider) <= minutesAgoInUnixTimestamp)
        || (containerRetentionInMinutesParam === 0);
      if (decision) {
        console.log(`container named: ${o} is more than ${containerRetentionInMinutesParam} minutes old and will be cleaned up`);
      } else {
        console.log(`container named: ${o} is fresh and will NOT be cleaned up`, decision, containerRetentionInMinutesParam);
      }
      return decision;
    });
}

async function cleanupContainersByEnvironmentName(
  envName/* : string */,
  pathToComposeFile/* : string */,
  envDisplayName/* : string */,
  brutallyKill/* : boolean */,
  envVars,
) {
  const consoleMessage = `${brutallyKill ? 'Killing' : 'Stopping'} all containers of environment codenamed: ${envDisplayName}.. `;
  const spinner = new Spinner(`${chalk.cyan(consoleMessage)}${chalk.yellow('%s')}`);

  if (!process.env.NOSPIN) {
    spinner.setSpinnerString('|/-\\');
    spinner.start();
  } else {
    console.log(consoleMessage);
  }

  try {
    await exec(`docker compose -p ${envName} -f "${pathToComposeFile}" ${brutallyKill ? 'kill' : 'down'}`, envVars ? { shell: getShell(), env: { PATH: process.env.PATH, ...envVars } } : { shell: getShell() });
  } catch (e) {
    if (e.message.includes('is not running')) {
      console.log(`env ${envName} is no longer running`);
    } else {
      throw e;
    }
  }

  const consoleMessageDispose = `Disposing of ${envDisplayName} environment.. `;
  const spinner2 = new Spinner(`${chalk.cyan(consoleMessageDispose)}${chalk.yellow('%s')}`);

  if (!process.env.NOSPIN) {
    spinner.stop();
    spinner2.setSpinnerString('|/-\\');
    spinner2.start();
  } else {
    console.log(consoleMessageDispose);
  }

  try {
    await exec(`docker compose -p ${envName} -f "${pathToComposeFile}" down -v`, envVars ? { shell: getShell(), env: { PATH: process.env.PATH, ...envVars } } : { shell: getShell() });
  } catch (e) {
    if (e.message.includes('is not running')) {
      console.log(`env ${envName} is no longer running`);
    } else {
      throw e;
    }
  }

  if (!process.env.NOSPIN) {
    spinner2.stop();
    console.log(''); // We add this in order to generate a new line after the spinner has stopped
  }
}

async function cleanupOrphanEnvironments(containerRetentionInMinutesParam) {
  console.log('Performing orphan containers cleanup (from previous CI runs)..');
  const minutesAgoInUnixTimestamp = containerRetentionInMinutesParam === 0
    ? getUnixTimestampNow()
    : getUnixTimestampNow() - (60 * containerRetentionInMinutesParam);
  const result = await exec('docker ps --format "{{.ID}} {{.Names}}"');

  const staleContainers = getStaleContainers(
    result.stdout,
    minutesAgoInUnixTimestamp,
    containerRetentionInMinutesParam,
  );

  // Kill stale containers
  await Promise
    .all(staleContainers
      .map((container) => extractContainerIdFromName(container, divider))
      .map((containerId) => dockerKillByContainerId(containerId)));

  // Remove stale networks
  await Promise.all(Array
    .from(new Set(staleContainers
      .map((container) => extractProjectNameFromContainer(container)))
      .values())
    .map((projectName) => dockerKillNetworkByProjectName(projectName)));

  // Clean up old volumes which are not connected to anything
  // Volumes which are in use will not be harmed by this
  await dockerRemoveStaleVolumes();
}

module.exports = {
  cleanupContainersByEnvironmentName,
  cleanupOrphanEnvironments,
};
