/**
 * Web App - prefs.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["knockout", "knockout-mapping", "text!app/i18n/lang.json"], function(ko, koMapping, data) {
    "use strict";

    function Prefs(params) {

        const self = this;

        self.NavigationStack = ko.observableArray([]);


        /* ----- VIEW MODEL ----- */

        self.Prefs = params.prefs;

        self.Languages = koMapping.fromJS(JSON.parse(data).languages);
    }

    return {
        viewModel: Prefs,
        template: { require: "text!components/prefs/prefs.html" }
    };

});
