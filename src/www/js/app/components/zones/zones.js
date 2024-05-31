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

        self.NavigationStack = ko.observableArray([]);


        /* ----- VIEW MODEL ----- */

        self.Zones = params.zones;


        /* ----- HELPERS ----- */

        self.selectedZone = ko.observable(null);

        self.showZone = function(zone) {
            self.selectedZone(null);
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
