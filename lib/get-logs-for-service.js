const { exec } = require('child-process-promise');

module.exports = async function (runName, pathToCompose, serviceName) {
  return (await exec(`docker compose -p ${runName} -f "${pathToCompose}" logs ${serviceName}`, { shell: '/bin/zsh' })).stdout;
};
