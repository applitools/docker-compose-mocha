/* @flow */
/* eslint no-console: 0 */
const yaml = require('js-yaml');
const fs = require('fs');
const { promisify } = require('util');
const fetch = require('node-fetch').default;
const getAddressForService = require('./get-address-for-service');

async function pollUntilServiceIsReady(
  runName /* : String */,
  serviceName /* : String */,
  poller /* : Function */,
  exposedInternalPort /* : String */,
  pathToCompose /* : String */,
  timeout, /* : Number */
) {
  // First let's get the resolved address of the service
  const serviceAddress = await getAddressForService(
    runName,
    pathToCompose,
    serviceName,
    exposedInternalPort,
  );
  let timeElapsedUnix = 0;
  let pollingState = false;
  const startTimeStamp = Math.floor(Date.now() / 1000);

  do {
    // eslint-disable-next-line no-await-in-loop
    const result = await poller(serviceAddress);
    if (result === true) {
      console.log(`Service ${serviceName.toString()} is ready!`);
      // Exit the poller!
      pollingState = true;
      break;
    }
    timeElapsedUnix = Number(Math.floor(Date.now() / 1000) - startTimeStamp);
  } while (timeElapsedUnix <= Number(timeout));
  // Timeout reached, let's get out of here

  if (!pollingState) {
    throw new Error(`Timeout for service ${serviceName.toString()} reached after ${timeElapsedUnix.toString()} seconds!`);
  }
}

module.exports = {
  async verifyServicesReady(
    runName,
    pathToCompose /* : String */,
    options /* : Object */,
    startOnlyTheseServices /* : Array<string> */ = [],
  ) {
    const composeFileContent = await promisify(fs.readFile)(pathToCompose, 'utf8');
    const doc = yaml.safeLoad(composeFileContent);
    const promises = [];
    const defaultPollers = {
      async http(url) {
        try {
          const response = await fetch(`http://${url}/healthcheck`, {
            timeout: 2000,
          });

          return (response.status >= 200 && response.status < 500);
        } catch (err) {
          await promisify(setTimeout)(1000);
          return false;
        }
      },
    };

    // Support for Docker Compose v2 and higher
    const services = doc.services || doc;

    Object
      .keys(services)
      .forEach((serviceName) => {
        // Exit health check when service is not on startOnlyTheseServices.
        if (startOnlyTheseServices.length > 0 && !startOnlyTheseServices.includes(serviceName)) {
          return;
        }
        let pollerToUse = defaultPollers.http;
        if ('custom' in options && serviceName in options.custom) {
          pollerToUse = options.custom[serviceName];
        }

        console.log(services[serviceName].ports[0]);
        promises.push(pollUntilServiceIsReady(
          runName,
          serviceName,
          pollerToUse,
          services[serviceName].ports[0],
          pathToCompose,
          options.timeout || 30,
        ));
      });

    await Promise.all(promises);
  },
};
