/**
 * Web App - alert.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

/* global i18n */
define(["knockout", "i18n"], function(ko) {
    "use strict";

    function Alert(params) {

        const self = this;

        self.isPresented = params.isPresented || ko.observable(false);

        self.alertStyle = ko.pureComputed(function() {
            const actions = (ko.unwrap(params.actions) || []);
            return actions.length > 1 ? "actionSheet" : "alert";
        }, self);

        self.title = ko.pureComputed(function() {
            return ko.unwrap(params.title) || "";
        }, self);

        self.message = ko.pureComputed(function() {
            return ko.unwrap(params.message) || "";
        }, self);

        self.actions = ko.pureComputed(function() {
            const actions = [];
            ko.utils.arrayForEach((ko.unwrap(params.actions) || []), function(btn) {
                const label = btn.label || i18n("BtnOK");
                const role = btn.role || "default";
                const action = (btn.action && typeof btn.action === "function")
                    ? () => { btn.action(); self.isPresented(false); }
                    : () => { self.isPresented(false); };
                actions.push({ label: label, role: role, action: action });
            });
            return actions;
        }, self);

        self.close = function() {
            self.isPresented(false);
        };
    }

    return {
        viewModel: Alert,
        template: { require: "text!components/alert/alert.html" }
    };

});
