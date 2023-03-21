// @flow

function extractTimestampFromName(containerName/* : string */, divider/* : string */) {
  return Number(containerName.split('_')[1].split(divider)[1].split("-")[0]);
}

module.exports = extractTimestampFromName;
