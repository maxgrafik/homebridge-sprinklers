/**
 * Web App - nav.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["knockout", "grapnel", "text!components/components.json"], function(ko, Grapnel, componentData) {
    "use strict";

    /**
     * Handles the navigation by setting the view observable in
     * the app component which dynamically loads components.
     *
     * @param {object}     params         The params object
     * @param {observable} params.view    The view observable from app
     */

    function Navigation(params) {

        const self = this;

        self.Components = ko.observableArray([]);
        self.Router = new Grapnel({ pushState: false, hashBang: true });

        // extend component vm
        const data = JSON.parse(componentData);
        ko.utils.arrayForEach(data.components, function(component) {

            component.isSelected = ko.pureComputed(function() {
                return params.view() === this.name;
            }, component);

            self.Components.push(component);
        });

        // register components
        ko.utils.objectForEach(self.Components(), function(index, component) {
            if (component.src && !ko.components.isRegistered(component.name)) {
                ko.components.register(component.name, { require: component.src });
            }
            self.Router.add(component.route, function() {
                params.view(component.name);
            });
        });

        self.Menu = ko.pureComputed(function() {
            return ko.utils.arrayFilter(self.Components(), function(component) {
                return component.menu === true;
            });
        }, self);
    }

    Navigation.prototype.dispose = function() {
        const self = this;
        self.Components([]);
        self.Router = null;
    };

    return {
        viewModel: Navigation,
        template: { require: "text!components/nav/nav.html" }
    };

});
