/**
 * Web App - dashboard.js
 * homebridge-sprinklers
 *
 * @copyright 2024 Hendrik Meinl
 */

/* global i18n */
define(["knockout", "knockout-mapping", "ajax"], function(ko, koMapping, ajax) {
    "use strict";

    function Dashboard(params) {

        const self = this;


        /* ----- VIEW MODELS ----- */

        self.Zones = params.zones;

        self.Forecast = {
            timestamp : ko.observable(),
            latitude  : ko.observable(),
            longitude : ko.observable(),
            daily : {
                time               : ko.observableArray([]),
                weather_code       : ko.observableArray([]),
                temperature_2m_max : ko.observableArray([]),
                temperature_2m_min : ko.observableArray([]),
                // precipitation_probability_max : ko.observableArray([]),
            },
        };


        /* ----- COMPUTED ----- */

        self.DailyForecast = ko.pureComputed(function() {
            const days = [];
            const options = {
                weekday : "short",
            };
            ko.utils.arrayForEach(self.Forecast.daily.time(), function(time, index) {
                if (index === 0) { return; }
                const weekday = new Date(Date.parse(time)).toLocaleDateString(ko.language(), options);
                // const rain = self.Forecast.daily.precipitation_probability_max()[index];
                const wmoCode = self.Forecast.daily.weather_code()[index];
                days.push({
                    day: index === 1 ? i18n("LabelToday") : weekday,
                    css: "wi wi-wmo-" + wmoCode,
                    tMin: Math.round(self.Forecast.daily.temperature_2m_min()[index]) + "°",
                    tMax: Math.round(self.Forecast.daily.temperature_2m_max()[index]) + "°",
                    // rain: rain !== 0 ? rain + "%" : "",
                    cond: i18n("OptWeatherCondition", wmoCode),
                });
            });
            return days;
        }, self);

        self.configuredZones = ko.pureComputed(function() {
            return ko.utils.arrayFilter(self.Zones(), function(zone) {
                return zone.configured();
            });
        }, self);

        self.NextRun = function(zone) {
            return ko.pureComputed(function() {
                const start = zone.schedule.start();
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
        };

        self.NextDuration = function(zone) {
            return ko.pureComputed(function() {
                const duration = zone.schedule.duration();
                if (duration) {
                    const durationStr = i18n("BtnRuntime", Math.round(duration / 60));
                    return durationStr;
                } else {
                    return "";
                }
            }, self);
        };


        /* ----- INIT ----- */

        self.isLoading = ko.observable(false);

        self.update();
    }

    Dashboard.prototype.update = function() {
        const self = this;

        self.isLoading(true);

        ajax.get("?q=forecast", function(data) {
            if (data.forecast) {
                koMapping.fromJS(data.forecast, {}, self.Forecast);
                self.isLoading(false);
            } else {
                self.isLoading(false);
            }
        }, function(error) {
            console.log(error);
            self.isLoading(false);
        });
    };

    return {
        viewModel: Dashboard,
        template: { require: "text!components/dashboard/dashboard.html" }
    };

});
