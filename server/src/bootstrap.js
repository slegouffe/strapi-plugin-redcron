import debug from 'debug';

const bootstrap = ({ strapi }) => {
  if (!strapi.redis) {
    return strapi.log.error('redcron plugin requires strapi-redis plugin to be installed and configured')
  }
  if (strapi.config.get('plugin::redcron-v5').debug) {
    // enable debug if debug is set to true in the config
    debug.enable('strapi:plugin:redcron-v5');
    debug('strapi:plugin:redcron-v5')('\nredcron config:', strapi.config.get('plugin::redcron-v5'));
  }
};

export default bootstrap;
