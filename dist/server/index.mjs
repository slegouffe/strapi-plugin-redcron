import debug from "debug";
import Redlock from "redlock";
const bootstrap = ({ strapi }) => {
  if (!strapi.redis) {
    return strapi.log.error("redcron plugin requires strapi-redis plugin to be installed and configured");
  }
  if (strapi.config.get("plugin::redcron-v5").debug) {
    debug.enable("strapi:plugin:redcron-v5");
    debug("strapi:plugin:redcron-v5")("\nredcron config:", strapi.config.get("plugin::redcron-v5"));
  }
};
const register = ({ strapi }) => {
  if (strapi.config.get("plugin::redcron-v5").debug) {
    debug.enable("strapi:plugin:redcron-v5");
  }
  debug("strapi:plugin:redcron-v5")("\n*** register redcron ***");
  const config2 = strapi.config.get("plugin::redcron-v5");
  const originalAdd = strapi.cron.add;
  strapi.cron.add = (tasks) => {
    const generateRedlockFunction = (originalFunction, name) => {
      return async (...args) => {
        const connections = Object.keys(strapi.redis.connections).map((key) => {
          return strapi.redis.connections[key].client;
        });
        const redlock = new Redlock(connections, config2.redlockConfig);
        let lock;
        try {
          lock = await redlock.acquire([name], config2.lockTTL);
          debug(`Job ${name} acquired lock`);
          await originalFunction(...args);
        } catch (e) {
          debug(`Job ${name} failed to acquire lock`);
        } finally {
          let lockDelay = config2.lockDelay ? config2.lockDelay : config2.redlockConfig.retryCount * (config2.redlockConfig.retryDelay + config2.redlockConfig.retryJitter);
          debug(`Job ${name} waiting ${lockDelay}ms before releasing lock`);
          await new Promise((resolve) => setTimeout(resolve, lockDelay));
          if (lock) {
            debug(`Job ${name} releasing lock`);
            try {
              await lock.release();
            } catch (e) {
              debug(`Job ${name} failed to release lock ${e}`);
            }
          }
        }
      };
    };
    Object.keys(tasks).forEach((key) => {
      const taskValue = tasks[key];
      if (typeof taskValue === "function") {
        strapi.log.info("redcron requires tasks to use the object format");
        return;
      } else if (typeof taskValue === "object" && taskValue && typeof taskValue.task === "function" && taskValue.bypassRedcron !== true) {
        const taskName = taskValue.name || key;
        taskValue.task = generateRedlockFunction(
          taskValue.task,
          "redcron:" + taskName
        );
      }
    });
    originalAdd(tasks);
  };
};
const config = {
  default: {
    redlockConfig: {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200
    },
    lockDelay: null,
    lockTTL: 5e3,
    debug: false
  },
  validator() {
  }
};
const index = {
  bootstrap,
  register,
  config
};
export {
  index as default
};
