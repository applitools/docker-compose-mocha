const { exec } = require('child-process-promise');

/**
 * check if the container exist by name
 */
async function dockerCheckByServiceName(runName/* : Function */,
  pathToCompose/* : string */,
  serviceName/* : string */) {
  const command = `docker-compose -p ${runName} -f "${pathToCompose}" ps`;
  const result = await exec(command);
  const lines = result.stdout.split('\n');
  const exist = lines.find((element) => {
    const containerName = `${runName}_${serviceName}`;
    return element.indexOf(containerName) > -1 && element.indexOf('Up') > -1;
  });
  return Boolean(exist);
}

module.exports = dockerCheckByServiceName;
