// @flow

const { exec } = require('child-process-promise');

module.exports = function dockerKillByContainerId(id/* : string */) {
  return exec(`docker rm -f -v ${id}`);
};
