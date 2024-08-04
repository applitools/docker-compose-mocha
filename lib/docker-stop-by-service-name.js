// @flow

const { exec } = require('child-process-promise');
const getShell = require('./shell');

async function dockerStopByServiceName(runNameSpecific/* : string */,
  pathToComposeFile/* : string */,
  serviceName/* : string */) {
  const commandExec = `docker compose -p ${runNameSpecific} -f "${pathToComposeFile}" stop ${serviceName}`;
  return exec(commandExec, { shell: getShell() });
}

module.exports = dockerStopByServiceName;
