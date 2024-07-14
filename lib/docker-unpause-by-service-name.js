// @flow

const { exec } = require('child-process-promise');

async function dockerUnpauseByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker compose -p ${runNameSpecific} -f "${pathToComposeFile}" unpause ${serviceName}`;
  return exec(commandExec, { shell: '/bin/zsh' });
}

module.exports = dockerUnpauseByServiceName;
