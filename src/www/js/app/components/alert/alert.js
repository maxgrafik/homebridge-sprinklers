/**
 * Web App - alert.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

define(["knockout", "utils"], function(ko, ux) {
    "use strict";

    function Alert(params) {

        const self = this;

        self.config = params.config || ko.observable(null);

        self.title = ko.pureComputed(function() {
            return (self.config() && self.config().title) || "";
        }, self);

        self.message = ko.pureComputed(function() {
            return (self.config() && self.config().message) || "";
        }, self);

        self.buttons = ko.pureComputed(function() {
            return (self.config() && self.config().buttons) || [];
        }, self);

        self.buttonAction = function(button) {
            button.action && button.action();
            ux.hideAlert(() => {
                self.config(null);
            });
        };

        self.close = function() {
            ux.hideAlert(() => {
                self.config(null);
            });
        };

        self.config.subscribe((value) => {
            if (value) {
                ux.showAlert();
            }
        }, self);
    }

    return {
        viewModel: Alert,
        template: { require: "text!components/alert/alert.html" }
    };

});
