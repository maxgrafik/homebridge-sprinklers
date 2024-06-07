/**
 * Web App - zone.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

/* global i18n */
define(["knockout"], function(ko) {
    "use strict";

    function Zone(params) {

        const self = this;


        /* ----- VIEW MODEL ----- */

        self.Zone = params.data();


        /* ----- WRITABLE COMPUTED ----- */

        self.ZoneCharacteristicsDr = ko.pureComputed({
            read: function() {
                const TAW = self.Zone.characteristics.TAW();
                const Dr  = self.Zone.characteristics.Dr();
                const I   = self.Zone.characteristics.I();
                return Math.min(TAW, Math.max(0, Dr - I));
            },
            write: function(newValue) {
                const oldValue = self.ZoneCharacteristicsDr();
                if (newValue === 0 || newValue !== oldValue) {

                    // when manually changing current root zone depletion
                    // we set Dr_date to tomorrow to prevent updating Dr
                    // with yesterday's values for ETc, P and I on next
                    // call of updateSchedule() in /utils/zone.js

                    const date = new Date();
                    date.setDate(date.getDate() + 1);
                    const tomorrow = date.toISOString().slice(0, 10);

                    self.Zone.characteristics.Dr(newValue);
                    self.Zone.characteristics.Dr_date(tomorrow);
                    self.Zone.characteristics.I(0);
                }
            },
            owner: self
        });

        self.ZoneIrrigationSoakTime = ko.pureComputed({
            read: function() {
                return self.Zone.irrigation.soakTime() / 60;
            },
            write: function(value) {
                self.Zone.irrigation.soakTime(value * 60);
            },
            owner: self
        });

        self.ZoneScheduleSunriseOffset = ko.pureComputed({
            read: function() {
                return self.Zone.schedule.sunriseOffset() / 60;
            },
            write: function(value) {
                self.Zone.schedule.sunriseOffset(value * 60);
            },
            owner: self
        });

        self.ZoneScheduleMinimumDuration = ko.pureComputed({
            read: function() {
                return self.Zone.schedule.minimumDuration() / 60;
            },
            write: function(value) {
                self.Zone.schedule.minimumDuration(value * 60);
            },
            owner: self
        });

        self.ZoneScheduleDefaultDuration = ko.pureComputed({
            read: function() {
                return self.Zone.schedule.defaultDuration() / 60;
            },
            write: function(value) {
                self.Zone.schedule.defaultDuration(value * 60);
            },
            owner: self
        });

        self.Weekdays = function(idx) {
            const index = ko.unwrap(idx);
            return ko.pureComputed({
                read: function() {
                    return self.Zone.schedule.weekdays().includes(index);
                },
                write: function(value) {
                    if (value === true && self.Zone.schedule.weekdays.indexOf(index) === -1) {
                        self.Zone.schedule.weekdays.push(index);
                    } else if (value === false) {
                        self.Zone.schedule.weekdays.remove(index);
                    }
                },
                owner: self
            });
        };


        /* ----- COMPUTED ----- */

        self.NextRun = ko.pureComputed(function() {
            const start = self.Zone.schedule.start();
            if (start) {
                const options = {
                    year   : "numeric",
                    month  : "long",
                    day    : "numeric",
                    hour   : "numeric",
                    minute : "2-digit",
                };
                const dateStr = new Date(start).toLocaleString(ko.language(), options);
                return dateStr;
            } else {
                return i18n("TextNoScheduledRun");
            }
        }, self);

        self.NextDuration = ko.pureComputed(function() {
            const duration = self.Zone.schedule.duration();
            if (duration) {
                const durationStr = i18n("BtnRuntime", Math.round(duration / 60));
                return durationStr;
            } else {
                return "";
            }
        }, self);

        self.SelectedSoilTexture = ko.pureComputed(function() {
            const TAW = self.Zone.characteristics.TAW();
            const selection = ko.utils.arrayFirst(self.SoilTextureOptions(), function(option) {
                return option.value === TAW;
            });
            if (selection) {
                return selection.title;
            } else {
                return i18n("OptCustom");
            }
        }, self);


        /* ----- SELECT OPTIONS ----- */

        self.SoilTextureOptions = ko.pureComputed(function() {
            const values = [
                [i18n("OptCoarseSand"), 0.25, 0.75],
                [i18n("OptFineSand"), 0.75, 1.00],
                [i18n("OptLoamySand"), 1.10, 1.20],
                [i18n("OptSandyLoam"), 1.25, 1.40],
                [i18n("OptFineSandyLoam"), 1.50, 2.00],
                [i18n("OptSiltLoam"), 2.00, 2.50],
                [i18n("OptSiltyClayLoam"), 1.80, 2.00],
                [i18n("OptSiltyClay"), 1.50, 1.70],
                [i18n("OptClay"), 1.20, 1.50],
            ];

            // converting from min/max in/ft to average mm/m

            const options = [];
            values.forEach(value => {
                options.push({
                    title: value[0],
                    value: Math.round(((value[1] + value[2]) / 2) * 25.4 * (1/0.3048))
                });
            });
            return options;
        }, self);

        self.WeekdayOptions = ko.pureComputed(function() {
            const options = [];
            const language = ko.languageFormats();
            for (let i = 0; i < 7; i++) {
                options.push(
                    language.weekdays[i]
                );
            }
            return options;
        }, self);

        self.RunTimeOptions = ko.pureComputed(function() {
            const options = [];
            for (let i = 5; i <= 60; i = i + 5) {
                options.push({
                    title: i18n("OptMinutes", i),
                    value: i
                });
            }
            return options;
        }, self);

        self.CyclePauseOptions = ko.pureComputed(function() {
            const values = [5, 10, 15, 30];
            const options = [];
            values.forEach(value => {
                options.push({
                    title: i18n("OptMinutes", value),
                    value: value
                });
            });
            return options;
        }, self);

        self.MinimumDurationOptions = ko.pureComputed(function() {
            const values = [1, 5, 10, 15, 30];
            const options = [];
            values.forEach(value => {
                options.push({
                    title: i18n("OptMinutes", value),
                    value: value
                });
            });
            return options;
        }, self);

        self.SunriseOptions = ko.pureComputed(function() {
            const values = [-60, -30, 0, 30, 60, 120];
            const options = [];
            values.forEach(value => {
                options.push({
                    title: i18n("OptSunriseOffset", value),
                    value: value
                });
            });
            return options;
        }, self);
    }

    Zone.prototype.configureZone = function() {
        const self = this;
        self.Zone.configured(true);
    };

    return {
        viewModel: Zone,
        template: { require: "text!components/zone/zone.html" }
    };

});
