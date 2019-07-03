const fs = require('fs');
const { promisify } = require('util');
const yaml = require('js-yaml');
const pullTools = require('./docker-pull-image-by-name');

async function dockerPullImagesFromComposeFile(pathToCompose, startOnlyTheseServices = []) {
  const composeFileContent = await promisify(fs.readFile)(pathToCompose, 'utf8');
  const doc = yaml.safeLoad(composeFileContent);

  // Support for Docker Compose v2 and higher
  const services = doc.services || doc;

  const images = Array.from(new Set(Object.keys(services)
    .map((service) => {
      if (startOnlyTheseServices.length > 0) {
        if (!startOnlyTheseServices.includes(service)) {
          return null;
        }
      }
      return services[service].image || null;
    })
    .filter(image => image !== null)));

  await Promise.all(images.map(image => pullTools.dockerPullImageByName(image)));
}
module.exports = dockerPullImagesFromComposeFile;
