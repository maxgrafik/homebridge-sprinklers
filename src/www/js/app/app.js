/**
 * Web App - app.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

/* global i18n */
define(["knockout", "knockout-mapping", "ajax", "i18n"], function(ko, koMapping, ajax) {
    "use strict";

    function Sprinklers() {

        const self = this;

        /* ----- VIEW MODELS ----- */

        self.Zones = ko.observableArray([]);
        self.Zones.dirtyFlag = new ko.dirtyFlag(self.Zones);

        self.Zone = function() {
            this.id         = ko.observable();
            this.name       = ko.observable();
            this.enabled    = ko.observable();
            this.configured = ko.observable();
            this.isRunning  = ko.observable();

            this.characteristics = {
                Kc      : ko.observable().extend({ decimal: true }),
                Zr      : ko.observable().extend({ decimal: true }),
                TAW     : ko.observable().extend({ numeric: true }),
                MAD     : ko.observable().extend({ decimal: true }),
                Dr      : ko.observable().extend({ decimal: true }),
                Dr_date : ko.observable(),
                I       : ko.observable().extend({ decimal: true }),
            };

            this.irrigation = {
                area         : ko.observable().extend({ decimal: true }),
                emitterCount : ko.observable().extend({ numeric: true }),
                flowRate     : ko.observable().extend({ decimal: true }),
                efficiency   : ko.observable().extend({ decimal: true }),
                cycles       : ko.observable().extend({ numeric: true }),
                soakTime     : ko.observable().extend({ numeric: true }),
            };

            this.schedule = {
                adaptive        : ko.observable(),
                sunriseOffset   : ko.observable().extend({ numeric: true }),
                minimumDuration : ko.observable().extend({ numeric: true }),
                defaultDuration : ko.observable().extend({ numeric: true }),
                weekdays        : ko.observableArray([]),
            };
        };

        self.Prefs = {
            language : ko.observable("en"),
        };


        /* ----- GLOBALS ----- */

        ko.language = ko.observable();
        ko.languageFormats = ko.observable();


        /* ----- VIEW ----- */

        self.currentView = ko.observable("Dashboard");


        /* ----- REGISTER COMPONENTS ----- */

        ko.components.register("Navigation", { require: "components/nav/nav" });
        ko.components.register("Dashboard", { require: "components/dashboard/dashboard" });
        ko.components.register("slider", { require: "components/slider/slider" });
        ko.components.register("alert", { require: "components/alert/alert" });


        /* ----- HELPER ----- */

        self.updateTimer = null;
        self.deferSaving = null;

        self.confirmStopDlg = ko.observable(null);
        self.confirmStop = function(zone) {
            self.confirmStopDlg({
                title: i18n("TitleConfirmStop", {name: zone.name()}),
                message: i18n("TextConfirmStop"),
                buttons: [{
                    text: i18n("BtnStopNow"),
                    role: "destructive",
                    action: self.cancelZone.bind(self, zone)
                }]
            });
        };


        /* --- INIT --- */

        self.loadPrefs();
        self.loadLanguage(self.Prefs.language());

        self.Prefs.dirtyFlag = new ko.dirtyFlag(self.Prefs);

        self.subscriptions = {};
        self.subscriptions["prefs"] = self.Prefs.dirtyFlag.isDirty.subscribe(self.savePrefs, self);

        self.updateZones();
    }

    Sprinklers.prototype.updateZones = function() {
        const self = this;

        if (self.updateTimer) {
            clearTimeout(self.updateTimer);
            self.updateTimer = null;
        }

        if (self.subscriptions["zones"]) {
            self.subscriptions["zones"].dispose();
            self.subscriptions["zones"] = null;
        }

        ajax.get("?q=zones", function(data) {
            if (data.zones) {
                const mapping = {
                    key: function(item) {
                        return ko.utils.unwrapObservable(item.id);
                    },
                    create: function(options) {
                        const zone = new self.Zone();
                        koMapping.fromJS(options.data, {}, zone);
                        return zone;
                    }
                };
                koMapping.fromJS(data.zones, mapping, self.Zones);
                self.Zones.dirtyFlag.setClean();
            }
            self.subscriptions["zones"] = self.Zones.dirtyFlag.isDirty.subscribe(self.saveZones, self);
            self.updateTimer = setTimeout(() => self.updateZones(), (15 * 1000));
        }, function(error) {
            self.subscriptions["zones"] = self.Zones.dirtyFlag.isDirty.subscribe(self.saveZones, self);
            self.updateTimer = setTimeout(() => self.updateZones(), (15 * 1000));
            console.log(error);
        });
    };

    Sprinklers.prototype.saveZones = function() {
        const self = this;
        if (self.Zones.dirtyFlag.isDirty()) {
            const changedItems = self.Zones.dirtyFlag.getDirty();
            if (changedItems.length) {
                if (self.deferSaving) {
                    clearTimeout(self.deferSaving);
                    self.deferSaving = null;
                }
                const mapping = {
                    "ignore": ["isRunning", "sensor", "start", "duration"]
                };
                const json = koMapping.toJSON(changedItems, mapping);
                self.deferSaving = setTimeout(() => {
                    ajax.post("?q=zones", json, function() {
                        self.updateZones();
                    }, function(error) {
                        self.updateZones();
                        console.log(error);
                    });
                }, 2000);
            } else {
                self.Zones.dirtyFlag.setClean();
            }
        }
    };

    Sprinklers.prototype.cancelZone = function(zone) {
        const self = this;
        if (zone.isRunning()) {
            ajax.post("?q=cancel&zoneId=" + zone.id(), null, function() {
                self.updateZones();
            }, function(error) {
                self.updateZones();
                console.log(error);
            });
        }
    };

    Sprinklers.prototype.loadPrefs = function() {
        const self = this;
        const data = localStorage.getItem("SprinklersPrefs");
        if (data) {
            koMapping.fromJSON(data, {}, self.Prefs);
        }
    };

    Sprinklers.prototype.savePrefs = function() {
        const self = this;
        if (self.Prefs.dirtyFlag.isDirty()) {
            const data = koMapping.toJSON(self.Prefs);
            localStorage.setItem("SprinklersPrefs", data);
            self.Prefs.dirtyFlag.setClean();

            if (self.Prefs.language() !== ko.language()) {
                self.loadLanguage(self.Prefs.language());
            }
        }
    };

    Sprinklers.prototype.loadLanguage = function(code) {
        const languageFile = "text!app/i18n/" + code + ".json";
        require([languageFile], function(data) {
            const i18nObj = JSON.parse(data);
            i18n.translator.add(i18nObj);
            ko.languageFormats(i18nObj.formats);
            ko.language(code);
        });
    };

    Sprinklers.prototype.dispose = function() {
        const self = this;
        for (const key in self.subscriptions) {
            self.subscriptions[key].dispose();
            self.subscriptions[key] = null;
        }

        self.Zones = null;
        self.Prefs = null;

        self.currentView(null);

        ko.language = null;
        ko.languageFormats = null;
    };

    return {
        viewModel: Sprinklers,
        template: { require: "text!app/app.html" }
    };

});
