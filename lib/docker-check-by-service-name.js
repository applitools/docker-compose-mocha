const { exec } = require('child-process-promise');
const getShell = require('./shell');

/**
 * check if the container exist by name
 */
async function dockerCheckByServiceName(
  runName/* : Function */,
  pathToCompose/* : string */,
  serviceName, /* : string */
) {
  const command = `docker compose -p ${runName} -f "${pathToCompose}" ps`;
  const result = await exec(command, { shell: getShell() });
  const lines = result.stdout.split('\n');
  const exist = lines.find((element) => {
    const containerName = `${runName}-${serviceName}`;
    return element.indexOf(containerName) > -1 && element.indexOf('Up') > -1 && element.indexOf('Paused') === -1;
  });
  return Boolean(exist);
}

module.exports = dockerCheckByServiceName;
