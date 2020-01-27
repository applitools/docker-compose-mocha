// @flow

const { exec } = require('child-process-promise');

async function dockerPauseByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker-compose -p ${runNameSpecific} -f "${pathToComposeFile}" pauser ${serviceName}`;
  return exec(commandExec);
}


module.exports = dockerPauseByServiceName;
