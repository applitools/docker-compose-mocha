// @flow

const { exec } = require('child-process-promise');

async function dockerStopByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker-compose -p ${runNameSpecific} -f "${pathToComposeFile}" stop ${serviceName}`;
  return exec(commandExec, { shell: '/bin/zsh' });
}


module.exports = dockerStopByServiceName;
