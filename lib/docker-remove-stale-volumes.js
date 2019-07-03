// @flow
/* eslint no-console: 0 */


const { exec } = require('child-process-promise');


module.exports = async () => {
  console.log('Removing volumes which we don\'t need..');
  try {
    // http://stackoverflow.com/questions/17402345/ignore-empty-results-for-xargs-in-mac-os-x
    await exec('(docker volume ls -q || echo :) | xargs docker volume rm');
  } catch (err) {
    console.log('No volumes require removal.. we\'re good to go');
  }
};
