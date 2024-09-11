// @flow

const { exec } = require('child-process-promise');

module.exports = async function dockerKillByContainerId(id/* : string */) {
  let res;

  try {
    res = await exec(`docker rm -f -v ${id}`);
  } catch (e) {
    if (e.message.includes('is not running')) {
      console.log(`container ${id} is no longer running`);
    } else {
      throw e;
    }
  }

  return res;
};
