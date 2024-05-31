/**
 * index.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

"use strict";

const { Sprinklers } = require("./platform");

module.exports = function(homebridge) {
    homebridge.registerPlatform("Sprinklers", Sprinklers);
};
