const { exec } = require('child-process-promise');
const getShell = require('./shell');

module.exports = async function (runName, pathToCompose, serviceName) {
  return (await exec(`docker compose -p ${runName} -f "${pathToCompose}" logs ${serviceName}`, { shell: getShell() })).stdout;
};
