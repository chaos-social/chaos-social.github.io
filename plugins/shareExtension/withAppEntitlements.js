const {withEntitlementsPlist} = require('expo/config-plugins')

const withAppEntitlements = config => {
  return withEntitlementsPlist(config, async config => {
    config.modResults['com.apple.security.application-groups'] = [
      `group.app.witchsky`,
    ]
    return config
  })
}

module.exports = {withAppEntitlements}
