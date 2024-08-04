// @flow

const { exec } = require('child-process-promise');
const getShell = require('./shell');

async function dockerStartByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker compose -p ${runNameSpecific} -f "${pathToComposeFile}" start ${serviceName}`;
  return exec(commandExec, { shell: getShell() });
}

module.exports = dockerStartByServiceName;
