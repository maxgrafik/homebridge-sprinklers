/**
 * Web App - zones.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["knockout"], function(ko) {
    "use strict";

    function Zones(params) {

        const self = this;


        /* ----- VIEW MODEL ----- */

        self.Zones = params.zones;


        /* ----- HELPERS ----- */

        self.selectedZone = ko.observable(null).extend({ notify: "always" });

        self.showZone = function(zone) {
            self.selectedZone(zone);
        };


        /* ----- REGISTER COMPONENTS ----- */

        if (!ko.components.isRegistered("Zone")) {
            ko.components.register("Zone", { require: "components/zone/zone" });
        }
    }

    return {
        viewModel: Zones,
        template: { require: "text!components/zones/zones.html" }
    };

});
