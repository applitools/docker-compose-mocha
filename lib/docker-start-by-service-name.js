// @flow

const { exec } = require('child-process-promise');

async function dockerStartByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker-compose -p ${runNameSpecific} -f "${pathToComposeFile}" start ${serviceName}`;
  return exec(commandExec);
}


module.exports = dockerStartByServiceName;
